# app/modules/bookings/service.py

from sqlalchemy.orm import Session  # type: ignore
from uuid import UUID
from fastapi import HTTPException  # type: ignore
from datetime import datetime
from typing import Tuple, List
from .repository import BookingRepository
from .models import Booking, BookingStatus
from .schemas import BOOKING_TRANSITIONS
from app.modules.listings.repository import ListingRepository
from app.modules.listings.models import ListingStatus, Listing


class BookingService:
    @staticmethod
    def create_booking(db: Session, user_id: UUID, data):

        listing = (
            db.query(Listing)
            .filter(Listing.id == data.listing_id)
            .with_for_update()
            .first()
        )
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if listing.status != ListingStatus.PUBLISHED:
            raise HTTPException(status_code=403, detail="Listing not available")

        if data.end_date and data.end_date <= data.event_date:
            raise HTTPException(status_code=400, detail="Invalid date range")

        existing = (
            db.query(Booking)
            .filter(
                Booking.listing_id == data.listing_id,
                Booking.event_date == data.event_date,
                Booking.status.in_(
                    [
                        BookingStatus.CONFIRMED,
                        BookingStatus.PENDING,
                        BookingStatus.AWAITING_ADVANCE,
                    ]
                ),
            )
            .first()
        )

        if existing:
            raise HTTPException(status_code=400, detail="Already booked for this date")

        advance_amount = data.advance_amount or (listing.price * 0.3)

        booking = Booking(
            user_id=user_id,
            listing_id=data.listing_id,
            event_date=data.event_date,
            end_date=data.end_date,
            total_price=listing.price,
            special_request=data.special_request,
            advance_amount=advance_amount,
            status=BookingStatus.PENDING,
        )

        created_booking = BookingRepository.create(db, booking)

        from app.modules.notifications.trigger import notification_trigger
       
        vendor_id = listing.vendor.user_id if listing.vendor else None
        if vendor_id:
            import asyncio

            try:
                asyncio.create_task(
                    notification_trigger.notify_booking_created(
                        vendor_id=vendor_id,
                        user_id=user_id,
                        booking_id=created_booking.id,
                        listing_title=listing.title,
                    )
                )
            except Exception as e:
                print(f"[Bookings] Notification trigger error: {e}")

        return created_booking

    @staticmethod
    def update_status(
        db: Session, booking_id: UUID, new_status: BookingStatus, user_id: UUID = None
    ) -> Booking:

        booking = BookingRepository.get_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        # Validate ownership: user can only update their own bookings
        if user_id and booking.user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to update this booking",
            )

        current_status = booking.status
        allowed = BOOKING_TRANSITIONS.get(current_status, [])

        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status.value} to {new_status.value}",
            )

        if new_status == BookingStatus.APPROVED:
            booking.status = BookingStatus.AWAITING_ADVANCE

            from app.modules.notifications.trigger import notification_trigger
            import asyncio

            try:
                listing = (
                    db.query(Listing).filter(Listing.id == booking.listing_id).first()
                )
                asyncio.create_task(
                    notification_trigger.notify_booking_approved(
                        user_id=booking.user_id,
                        booking_id=booking.id,
                        listing_title=listing.title if listing else "Your booking",
                    )
                )
            except Exception as e:
                print(f"[Bookings] Approval notification error: {e}")
        else:
            booking.status = new_status

        return BookingRepository.update(db, booking)

    @staticmethod
    def confirm_advance_payment(db: Session, booking_id: UUID) -> Booking:
        booking = BookingRepository.get_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        booking.status = BookingStatus.CONFIRMED

        return BookingRepository.update(db, booking)

    @staticmethod
    def get_user_bookings(db: Session, user_id: UUID):
        return BookingRepository.get_user_bookings(db, user_id)

    @staticmethod
    def get_vendor_bookings(
        db: Session, vendor_id: UUID, skip: int = 0, limit: int = 20
    ) -> Tuple[List[Booking], int]:
        return BookingRepository.get_vendor_bookings(db, vendor_id, skip, limit)

    @staticmethod
    def vendor_update_booking_status(
        db: Session, vendor_id: UUID, booking_id: UUID, new_status: BookingStatus
    ) -> Booking:

        booking = BookingRepository.get_by_id(db, booking_id)

        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        listing = db.query(Listing).filter(Listing.id == booking.listing_id).first()

        if not listing or listing.vendor_id != vendor_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to update this booking"
            )

        current_status = booking.status

        allowed = BOOKING_TRANSITIONS.get(current_status, [])

        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status.value} to {new_status.value}",
            )

        if new_status == BookingStatus.APPROVED:
            booking.status = BookingStatus.AWAITING_ADVANCE
        elif new_status == BookingStatus.REJECTED:
            booking.status = BookingStatus.REJECTED
        else:
            booking.status = new_status

        return BookingRepository.update(db, booking)
