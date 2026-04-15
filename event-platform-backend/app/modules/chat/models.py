# app/modules/chat/models.py

import uuid
import enum
from sqlalchemy import Column, ForeignKey, Enum, DateTime, Text, Boolean, Index  # type: ignore
from sqlalchemy.dialects.postgresql import UUID  # type: ignore
from sqlalchemy.orm import relationship  # type: ignore
from sqlalchemy.sql import func  # type: ignore
from app.db.base import Base


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    vendor_id = Column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True
    )
    listing_id = Column(
        UUID(as_uuid=True), ForeignKey("listings.id"), nullable=True, index=True
    )
    booking_id = Column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True, index=True
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chat_rooms")
    vendor = relationship("Vendor", back_populates="chat_rooms")
    listing = relationship("Listing")
    booking = relationship("Booking", back_populates="chat_rooms")
    messages = relationship(
        "Message", back_populates="chat_room", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    chat_id = Column(
        UUID(as_uuid=True), ForeignKey("chat_rooms.id"), nullable=False, index=True
    )
    sender_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chat_room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

    __table_args__ = (Index("ix_messages_chat_created", "chat_id", "created_at"),)
