# app/modules/payments/service.py
import logging
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException  # type: ignore

from app.modules.bookings.repository import BookingRepository
from app.modules.bookings.models import BookingStatus
from .repository import PaymentRepository, PayoutRepository
from .models import (
    Payment,
    PaymentStatus,
    PaymentType,
    EscrowStatus,
    Payout,
    PayoutStatus,
)
from .utils import create_order, create_payment_link, verify_signature, refund_payment
from .constant import ADVANCE_PERCENTAGE, ADVANCE_TO_VENDOR_PERCENT, PLATFORM_COMMISSION

logger = logging.getLogger(__name__)

CURRENCY = "INR"


class PaymentService:
    @staticmethod
    def _validate_booking_for_payment(
        db: Session, booking, user_id: UUID, payment_type: str
    ):
        """Validate booking ownership and status before payment."""

        # Check booking belongs to current user
        if booking.user_id != user_id:
            logger.warning(
                f"User {user_id} tried to pay for booking {booking.id} owned by {booking.user_id}"
            )
            raise HTTPException(
                status_code=403,
                detail="You are not authorized to make payment for this booking",
            )

        # Validate booking status based on payment type
        if payment_type == "ADVANCE":
            if booking.status not in [BookingStatus.AWAITING_ADVANCE]:
                logger.warning(
                    f"Cannot create advance payment: booking status is {booking.status}"
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid booking status for advance payment. Current status: {booking.status.value}",
                )
        elif payment_type == "FINAL":
            if booking.status != BookingStatus.AWAITING_FINAL_PAYMENT:
                logger.warning(
                    f"Cannot create final payment: booking status is {booking.status}"
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid booking status for final payment. Current status: {booking.status.value}",
                )

    @staticmethod
    def _check_duplicate_payment(db: Session, booking_id: UUID, payment_type: str):
        """Check for duplicate payment intent - prevents race conditions."""
        existing = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.payment_type == PaymentType[payment_type],
                Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.SUCCESS]),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A {payment_type.lower()} payment already exists for this booking. Please use existing payment.",
            )

    @staticmethod
    def _validate_payment_sequence(db: Session, booking, payment_type: str):
        """Validate payment sequence (ADVANCE must come before FINAL)."""

        # Check if advance already completed
        existing_advance = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking.id,
                Payment.payment_type == PaymentType.ADVANCE,
                Payment.status == PaymentStatus.SUCCESS,
            )
            .first()
        )

        if payment_type == "ADVANCE":
            if existing_advance:
                raise HTTPException(
                    status_code=400, detail="Advance payment already completed"
                )
        else:  # FINAL
            if not existing_advance:
                raise HTTPException(
                    status_code=400,
                    detail="Advance payment must be completed before final payment",
                )

            # Check if final already completed
            existing_final = (
                db.query(Payment)
                .filter(
                    Payment.booking_id == booking.id,
                    Payment.payment_type == PaymentType.FINAL,
                    Payment.status == PaymentStatus.SUCCESS,
                )
                .first()
            )
            if existing_final:
                raise HTTPException(
                    status_code=400, detail="Final payment already completed"
                )

    @staticmethod
    def _calculate_expected_amount(booking, payment_type: str) -> int:
        """Calculate expected amount on backend - NEVER trust frontend amount."""
        if payment_type == "ADVANCE":
            expected = int(booking.total_price * ADVANCE_PERCENTAGE)
        else:
            # Final = total - advance
            expected = int(
                booking.total_price - (booking.total_price * ADVANCE_PERCENTAGE)
            )
        return expected

    @staticmethod
    def create_payment(
        db: Session, booking_id: UUID, payment_type: str, user_id: UUID = None
    ):
        """
        Create a payment order with full validation.

        Security measures:
        - Validates booking ownership (user_id must match booking user)
        - Validates booking status is correct for payment type
        - Prevents duplicate payments
        - Calculates amount on backend (never trust frontend)
        - Always uses INR currency
        """
        logger.info(
            f"[PAYMENT] Creating payment: booking_id={booking_id}, payment_type={payment_type}, user_id={user_id}"
        )

        # Step 1: Validate booking exists
        booking = BookingRepository.get_by_id(db, booking_id)

        if not booking:
            logger.warning(f"[PAYMENT] Booking not found: {booking_id}")
            raise HTTPException(status_code=404, detail="Booking not found")

        # Step 2: Validate booking ownership
        if user_id:
            PaymentService._validate_booking_for_payment(
                db, booking, user_id, payment_type
            )

        # Step 3: Validate payment sequence (ADVANCE before FINAL)
        PaymentService._validate_payment_sequence(db, booking, payment_type)

        # Step 4: Check for duplicate payments
        PaymentService._check_duplicate_payment(db, booking_id, payment_type)

        # Step 5: Calculate amount on backend (NEVER trust frontend)
        expected_amount = PaymentService._calculate_expected_amount(
            booking, payment_type
        )

        logger.info(
            f"[PAYMENT] Amount calculated: {expected_amount} INR (type={payment_type}, "
            f"total_price={booking.total_price})"
        )

        # Step 6: Create Razorpay order (amount in paise = amount * 100)
        user = booking.user
        customer = {"name": user.full_name, "email": user.email, "contact": user.phone}

        try:
            order = create_order(expected_amount)
            payment_link = create_payment_link(expected_amount, customer)
            logger.info(f"[PAYMENT] Razorpay order created: {order['id']}")
        except Exception as e:
            logger.error(f"[PAYMENT] Razorpay API error: {e}")
            raise HTTPException(
                status_code=503,
                detail="Payment gateway unavailable. Please try again later.",
            )

        # Step 7: Create Payment record with enforced currency
        try:
            payment = Payment(
                booking_id=booking_id,
                amount=expected_amount,
                currency=CURRENCY,  # Always enforce INR
                payment_type=PaymentType(payment_type),
                razorpay_order_id=order["id"],
                payment_link_id=payment_link["id"],
                payment_link_url=payment_link["short_url"],
                qr_code_url=payment_link.get("qr_code_url"),
                escrow_status=EscrowStatus.PENDING,
            )

            PaymentRepository.create(db, payment)
            db.commit()
            db.refresh(payment)

            logger.info(
                f"[PAYMENT] Payment created: payment_id={payment.id}, amount={payment.amount}, "
                f"currency={payment.currency}, type={payment.payment_type.value}"
            )
        except Exception as e:
            db.rollback()
            logger.error(f"[PAYMENT] Failed to create payment record: {e}")
            raise HTTPException(
                status_code=500, detail="Failed to create payment. Please try again."
            )

        # Step 8: Schedule background verification task
        try:
            from app.modules.tasks import verify_payment_status_task

            verify_payment_status_task.apply_async((str(payment.id),), countdown=600)
        except Exception as e:
            logger.warning(f"[PAYMENT] Failed to schedule verification task: {e}")

        return {
            "payment_id": str(payment.id),
            "amount": payment.amount,
            "currency": payment.currency,
            "order_id": order["id"],
            "payment_link": payment.payment_link_url,
            "qr_code": payment.qr_code_url,
            "payment_type": payment_type,
            "expected_amount": expected_amount,
        }

    @staticmethod
    def verify_payment(db: Session, data):
        logger.info(
            f"Verifying payment: razorpay_order_id={data.razorpay_order_id}, razorpay_payment_id={data.razorpay_payment_id}"
        )

        payment = PaymentRepository.get_by_order_id(db, data.razorpay_order_id)

        if not payment:
            logger.error(f"Payment not found for order: {data.razorpay_order_id}")
            raise HTTPException(status_code=404, detail="Payment not found")

        if payment.status == PaymentStatus.SUCCESS:
            logger.info(f"Payment already verified: payment_id={payment.id}")
            return payment

        if (
            payment.razorpay_payment_id
            and payment.razorpay_payment_id != data.razorpay_payment_id
        ):
            logger.warning(
                f"Duplicate payment attempt: existing={payment.razorpay_payment_id}, new={data.razorpay_payment_id}"
            )
            raise HTTPException(
                status_code=409, detail="This payment has already been processed"
            )

        if not verify_signature(
            data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature
        ):
            logger.error(
                f"Invalid payment signature for order: {data.razorpay_order_id}"
            )
            payment.status = PaymentStatus.FAILED
            db.commit()
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        payment.status = PaymentStatus.SUCCESS
        payment.razorpay_payment_id = data.razorpay_payment_id

        booking = payment.booking

        if payment.payment_type == PaymentType.ADVANCE:
            logger.info(
                f"Processing ADVANCE payment: payment_id={payment.id}, booking_id={booking.id}"
            )

            payment.escrow_status = EscrowStatus.HELD
            booking.status = BookingStatus.CONFIRMED

            vendor_share = int(payment.amount * ADVANCE_TO_VENDOR_PERCENT)
            escrow_share = payment.amount - vendor_share

            payment.vendor_released_amount = vendor_share
            payment.escrow_amount = escrow_share

            payout = Payout(
                payment_id=payment.id,
                booking_id=booking.id,
                vendor_id=booking.listing.vendor_id,
                amount=vendor_share,
                currency=payment.currency,
                status=PayoutStatus.COMPLETED,
            )
            PayoutRepository.create(db, payout)

            payment.escrow_status = EscrowStatus.PARTIALLY_RELEASED

            logger.info(
                f"Advance payment processed: vendor_payout={vendor_share}, escrow_held={escrow_share}"
            )

        elif payment.payment_type == PaymentType.FINAL:
            logger.info(
                f"Processing FINAL payment: payment_id={payment.id}, booking_id={booking.id}"
            )

            payment.escrow_status = EscrowStatus.HELD
            payment.escrow_amount = payment.amount

            booking.status = BookingStatus.COMPLETED

            logger.info(f"Final payment processed, booking status: {booking.status}")

        db.commit()
        logger.info(
            f"Payment verified successfully: payment_id={payment.id}, status={payment.status}"
        )

        # Create notification for user
        try:
            from app.modules.notifications.models import NotificationType
            from app.modules.notifications.repository import NotificationRepository

            payment_type_label = (
                "Advance" if payment.payment_type == PaymentType.ADVANCE else "Final"
            )
            notification_data = {
                "user_id": booking.user_id,
                "type": NotificationType.PAYMENT,
                "reference_id": booking.id,
                "title": f"Payment {payment_type_label} Successful",
                "message": f"Your {payment_type_label.lower()} payment of ₹{payment.amount / 100:.2f} has been processed successfully.",
            }
            NotificationRepository(db).create_notification(notification_data)
            logger.info(f"Payment notification created for user {booking.user_id}")
        except Exception as e:
            logger.error(f"Failed to create payment notification: {e}")

        return payment

    @staticmethod
    def release_payout(db: Session, booking_id: UUID, is_automatic: bool = False):
        logger.info(
            f"Releasing payout: booking_id={booking_id}, automatic={is_automatic}"
        )

        booking = BookingRepository.get_by_id(db, booking_id)

        if not booking:
            logger.error(f"Booking not found: {booking_id}")
            raise HTTPException(status_code=404, detail="Booking not found")

        if booking.status != BookingStatus.COMPLETED:
            logger.warning(
                f"Cannot release payout: booking status is {booking.status}, must be COMPLETED"
            )
            raise HTTPException(
                status_code=400, detail="Booking must be completed before final payout"
            )

        payments = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.status == PaymentStatus.SUCCESS,
            )
            .all()
        )

        total_escrow = sum(p.escrow_amount for p in payments)

        commission = int(total_escrow * PLATFORM_COMMISSION)
        vendor_amount = total_escrow - commission

        payout = Payout(
            booking_id=booking.id,
            vendor_id=booking.listing.vendor_id,
            amount=vendor_amount,
            currency="INR",
            status=PayoutStatus.COMPLETED,
        )

        PayoutRepository.create(db, payout)

        for p in payments:
            p.escrow_status = EscrowStatus.RELEASED
            logger.info(
                f"Released escrow for payment: {p.id}, amount={p.escrow_amount}"
            )

        logger.info(
            f"Payout released: vendor_amount={vendor_amount}, commission={commission}"
        )
        db.commit()
        return payout

    @staticmethod
    def refund(db: Session, payment_id: UUID, initiated_by: str = "user", user_id: UUID = None):
        logger.info(
            f"Processing refund: payment_id={payment_id}, initiated_by={initiated_by}"
        )

        payment = PaymentRepository.get_by_id(db, payment_id)

        if not payment:
            logger.error(f"Payment not found: {payment_id}")
            raise HTTPException(status_code=404, detail="Payment not found")

        booking = payment.booking

        # Validate ownership: user can only refund their own bookings
        if user_id and booking.user_id != user_id:
            logger.warning(f"Refund denied: user {user_id} does not own booking {booking.id}")
            raise HTTPException(
                status_code=403, detail="Not authorized to refund this payment"
            )

        if payment.status != PaymentStatus.SUCCESS:
            logger.warning(f"Cannot refund: payment status is {payment.status}")
            raise HTTPException(
                status_code=400, detail="Only successful payments can be refunded"
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        if booking.event_date < now:
            logger.warning(
                f"Cannot refund: event already passed ({booking.event_date})"
            )
            raise HTTPException(
                status_code=400, detail="Cannot refund after event date"
            )

        if booking.status == BookingStatus.COMPLETED:
            logger.warning(f"Cannot refund: booking already completed")
            raise HTTPException(
                status_code=400, detail="Cannot refund after booking completion"
            )

        try:
            refund_payment(payment.razorpay_payment_id)
            logger.info(
                f"Razorpay refund initiated: razorpay_payment_id={payment.razorpay_payment_id}"
            )
        except Exception as e:
            logger.error(f"Razorpay refund failed: {e}")
            raise HTTPException(status_code=500, detail="Refund processing failed")

        payment.status = PaymentStatus.REFUNDED
        payment.escrow_status = EscrowStatus.REFUNDED

        if initiated_by == "user":
            booking.status = BookingStatus.CANCELLED
            logger.info(f"Booking cancelled by user: booking_id={booking.id}")
        else:
            booking.status = BookingStatus.REJECTED
            logger.info(f"Booking rejected by vendor: booking_id={booking.id}")

        db.commit()
        logger.info(
            f"Refund completed: payment_id={payment.id}, booking_status={booking.status}"
        )
        return payment
