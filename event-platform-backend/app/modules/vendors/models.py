# app/modules/vendors/models.py

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, Enum, Text  # type: ignore

from sqlalchemy.dialects.postgresql import UUID  # type: ignore
from sqlalchemy.orm import relationship  # type: ignore
from sqlalchemy.sql import func  # type: ignore
import uuid
import enum

from app.db.base import Base


class VendorType(str, enum.Enum):
    INDIVIDUAL = "individual"
    MANAGER = "manager"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )

    vendor_type = Column(Enum(VendorType), nullable=False)

    business_name = Column(String, nullable=False)
    description = Column(Text)

    verification_status = Column(
        Enum(VerificationStatus), default=VerificationStatus.PENDING
    )

    rejection_reason = Column(Text, nullable=True)

    rating = Column(Float, default=0.0)
    total_reviews = Column(Float, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="vendor")
    listings = relationship("Listing", back_populates="vendor")
    chat_rooms = relationship("ChatRoom", back_populates="vendor")
