# app/modules/notifications/schemas.py

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field
from enum import Enum


class NotificationTypeEnum(str, Enum):
    MESSAGE = "MESSAGE"
    BOOKING = "BOOKING"
    PAYMENT = "PAYMENT"
    SYSTEM = "SYSTEM"


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: NotificationTypeEnum
    reference_id: Optional[UUID] = None
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    user_id: UUID
    type: NotificationTypeEnum = NotificationTypeEnum.SYSTEM
    reference_id: Optional[UUID] = None
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)


class NotificationUpdate(BaseModel):
    is_read: bool


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int


class ExpoTokenRegister(BaseModel):
    expo_push_token: str = Field(
        ..., description="Expo push token starting with 'ExponentPushToken['"
    )


class MarkAllReadResponse(BaseModel):
    message: str
    count: int
