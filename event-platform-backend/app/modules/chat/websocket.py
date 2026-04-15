# app/modules/chat/websocket.py

import logging
import json
from typing import Dict, List, Set
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.users.models import User

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time chat."""

    def __init__(self):
        # conversation_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, conversation_id: str):
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = set()
        self.active_connections[conversation_id].add(websocket)
        logger.info(f"WebSocket connected to conversation {conversation_id}")

    def disconnect(self, websocket: WebSocket, conversation_id: str):
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].discard(websocket)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]
        logger.info(f"WebSocket disconnected from conversation {conversation_id}")

    async def broadcast(self, conversation_id: str, message: dict):
        """Broadcast message to all users in a conversation."""
        if conversation_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[conversation_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send message: {e}")
                    disconnected.add(connection)

            # Clean up disconnected clients
            for conn in disconnected:
                self.active_connections[conversation_id].discard(conn)


# Global connection manager
manager = ConnectionManager()


async def get_current_user_websocket(
    websocket: WebSocket, db: Session = Depends(get_db)
) -> User:
    """Authenticate WebSocket connection using JWT token."""
    try:
        # Get token from query parameter
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001)
            raise Exception("No token provided")

        # Verify token and get user
        from app.core.security import decode_token

        payload = decode_token(token)
        if not payload:
            await websocket.close(code=4001)
            raise Exception("Invalid token")

        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            raise Exception("Invalid token payload")

        user = db.query(User).filter(User.id == UUID(user_id)).first()
        if not user:
            await websocket.close(code=4001)
            raise Exception("User not found")

        return user
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        await websocket.close(code=4001)
        raise


def validate_user_in_conversation(
    db: Session, user_id: UUID, conversation_id: UUID
) -> bool:
    """Validate that user is a participant in the conversation."""
    from app.modules.chat.models import ChatRoom
    from app.modules.vendors.models import Vendor

    chat = db.query(ChatRoom).filter(ChatRoom.id == conversation_id).first()
    if not chat:
        return False

    # Check if user is the customer in the conversation
    if chat.user_id == user_id:
        return True

    # Check if user owns the vendor in the conversation
    vendor = db.query(Vendor).filter(Vendor.id == chat.vendor_id).first()
    return vendor is not None and vendor.user_id == user_id


async def websocket_endpoint(websocket: WebSocket, conversation_id: str):
    """Main WebSocket endpoint for real-time chat."""

    # Get DB session first so all operations use the same session
    db = next(get_db())

    try:
        # Authenticate user inline (can't use Depends outside FastAPI routing)
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001)
            return

        from app.core.security import decode_token

        payload = decode_token(token)
        if not payload:
            await websocket.close(code=4001)
            return

        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=4001)
            return

        user = db.query(User).filter(User.id == UUID(user_id_str)).first()
        if not user:
            await websocket.close(code=4001)
            return

        # Validate user is part of conversation
        try:
            conversation_uuid = UUID(conversation_id)
            if not validate_user_in_conversation(db, user.id, conversation_uuid):
                await websocket.accept()
                await websocket.send_json({"error": "Access denied"})
                await websocket.close(code=4003)
                return
        except Exception as e:
            logger.error(f"Conversation validation failed: {e}")
            await websocket.accept()
            await websocket.send_json({"error": "Invalid conversation"})
            await websocket.close(code=4004)
            return

        # Connect to conversation
        await manager.connect(websocket, conversation_id)

        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()

                try:
                    message_data = json.loads(data)
                except json.JSONDecodeError:
                    await websocket.send_json({"error": "Invalid JSON"})
                    continue

                # Handle message types
                message_type = message_data.get("type")

                if message_type == "chat_message":
                    # Save message to database
                    from app.modules.chat.service import ChatService

                    content = message_data.get("content", "").strip()
                    if not content:
                        await websocket.send_json({"error": "Message cannot be empty"})
                        continue

                    # Create message
                    message = ChatService.send_message(
                        db, conversation_uuid, user.id, content
                    )

                    # Broadcast to all users in conversation
                    broadcast_data = {
                        "type": "new_message",
                        "conversation_id": conversation_id,
                        "message": {
                            "id": str(message.id),
                            "content": message.content,
                            "sender_id": str(message.sender_id),
                            "created_at": message.created_at.isoformat()
                            if message.created_at
                            else None,
                        },
                    }
                    await manager.broadcast(conversation_id, broadcast_data)

                elif message_type == "ping":
                    await websocket.send_json(
                        {"type": "pong", "timestamp": message_data.get("timestamp")}
                    )

                else:
                    await websocket.send_json({"error": "Unknown message type"})

        except WebSocketDisconnect:
            manager.disconnect(websocket, conversation_id)
            logger.info(
                f"WebSocket disconnected: user {user.id}, conversation {conversation_id}"
            )
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            manager.disconnect(websocket, conversation_id)

    finally:
        db.close()

