# app/modules/bookings/repository.py

from sqlalchemy.orm import Session, joinedload, contains_eager  # type: ignore
from uuid import UUID
from typing import Tuple, List
from .models import Booking


class BookingRepository:
    @staticmethod
    def create(db: Session, booking: Booking):
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking

    @staticmethod
    def get_by_id(db: Session, booking_id: UUID):
        return (
            db.query(Booking)
            .options(joinedload(Booking.user), joinedload(Booking.listing))
            .filter(Booking.id == booking_id)
            .first()
        )

    @staticmethod
    def get_user_bookings(db: Session, user_id: UUID):
        return (
            db.query(Booking)
            .options(joinedload(Booking.listing))
            .filter(Booking.user_id == user_id)
            .all()
        )

    @staticmethod
    def get_vendor_bookings(
        db: Session, vendor_id: UUID, skip: int = 0, limit: int = 20
    ) -> Tuple[List[Booking], int]:
        from app.modules.listings.models import Listing

        query = (
            db.query(Booking)
            .join(Booking.listing)
            .options(joinedload(Booking.user), joinedload(Booking.listing))
            .filter(Listing.vendor_id == vendor_id)
        )

        total = query.count()
        bookings = (
            query.order_by(Booking.created_at.desc()).offset(skip).limit(limit).all()
        )

        return bookings, total

    @staticmethod
    def update(db: Session, booking: Booking):
        db.commit()
        db.refresh(booking)
        return booking
