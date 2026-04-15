# app/modules/chat/repository.py

from sqlalchemy.orm import Session, joinedload  # type: ignore
from uuid import UUID
from typing import Tuple, List, Optional
from sqlalchemy import func, or_, and_  # type: ignore
from .models import ChatRoom, Message


class ChatRepository:
    @staticmethod
    def create_chat_room(db: Session, chat_room: ChatRoom) -> ChatRoom:
        db.add(chat_room)
        db.commit()
        db.refresh(chat_room)
        return chat_room

    @staticmethod
    def get_chat_room_by_participants(
        db: Session,
        user_id: UUID,
        vendor_id: UUID,
        listing_id: Optional[UUID] = None,
        booking_id: Optional[UUID] = None,
    ) -> Optional[ChatRoom]:
        query = db.query(ChatRoom).filter(
            ChatRoom.user_id == user_id,
            ChatRoom.vendor_id == vendor_id,
        )

        if listing_id:
            query = query.filter(ChatRoom.listing_id == listing_id)
        elif booking_id:
            query = query.filter(ChatRoom.booking_id == booking_id)
        else:
            query = query.filter(
                ChatRoom.listing_id.is_(None),
                ChatRoom.booking_id.is_(None),
            )

        return query.first()

    @staticmethod
    def get_chat_room_by_id(db: Session, chat_id: UUID) -> Optional[ChatRoom]:
        return (
            db.query(ChatRoom)
            .options(
                joinedload(ChatRoom.user),
                joinedload(ChatRoom.vendor),
                joinedload(ChatRoom.listing),
            )
            .filter(ChatRoom.id == chat_id)
            .first()
        )

    @staticmethod
    def get_user_chat_rooms(
        db: Session, user_id: UUID, skip: int = 0, limit: int = 20
    ) -> Tuple[List[ChatRoom], int]:
        from app.modules.listings.models import Listing

        query = (
            db.query(ChatRoom)
            .options(
                joinedload(ChatRoom.user),
                joinedload(ChatRoom.vendor),
                joinedload(ChatRoom.listing),
            )
            .filter(ChatRoom.user_id == user_id)
        )

        total = query.count()
        rooms = (
            query.order_by(ChatRoom.updated_at.desc().nullslast())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return rooms, total

    @staticmethod
    def get_vendor_chat_rooms(
        db: Session, vendor_id: UUID, skip: int = 0, limit: int = 20
    ) -> Tuple[List[ChatRoom], int]:
        query = (
            db.query(ChatRoom)
            .options(
                joinedload(ChatRoom.user),
                joinedload(ChatRoom.vendor),
                joinedload(ChatRoom.listing),
            )
            .filter(ChatRoom.vendor_id == vendor_id)
        )

        total = query.count()
        rooms = (
            query.order_by(ChatRoom.updated_at.desc().nullslast())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return rooms, total

    @staticmethod
    def create_message(db: Session, message: Message) -> Message:
        db.add(message)

        chat_room = db.query(ChatRoom).filter(ChatRoom.id == message.chat_id).first()
        if chat_room:
            chat_room.updated_at = func.now()

        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def get_messages(
        db: Session, chat_id: UUID, skip: int = 0, limit: int = 50
    ) -> Tuple[List[Message], int]:
        query = db.query(Message).filter(Message.chat_id == chat_id)

        total = query.count()
        messages = (
            query.order_by(Message.created_at.asc()).offset(skip).limit(limit).all()
        )

        return messages, total

    @staticmethod
    def mark_messages_as_read(db: Session, chat_id: UUID, user_id: UUID) -> int:
        result = (
            db.query(Message)
            .filter(
                Message.chat_id == chat_id,
                Message.sender_id != user_id,
                Message.is_read == False,
            )
            .update({"is_read": True}, synchronize_session=False)
        )
        db.commit()
        return result

    @staticmethod
    def get_unread_count(db: Session, chat_id: UUID, user_id: UUID) -> int:
        return (
            db.query(func.count(Message.id))
            .filter(
                Message.chat_id == chat_id,
                Message.sender_id != user_id,
                Message.is_read == False,
            )
            .scalar()
        )

    @staticmethod
    def get_last_message(db: Session, chat_id: UUID) -> Optional[Message]:
        return (
            db.query(Message)
            .filter(Message.chat_id == chat_id)
            .order_by(Message.created_at.desc())
            .first()
        )
