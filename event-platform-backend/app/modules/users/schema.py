# backend/app/modules/users/schemas.py

from pydantic import BaseModel, EmailStr  # type: ignore
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    role: str
    avatar_url: Optional[str]
    fcm_token: Optional[str]
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PublicUserResponse(BaseModel):
    id: UUID
    full_name: Optional[str]
    avatar_url: Optional[str]

    class Config:
        from_attributes = True


class DeviceTokenUpdate(BaseModel):
    device_token: Optional[str] = None
    platform: Optional[str] = "expo"


class DeviceTokenResponse(BaseModel):
    success: bool
    message: str
