# app/modules/payments/models.py

from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from sqlalchemy.dialects.postgresql import UUID  # type: ignore
from app.db.base import Base
import uuid


class PaymentType(str, enum.Enum):
    ADVANCE = "ADVANCE"
    FINAL = "FINAL"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class EscrowStatus(str, enum.Enum):
    HELD = "HELD"
    PARTIALLY_RELEASED = "PARTIALLY_RELEASED"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"
    PENDING = "PENDING"


class PayoutStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"))

    amount = Column(Integer)
    currency = Column(String(3), default="INR", nullable=False)
    payment_type = Column(Enum(PaymentType))
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)

    escrow_status = Column(Enum(EscrowStatus), default=EscrowStatus.HELD)

    vendor_released_amount = Column(Integer, default=0)
    escrow_amount = Column(Integer, default=0)

    razorpay_order_id = Column(String)
    razorpay_payment_id = Column(String)

    payment_link_id = Column(String, nullable=True)
    payment_link_url = Column(String, nullable=True)
    qr_code_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    booking = relationship("Booking", back_populates="payments")


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"))
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)

    vendor_id = Column(UUID(as_uuid=True))
    amount = Column(Integer)
    currency = Column(String(3), default="INR")

    status = Column(Enum(PayoutStatus), default=PayoutStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
