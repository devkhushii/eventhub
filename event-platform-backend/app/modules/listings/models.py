# app/modules/listings/models.py

import enum
import uuid
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Float, Enum, DateTime  # type: ignore
from sqlalchemy.dialects.postgresql import UUID, JSONB  # type: ignore
from sqlalchemy.orm import relationship  # type: ignore
from sqlalchemy.sql import func  # type: ignore
from app.db.base import Base


class ListingType(str, enum.Enum):
    VENUE = "VENUE"
    DJ = "DJ"
    CATERER = "CATERER"
    DECORATOR = "DECORATOR"
    PHOTOGRAPHER = "PHOTOGRAPHER"
    EVENT_MANAGER = "EVENT_MANAGER"
    OTHER = "OTHER"


class ListingStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Listing(Base):
    __tablename__ = "listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True
    )

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    listing_type = Column(Enum(ListingType), nullable=False, index=True)

    price = Column(Float, nullable=False)
    location = Column(String(255), nullable=True, index=True)

    start_date = Column(DateTime(timezone=True), nullable=True, index=True)
    end_date = Column(DateTime(timezone=True), nullable=True, index=True)

    # ⭐ dynamic listing fields
    details = Column(JSONB, nullable=True)

    status = Column(Enum(ListingStatus), default=ListingStatus.DRAFT, index=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vendor = relationship("Vendor", back_populates="listings")

    images = relationship(
        "ListingImage", back_populates="listing", cascade="all, delete-orphan"
    )


class ListingImage(Base):
    __tablename__ = "listing_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id"))

    image_url = Column(String, nullable=False)

    listing = relationship("Listing", back_populates="images")
