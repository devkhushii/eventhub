# app/modules/reviews/models.py

import uuid
from sqlalchemy import Column, ForeignKey, Integer, Text, DateTime, UniqueConstraint      # type: ignore
from sqlalchemy.dialects.postgresql import UUID                                            # type: ignore
from sqlalchemy.orm import relationship                                                 # type: ignore
from sqlalchemy.sql import func                                                          # type: ignore
from app.db.base import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)

    rating = Column(Integer, nullable=False)  # 1 to 5
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("booking_id", name="unique_booking_review"),
    )

    user = relationship("User")
    listing = relationship("Listing")
    booking = relationship("Booking")