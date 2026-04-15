# app/modules/bookings/models.py


import uuid
import enum
from sqlalchemy import Column, ForeignKey, DateTime, Float, String, Text, Boolean
from sqlalchemy import Enum as SQLEnum

from sqlalchemy.dialects.postgresql import UUID  # type: ignore
from sqlalchemy.orm import relationship  # type: ignore
from sqlalchemy.sql import func  # type: ignore
from app.db.base import Base



class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    AWAITING_ADVANCE = "AWAITING_ADVANCE"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    AWAITING_FINAL_PAYMENT = "AWAITING_FINAL_PAYMENT"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class AdvancePaymentStatus(str, enum.Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    listing_id = Column(
        UUID(as_uuid=True), ForeignKey("listings.id"), nullable=False, index=True
    )

    event_date = Column(DateTime, nullable=False, index=True)
    end_date = Column(DateTime, nullable=True)

    total_price = Column(Float, nullable=False)
    status = Column(
                SQLEnum(BookingStatus, name="booking_status_enum"),
                default=BookingStatus.PENDING,
                index=True
            )

    advance_amount = Column(Float, nullable=True)
    advance_paid = Column(Boolean, default=False)
    advance_payment_status = Column(
                                SQLEnum(AdvancePaymentStatus, name="advance_payment_status_enum"),
                                default=AdvancePaymentStatus.NONE
                                )

    special_request = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="bookings")
    payments = relationship("Payment", back_populates="booking")
    listing = relationship("Listing")
    chat_rooms = relationship("ChatRoom", back_populates="booking")
