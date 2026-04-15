# app/modules/notifications/websocket_manager.py

import logging
import json
from typing import Dict, Set
from fastapi import WebSocket
from uuid import UUID

logger = logging.getLogger(__name__)


class NotificationWebSocketManager:
    """Manages WebSocket connections for real-time notifications per user."""

    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """Connect a user's WebSocket for notifications."""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

        logger.info(
            f"[WS Notification] User {user_id} connected. Active: {len(self.active_connections[user_id])}"
        )

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Disconnect a user's WebSocket."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"[WS Notification] User {user_id} disconnected")

    async def send_notification(self, user_id: str, notification: dict):
        """Send notification to specific user."""
        if user_id not in self.active_connections:
            logger.info(
                f"[WS Notification] User {user_id} not connected, skipping real-time"
            )
            return

        disconnected = set()

        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(
                    {"type": "notification", "data": notification}
                )
                logger.info(f"[WS Notification] Sent to user {user_id}")
            except Exception as e:
                logger.error(f"[WS Notification] Failed to send: {e}")
                disconnected.add(connection)

        for conn in disconnected:
            self.active_connections[user_id].discard(conn)

    async def broadcast(self, notification: dict, user_ids: list):
        """Broadcast notification to multiple users."""
        for user_id in user_ids:
            await self.send_notification(str(user_id), notification)

    def is_user_connected(self, user_id: str) -> bool:
        """Check if user has active WebSocket connection."""
        return (
            user_id in self.active_connections
            and len(self.active_connections[user_id]) > 0
        )

    def get_connected_count(self) -> int:
        """Get count of connected users."""
        return len(self.active_connections)


notification_manager = NotificationWebSocketManager()
