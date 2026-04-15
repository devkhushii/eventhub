# backend/app/modules/users/models.py

from sqlalchemy import Column, String, Boolean, DateTime  # type: ignore
from sqlalchemy.dialects.postgresql import UUID  # type: ignore
from sqlalchemy.orm import relationship  # type: ignore
from sqlalchemy.sql import func  # type: ignore
import uuid
from datetime import datetime, timezone

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    avatar_url = Column(String, nullable=True)

    # Push notification tokens
    fcm_token = Column(String, nullable=True, index=True)
    device_token = Column(String, nullable=True)
    expo_push_token = Column(String, nullable=True, index=True)

    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    role = Column(String, default="CUSTOMER")
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    refresh_tokens = relationship("RefreshToken", back_populates="user")
    vendor = relationship("Vendor", back_populates="user", uselist=False)
    bookings = relationship("Booking", back_populates="user")
    chat_rooms = relationship("ChatRoom", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
