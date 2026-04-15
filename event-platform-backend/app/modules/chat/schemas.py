# app/modules/chat/schemas.py

from pydantic import BaseModel  # type: ignore
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class ChatRoomCreate(BaseModel):
    vendor_id: UUID
    listing_id: Optional[UUID] = None
    booking_id: Optional[UUID] = None


class UserSummary(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    email: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class VendorSummary(BaseModel):
    id: UUID
    business_name: str

    class Config:
        from_attributes = True


class ListingSummary(BaseModel):
    id: UUID
    title: str

    class Config:
        from_attributes = True


class ChatRoomResponse(BaseModel):
    id: UUID
    user_id: UUID
    vendor_id: UUID
    listing_id: Optional[UUID] = None
    booking_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: UserSummary
    vendor: VendorSummary
    listing: Optional[ListingSummary] = None
    last_message: Optional[str] = None
    unread_count: int = 0

    class Config:
        from_attributes = True


class PaginatedChatRoomsResponse(BaseModel):
    data: List[ChatRoomResponse]
    total: int
    page: int
    limit: int


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: UUID
    chat_id: UUID
    sender_id: UUID
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedMessagesResponse(BaseModel):
    data: List[MessageResponse]
    total: int
    page: int
    limit: int
