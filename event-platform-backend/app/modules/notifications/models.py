# app/modules/notifications/models.py

import uuid
import enum
from sqlalchemy import Column, ForeignKey, Boolean, DateTime, String, Enum  # type: ignore
from sqlalchemy.dialects.postgresql import UUID  # type: ignore
from sqlalchemy.orm import relationship  # type: ignore
from sqlalchemy.sql import func  # type: ignore
from app.db.base import Base


class NotificationType(str, enum.Enum):
    MESSAGE = "MESSAGE"
    BOOKING = "BOOKING"
    PAYMENT = "PAYMENT"
    SYSTEM = "SYSTEM"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    type = Column(
        Enum(NotificationType), default=NotificationType.SYSTEM, nullable=False
    )
    reference_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    message = Column(String, nullable=False)

    is_read = Column(Boolean, default=False, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")
