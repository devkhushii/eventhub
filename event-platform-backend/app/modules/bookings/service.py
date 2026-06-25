# app/modules/bookings/service.py

import logging
from sqlalchemy.orm import Session  # type: ignore
from uuid import UUID
from fastapi import HTTPException  # type: ignore
from datetime import datetime, timedelta
from typing import Tuple, List
from .repository import BookingRepository
from .models import Booking, BookingStatus
from .schemas import BOOKING_TRANSITIONS
from app.modules.listings.repository import ListingRepository
from app.modules.listings.models import ListingStatus, Listing
from fastapi import HTTPException, BackgroundTasks

logger = logging.getLogger(__name__)


class BookingService:
    @staticmethod
    def create_booking(db: Session, user_id: UUID, data, background_tasks: BackgroundTasks = None):
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
                        BookingStatus.AWAITING_FINAL_PAYMENT,
                        BookingStatus.COMPLETED,
                    ]
                ),
            )
            .first()
        )

        if existing:
            raise HTTPException(status_code=400, detail="Already booked for this date")

        print(f"[Bookings] DEBUG: listing.price={listing.price}, data.event_date={data.event_date}, data.end_date={data.end_date}")
        print(f"[Bookings] DEBUG: end_date type={type(data.end_date)}, end_date is None={data.end_date is None}")
        
        if data.end_date:
            total_days = (data.end_date.date() - data.event_date.date()).days + 1
        else:
            total_days = 1
        
        print(f"[Bookings] DEBUG: calculated total_days={total_days}, FORCE TO at least 1")

        # Ensure total_days is at least 1 (handles edge cases)
        if not total_days or total_days < 1:
            total_days = 1

        total_price = listing.price * total_days
        advance_amount = data.advance_amount or (total_price * 0.3)

        print(
            f"[Bookings] Creating booking: listing.price={listing.price}, total_days={total_days}, total_price={total_price}, advance_amount={advance_amount}"
        )

        booking = Booking(
            user_id=user_id,
            listing_id=data.listing_id,
            event_date=data.event_date,
            end_date=data.end_date,
            total_days=total_days,
            total_price=total_price,
            special_request=data.special_request,
            advance_amount=advance_amount,
            status=BookingStatus.PENDING,
        )

        created_booking = BookingRepository.create(db, booking)

        print(
            f"[Bookings] Returning booking: id={created_booking.id}, total_price={created_booking.total_price}, total_days={created_booking.total_days}"
        )

        # Notify vendor of new booking request
        vendor_id = listing.vendor_id if listing else None
        if vendor_id and background_tasks:
            from app.modules.notifications.trigger import notification_trigger
            from app.modules.vendors.models import Vendor
            vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
            vendor_user_id = vendor.user_id if vendor else None
            if vendor_user_id:
                background_tasks.add_task(
                    notification_trigger.notify_new_booking_request_sync,
                    user_id=vendor_user_id,
                    booking_id=created_booking.id,
                    listing_title=listing.title,
                )
                logger.info(f"[Bookings] Queued new booking notification for vendor user_id={vendor_user_id}")

        return created_booking

    @staticmethod
    def update_status(
        db: Session, booking_id: UUID, new_status: BookingStatus, background_tasks: BackgroundTasks = None, user_id: UUID = None
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

        # Map cancellation request based on whether advance payment is completed
        if new_status in (BookingStatus.CANCELLED, BookingStatus.CANCELLATION_REQUESTED) and booking.advance_paid:
            new_status = BookingStatus.CANCELLATION_REQUESTED
        elif new_status == BookingStatus.CANCELLATION_REQUESTED and not booking.advance_paid:
            new_status = BookingStatus.CANCELLED

        allowed = BOOKING_TRANSITIONS.get(current_status, [])

        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status.value} to {new_status.value}",
            )

        listing = db.query(Listing).filter(Listing.id == booking.listing_id).first()
        listing_title = listing.title if listing else "Your booking"

        if new_status == BookingStatus.APPROVED:
            booking.status = BookingStatus.AWAITING_ADVANCE
            
            from app.core.config import settings
            import datetime
            booking.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=settings.ADVANCE_PAYMENT_WINDOW_HOURS)

            logger.info(
                f"[Bookings] [AWAITING_ADVANCE] booking_id={booking.id}, "
                f"expires_at={booking.expires_at}, advance_amount={booking.advance_amount}, "
                f"total_price={booking.total_price}"
            )

            # Send approval notification to customer via BackgroundTasks
            if background_tasks:
                from app.modules.notifications.trigger import notification_trigger
                background_tasks.add_task(
                    notification_trigger.notify_booking_approved_sync,
                    user_id=booking.user_id,
                    booking_id=booking.id,
                    listing_title=listing_title,
                )
                logger.info(f"[Bookings] Queued approval notification for user {booking.user_id}")
            
            # Schedule auto-expiry
            try:
                from app.modules.tasks import expire_unpaid_advance_booking_task
                expire_unpaid_advance_booking_task.apply_async(
                    (str(booking.id),), 
                    countdown=settings.ADVANCE_PAYMENT_WINDOW_HOURS * 3600
                )
                logger.info(f"[Bookings] Scheduled auto-expiry task for booking {booking.id}")
            except Exception as e:
                logger.error(f"[Bookings] Failed to schedule auto-expiry: {e}")

        elif new_status == BookingStatus.CANCELLATION_REQUESTED:
            booking.status = BookingStatus.CANCELLATION_REQUESTED
            logger.info(
                f"[Bookings] [CANCELLATION_REQUESTED] booking_id={booking.id}, "
                f"advance_paid={booking.advance_paid}, advance_amount={booking.advance_amount}"
            )
            
            # Notify vendor that customer requested cancellation
            if background_tasks:
                from app.modules.notifications.trigger import notification_trigger
                from app.modules.vendors.models import Vendor
                vendor = db.query(Vendor).filter(Vendor.id == listing.vendor_id).first() if listing else None
                vendor_user_id = vendor.user_id if vendor else None
                
                # Get customer name
                from app.modules.users.models import User
                customer = db.query(User).filter(User.id == booking.user_id).first()
                customer_name = customer.full_name if customer else "Customer"
                
                if vendor_user_id:
                    background_tasks.add_task(
                        notification_trigger.notify_cancellation_requested_sync,
                        vendor_user_id=vendor_user_id,
                        booking_id=booking.id,
                        listing_title=listing_title,
                        customer_name=customer_name,
                    )
                    logger.info(f"[Bookings] Queued cancellation request notification for vendor user_id={vendor_user_id}")

        elif new_status == BookingStatus.CANCELLED:
            booking.status = BookingStatus.CANCELLED
            booking.expires_at = None
            logger.info(f"[Bookings] [CANCELLED] booking_id={booking.id}")
            
            # Notify vendor that customer cancelled (no advance was paid)
            if background_tasks:
                from app.modules.notifications.trigger import notification_trigger
                from app.modules.vendors.models import Vendor
                vendor = db.query(Vendor).filter(Vendor.id == listing.vendor_id).first() if listing else None
                vendor_user_id = vendor.user_id if vendor else None
                if vendor_user_id:
                    background_tasks.add_task(
                        notification_trigger.notify_booking_cancelled_sync,
                        user_id=vendor_user_id,
                        booking_id=booking.id,
                        listing_title=listing_title,
                        cancelled_by="customer",
                    )

        else:
            booking.status = new_status
            if new_status in (BookingStatus.CONFIRMED, BookingStatus.REJECTED):
                booking.expires_at = None

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
        db: Session, vendor_id: UUID, booking_id: UUID, new_status: BookingStatus, background_tasks: BackgroundTasks = None
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
        listing_title = listing.title if listing else "Your booking"

        # Vendor cancellation mapping
        if new_status in (BookingStatus.CANCELLED, BookingStatus.CANCELLATION_REQUESTED):
            if booking.advance_paid:
                # Vendor cancels with advance paid → auto-refund 100%
                logger.info(
                    f"[Bookings] [VENDOR_CANCEL] Advance paid, initiating auto-refund. "
                    f"booking_id={booking.id}, advance_amount={booking.advance_amount}"
                )
                from app.modules.payments.service import PaymentService
                try:
                    advance_payment = PaymentService.process_vendor_cancellation_refund(
                        db, booking_id, vendor_id
                    )
                    # Booking is now CANCELLED (set inside process_vendor_cancellation_refund)
                    logger.info(
                        f"[Bookings] [VENDOR_CANCEL] Auto-refund completed. "
                        f"refunded_amount={advance_payment.refunded_amount}, "
                        f"booking_status={booking.status}"
                    )
                    
                    # Notify customer about vendor cancellation with refund
                    if background_tasks:
                        from app.modules.notifications.trigger import notification_trigger
                        background_tasks.add_task(
                            notification_trigger.notify_vendor_cancelled_by_vendor_sync,
                            customer_user_id=booking.user_id,
                            booking_id=booking.id,
                            listing_title=listing_title,
                            refund_amount=advance_payment.refunded_amount or 0,
                        )
                    
                    return BookingRepository.update(db, booking)
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"[Bookings] [VENDOR_CANCEL] Auto-refund failed: {e}")
                    raise HTTPException(status_code=500, detail=f"Vendor cancellation refund failed: {str(e)}")
            else:
                new_status = BookingStatus.CANCELLED

        allowed = BOOKING_TRANSITIONS.get(current_status, [])

        if new_status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {current_status.value} to {new_status.value}",
            )

        if new_status == BookingStatus.APPROVED:
            booking.status = BookingStatus.AWAITING_ADVANCE
            
            from app.core.config import settings
            import datetime
            booking.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=settings.ADVANCE_PAYMENT_WINDOW_HOURS)
            
            logger.info(
                f"[Bookings] [VENDOR_APPROVE → AWAITING_ADVANCE] booking_id={booking.id}, "
                f"expires_at={booking.expires_at}, advance_amount={booking.advance_amount}"
            )
            
            # Notify customer via BackgroundTasks (sync method)
            if background_tasks:
                from app.modules.notifications.trigger import notification_trigger
                background_tasks.add_task(
                    notification_trigger.notify_booking_approved_sync,
                    user_id=booking.user_id,
                    booking_id=booking.id,
                    listing_title=listing_title,
                )
                logger.info(f"[Bookings] Queued approval notification for customer user_id={booking.user_id}")
            
            # Schedule auto-expiry
            try:
                from app.modules.tasks import expire_unpaid_advance_booking_task
                expire_unpaid_advance_booking_task.apply_async(
                    (str(booking.id),), 
                    countdown=settings.ADVANCE_PAYMENT_WINDOW_HOURS * 3600
                )
                logger.info(f"[Bookings] Scheduled auto-expiry task for booking {booking.id}")
            except Exception as e:
                logger.error(f"[Bookings] Vendor approval auto-expiry task error: {e}")

        elif new_status == BookingStatus.REJECTED:
            booking.status = BookingStatus.REJECTED
            booking.expires_at = None
            logger.info(f"[Bookings] [REJECTED] booking_id={booking.id}")
            
            # Notify customer about rejection
            if background_tasks:
                from app.modules.notifications.trigger import notification_trigger
                background_tasks.add_task(
                    notification_trigger.notify_booking_cancelled_sync,
                    user_id=booking.user_id,
                    booking_id=booking.id,
                    listing_title=listing_title,
                    cancelled_by="vendor",
                )

        elif new_status == BookingStatus.CANCELLED:
            booking.status = BookingStatus.CANCELLED
            booking.expires_at = None
            logger.info(f"[Bookings] [VENDOR_CANCELLED] booking_id={booking.id}")
            
            # Notify customer about vendor cancellation (no advance paid)
            if background_tasks:
                from app.modules.notifications.trigger import notification_trigger
                background_tasks.add_task(
                    notification_trigger.notify_vendor_cancelled_by_vendor_sync,
                    customer_user_id=booking.user_id,
                    booking_id=booking.id,
                    listing_title=listing_title,
                    refund_amount=0,
                )

        else:
            booking.status = new_status
            if new_status == BookingStatus.CONFIRMED:
                booking.expires_at = None

        return BookingRepository.update(db, booking)

    @staticmethod
    def vendor_reject_cancellation(
        db: Session, vendor_id: UUID, booking_id: UUID, background_tasks: BackgroundTasks = None
    ) -> Booking:
        """Vendor rejects customer's cancellation request. Booking returns to CONFIRMED."""
        booking = BookingRepository.get_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        listing = db.query(Listing).filter(Listing.id == booking.listing_id).first()
        if not listing or listing.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        if booking.status != BookingStatus.CANCELLATION_REQUESTED:
            raise HTTPException(
                status_code=400,
                detail=f"Booking must be in CANCELLATION_REQUESTED status. Current: {booking.status.value}",
            )

        # Restore to CONFIRMED (since advance was paid)
        booking.status = BookingStatus.CONFIRMED
        listing_title = listing.title if listing else "Your booking"

        logger.info(
            f"[Bookings] [CANCELLATION_REJECTED] booking_id={booking.id}, "
            f"restored to CONFIRMED"
        )

        # Notify customer that cancellation was rejected
        if background_tasks:
            from app.modules.notifications.trigger import notification_trigger
            background_tasks.add_task(
                notification_trigger.notify_cancellation_rejected_sync,
                customer_user_id=booking.user_id,
                booking_id=booking.id,
                listing_title=listing_title,
            )
            logger.info(f"[Bookings] Queued cancellation rejection notification for customer user_id={booking.user_id}")

        return BookingRepository.update(db, booking)
