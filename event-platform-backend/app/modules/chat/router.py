# app/modules/chat/router.py

from fastapi import APIRouter, Depends, Query  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from uuid import UUID
from typing import Optional

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.users.models import User
from app.modules.vendors.dependencies import require_vendor
from app.modules.vendors.models import Vendor

from .service import ChatService
from .schemas import (
    ChatRoomCreate,
    ChatRoomResponse,
    PaginatedChatRoomsResponse,
    MessageCreate,
    MessageResponse,
    PaginatedMessagesResponse,
)


router = APIRouter()


@router.post("", response_model=ChatRoomResponse)
def create_or_get_chat(
    data: ChatRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print("[Chat API] POST /chats - create_or_get_chat called")
    chat = ChatService.create_or_get_chat_room(db, current_user.id, data)
    return ChatRoomResponse.model_validate(chat)


@router.get("", response_model=PaginatedChatRoomsResponse)
def get_my_chats(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print("[Chat API] GET /chats - get_my_chats called")
    skip = (page - 1) * limit
    chats, total = ChatService.get_user_chats(db, current_user.id, skip, limit)

    data = []
    for chat in chats:
        chat_resp = ChatRoomResponse.model_validate(chat)
        summary = ChatService.get_chat_summary(db, chat, current_user.id)
        chat_resp.last_message = summary["last_message"]
        chat_resp.unread_count = summary["unread_count"]
        data.append(chat_resp)

    return PaginatedChatRoomsResponse(data=data, total=total, page=page, limit=limit)


@router.get("/vendor", response_model=PaginatedChatRoomsResponse)
def get_vendor_chats(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    vendor: Vendor = Depends(require_vendor),
):
    skip = (page - 1) * limit
    chats, total = ChatService.get_vendor_chats(db, vendor.id, skip, limit)

    data = []
    for chat in chats:
        chat_resp = ChatRoomResponse.model_validate(chat)
        summary = ChatService.get_chat_summary(db, chat, vendor.id)
        chat_resp.last_message = summary["last_message"]
        chat_resp.unread_count = summary["unread_count"]
        data.append(chat_resp)

    return PaginatedChatRoomsResponse(data=data, total=total, page=page, limit=limit)


@router.get("/{chat_id}/messages", response_model=PaginatedMessagesResponse)
def get_messages(
    chat_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages, total = ChatService.get_messages(
        db, chat_id, current_user.id, page, limit
    )

    return PaginatedMessagesResponse(
        data=[MessageResponse.model_validate(m) for m in messages],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("/{chat_id}/messages", response_model=MessageResponse)
def send_message(
    chat_id: UUID,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = ChatService.send_message(db, chat_id, current_user.id, data.content)
    return MessageResponse.model_validate(message)


@router.post("/{chat_id}/read")
def mark_as_read(
    chat_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = ChatService.mark_as_read(db, chat_id, current_user.id)
    return {"marked_read": count}
