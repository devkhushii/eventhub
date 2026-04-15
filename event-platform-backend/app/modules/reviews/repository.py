# app/modules/reviews/repository.py

from sqlalchemy.orm import Session             # type: ignore
from uuid import UUID
from .models import Review


class ReviewRepository:

    @staticmethod
    def create(db: Session, review: Review):
        db.add(review)
        db.commit()
        db.refresh(review)
        return review

    @staticmethod
    def get_by_booking(db: Session, booking_id: UUID):
        return db.query(Review).filter(Review.booking_id == booking_id).first()

    @staticmethod
    def get_listing_reviews(db: Session, listing_id: UUID):
        return db.query(Review).filter(Review.listing_id == listing_id).all()

    @staticmethod
    def delete(db: Session, review: Review):
        db.delete(review)
        db.commit()