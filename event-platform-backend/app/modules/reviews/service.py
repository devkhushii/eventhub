# app/modules/reviews/service.py

from sqlalchemy.orm import Session                  # type: ignore
from uuid import UUID
from fastapi import HTTPException              # type: ignore
from .repository import ReviewRepository
from .models import Review
from app.modules.bookings.repository import BookingRepository
from app.modules.bookings.models import BookingStatus
from app.modules.listings.repository import ListingRepository
from app.modules.vendors.repository import VendorRepository


class ReviewService:

    @staticmethod
    def create_review(db: Session, user_id: UUID, data):

        booking = BookingRepository.get_by_id(db, data.booking_id)

        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        if booking.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not your booking")

        if booking.status != BookingStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Booking not completed")

        existing = ReviewRepository.get_by_booking(db, data.booking_id)
        if existing:
            raise HTTPException(status_code=400, detail="Review already exists")

        review = Review(
            user_id=user_id,
            listing_id=booking.listing_id,
            booking_id=data.booking_id,
            rating=data.rating,
            comment=data.comment
        )

        created_review = ReviewRepository.create(db, review)

        # Update vendor rating
        ReviewService.update_vendor_rating(db, booking.listing_id)

        return created_review

    @staticmethod
    def update_vendor_rating(db: Session, listing_id: UUID):

        listing = ListingRepository.get_by_id(db, listing_id)
        reviews = ReviewRepository.get_listing_reviews(db, listing_id)

        if not reviews:
            return

        avg_rating = sum(r.rating for r in reviews) / len(reviews)

        vendor = VendorRepository.get_by_id(db, listing.vendor_id)

        vendor.rating = round(avg_rating, 2)
        vendor.total_reviews = len(reviews)

        db.commit()

    @staticmethod
    def get_listing_reviews(db: Session, listing_id: UUID):
        return ReviewRepository.get_listing_reviews(db, listing_id)

    @staticmethod
    def delete_review(db: Session, review_id: UUID, user_id: UUID):
        review = db.query(Review).filter(Review.id == review_id).first()
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        if review.user_id != user_id:
            raise HTTPException(status_code=403, detail="You can only delete your own reviews")

        ReviewRepository.delete(db, review)