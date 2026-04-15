# app/modules/reviews/schemas.py

from pydantic import BaseModel, Field                  # type: ignore
from uuid import UUID
from datetime import datetime
from typing import Optional


class ReviewCreate(BaseModel):
    booking_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str]


class ReviewResponse(BaseModel):
    id: UUID
    user_id: UUID
    listing_id: UUID
    booking_id: UUID
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True