# app/modules/chat/service.py

import logging
from uuid import UUID
from fastapi import HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import Tuple, List, Optional

from .repository import ChatRepository
from .models import ChatRoom, Message
from .schemas import ChatRoomCreate

logger = logging.getLogger(__name__)


def _is_chat_participant(db: Session, chat: ChatRoom, user_id: UUID) -> bool:
    """Check if a user is a participant in the chat room.
    Handles the user_id vs vendor_id type mismatch:
    chat.user_id is a User UUID, chat.vendor_id is a Vendor UUID.
    A vendor's user.id != vendor.id, so we must look up the vendor.
    """
    if chat.user_id == user_id:
        return True
    # Check if the user owns the vendor associated with this chat
    from app.modules.vendors.models import Vendor

    vendor = db.query(Vendor).filter(Vendor.id == chat.vendor_id).first()
    return vendor is not None and vendor.user_id == user_id


def _create_notification(
    db: Session,
    user_id: UUID,
    notification_type: str,
    title: str,
    message: str,
    reference_id: UUID = None,
    sender_name: str = "User",
    message_preview: str = None,
):
    """Helper to create notification from chat service."""
    try:
        from app.modules.notifications.trigger import notification_trigger
        import asyncio

        if notification_type == "MESSAGE":
            asyncio.create_task(
                notification_trigger.notify_chat_message(
                    user_id=user_id,
                    chat_id=reference_id,
                    sender_name=sender_name,
                    message_preview=message_preview or message,
                )
            )
            logger.info(
                f"Chat notification triggered for user {user_id}: {sender_name}"
            )
        else:
            asyncio.create_task(
                notification_trigger.send(
                    user_id=user_id,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    reference_id=reference_id,
                )
            )
            logger.info(f"Notification triggered for user {user_id}: {title}")
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")


class ChatService:
    @staticmethod
    def create_or_get_chat_room(
        db: Session,
        user_id: UUID,
        data: ChatRoomCreate,
    ) -> ChatRoom:
        existing = ChatRepository.get_chat_room_by_participants(
            db,
            user_id=user_id,
            vendor_id=data.vendor_id,
            listing_id=data.listing_id,
            booking_id=data.booking_id,
        )

        if existing:
            return existing

        chat_room = ChatRoom(
            user_id=user_id,
            vendor_id=data.vendor_id,
            listing_id=data.listing_id,
            booking_id=data.booking_id,
        )

        return ChatRepository.create_chat_room(db, chat_room)

    @staticmethod
    def get_user_chats(
        db: Session, user_id: UUID, skip: int = 0, limit: int = 20
    ) -> Tuple[List[ChatRoom], int]:
        return ChatRepository.get_user_chat_rooms(db, user_id, skip, limit)

    @staticmethod
    def get_vendor_chats(
        db: Session, vendor_id: UUID, skip: int = 0, limit: int = 20
    ) -> Tuple[List[ChatRoom], int]:
        return ChatRepository.get_vendor_chat_rooms(db, vendor_id, skip, limit)

    @staticmethod
    def get_chat_room(
        db: Session, chat_id: UUID, user_id: UUID = None, vendor_id: UUID = None
    ) -> ChatRoom:
        chat = ChatRepository.get_chat_room_by_id(db, chat_id)

        if not chat:
            raise HTTPException(status_code=404, detail="Chat room not found")

        if user_id and chat.user_id != user_id:
            if vendor_id and chat.vendor_id != vendor_id:
                raise HTTPException(status_code=403, detail="Access denied")

        return chat

    @staticmethod
    def send_message(
        db: Session,
        chat_id: UUID,
        sender_id: UUID,
        content: str,
    ) -> Message:
        # Validate message content
        if not content or not content.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        chat = ChatRepository.get_chat_room_by_id(db, chat_id)

        if not chat:
            raise HTTPException(status_code=404, detail="Chat room not found")

        if not _is_chat_participant(db, chat, sender_id):
            raise HTTPException(status_code=403, detail="Access denied")

        message = Message(
            chat_id=chat_id,
            sender_id=sender_id,
            content=content.strip(),
        )

        created_message = ChatRepository.create_message(db, message)

        # Determine receiver and sender: if sender is the user, notify the vendor's user_id
        from app.modules.vendors.models import Vendor
        from app.modules.users.models import User

        is_sender_user = chat.user_id == sender_id
        if is_sender_user:
            vendor = db.query(Vendor).filter(Vendor.id == chat.vendor_id).first()
            receiver_id = vendor.user_id if vendor else None
            # Get sender name for notification
            sender = db.query(User).filter(User.id == sender_id).first()
            sender_name = sender.full_name if sender and sender.full_name else "User"
            notify_message = content[:100] if content else "You have a new message"
        else:
            receiver_id = chat.user_id
            # Get sender vendor's business name
            vendor = db.query(Vendor).filter(Vendor.id == chat.vendor_id).first()
            sender_name = (
                vendor.business_name if vendor and vendor.business_name else "Vendor"
            )
            notify_message = content[:100] if content else "You have a new message"

        if receiver_id:
            _create_notification(
                db,
                user_id=receiver_id,
                notification_type="MESSAGE",
                title=f"New message from {sender_name}",
                message=notify_message,
                reference_id=chat_id,
                sender_name=sender_name,
                message_preview=notify_message,
            )

        logger.info(f"Message sent in chat {chat_id} by {sender_id}")

        return created_message

    @staticmethod
    def get_messages(
        db: Session,
        chat_id: UUID,
        user_id: UUID,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[List[Message], int]:
        chat = ChatRepository.get_chat_room_by_id(db, chat_id)

        if not chat:
            raise HTTPException(status_code=404, detail="Chat room not found")

        skip = (page - 1) * limit
        return ChatRepository.get_messages(db, chat_id, skip, limit)

    @staticmethod
    def mark_as_read(db: Session, chat_id: UUID, user_id: UUID) -> int:
        chat = ChatRepository.get_chat_room_by_id(db, chat_id)

        if not chat:
            raise HTTPException(status_code=404, detail="Chat room not found")

        if not _is_chat_participant(db, chat, user_id):
            raise HTTPException(status_code=403, detail="Access denied")

        return ChatRepository.mark_messages_as_read(db, chat_id, user_id)

    @staticmethod
    def get_chat_summary(db: Session, chat: ChatRoom, current_user_id: UUID) -> dict:
        last_message = ChatRepository.get_last_message(db, chat.id)
        unread_count = ChatRepository.get_unread_count(db, chat.id, current_user_id)

        return {
            "last_message": last_message.content if last_message else None,
            "unread_count": unread_count,
        }
