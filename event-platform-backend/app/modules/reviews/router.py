# app/modules/reviews/router.py

from fastapi import APIRouter, Depends, HTTPException      # type: ignore
from sqlalchemy.orm import Session            # type: ignore
from uuid import UUID
from typing import List
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.users.models import User
from .service import ReviewService
from .schemas import ReviewCreate, ReviewResponse

router = APIRouter()


@router.post("/", response_model=ReviewResponse)
def create_review(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return ReviewService.create_review(db, current_user.id, data)


@router.get("/listing/{listing_id}", response_model=List[ReviewResponse])
def get_listing_reviews(listing_id: UUID, db: Session = Depends(get_db)):
    return ReviewService.get_listing_reviews(db, listing_id)


@router.delete("/{review_id}")
def delete_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ReviewService.delete_review(db, review_id, current_user.id)
    return {"message": "Review deleted"}