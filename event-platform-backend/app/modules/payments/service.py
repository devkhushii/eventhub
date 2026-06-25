# app/modules/payments/service.py
import logging
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException  # type: ignore

from app.modules.bookings.repository import BookingRepository
from app.modules.bookings.models import BookingStatus, AdvancePaymentStatus
from .repository import PaymentRepository, PayoutRepository
from .models import (
    Payment,
    PaymentStatus,
    PaymentType,
    EscrowStatus,
    Payout,
    PayoutStatus,
)
from .utils import create_order, verify_signature, refund_payment
from .constant import ADVANCE_PERCENTAGE, ADVANCE_TO_VENDOR_PERCENT, PLATFORM_COMMISSION
from app.core.config import settings

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
        print(
            f"[Payment] _calculate_expected_amount: booking.total_price={booking.total_price}, payment_type={payment_type}"
        )
        if payment_type == "ADVANCE":
            expected = int(booking.total_price * ADVANCE_PERCENTAGE)
        else:
            # Final = total - advance
            expected = int(
                booking.total_price - (booking.total_price * ADVANCE_PERCENTAGE)
            )
        print(f"[Payment] Expected amount: {expected}")
        logger.info(
            f"[TEMP LOG] [Payment] _calculate_expected_amount: booking.total_price={booking.total_price}, "
            f"payment_type={payment_type}, calculated expected={expected}"
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
        logger.info(
            f"[TEMP LOG] [Payment] create_payment: booking.total_price={booking.total_price}, "
            f"expected_amount={expected_amount}, passing to create_order: {expected_amount}"
        )

        # Step 6: Create Razorpay order (amount in paise = amount * 100)
        try:
            order = create_order(expected_amount)
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

        # Step 8: Schedule background verification task for fallback
        try:
            from app.modules.tasks import verify_payment_status_task

            # Start verification after 5 minutes (user needs time to complete payment via SDK)
            verify_payment_status_task.apply_async((str(payment.id),), countdown=300)
        except Exception as e:
            logger.warning(f"[PAYMENT] Failed to schedule verification task: {e}")

        return {
            "payment_id": str(payment.id),
            "amount": payment.amount,
            "currency": payment.currency,
            "order_id": order["id"],
            "key_id": settings.RAZORPAY_KEY_ID,
            "payment_type": payment_type,
            "expected_amount": expected_amount,
        }

    @staticmethod
    def verify_payment(db: Session, data):
        """
        Verify payment and update booking status.

        Key features:
        - Idempotency: Returns existing payment if already verified
        - Transaction safety: Rolls back on failure
        - Signature verification (with simulation mode bypass)
        - Proper status transitions for ADVANCE/FINAL payments
        """
        logger.info(
            f"[VERIFY] Starting payment verification: "
            f"razorpay_order_id={data.razorpay_order_id}, "
            f"razorpay_payment_id={data.razorpay_payment_id}"
        )

        # Step 1: Find payment by razorpay order ID
        payment = PaymentRepository.get_by_order_id(db, data.razorpay_order_id)

        if not payment:
            logger.error(
                f"[VERIFY] Payment not found for order: {data.razorpay_order_id}"
            )
            raise HTTPException(status_code=404, detail="Payment not found")

        logger.info(
            f"[VERIFY] Found payment: payment_id={payment.id}, "
            f"current_status={payment.status}, "
            f"booking_id={payment.booking_id}"
        )
        logger.info(
            f"[TEMP LOG] [Payment] verify_payment: Found payment in DB: payment_id={payment.id}, amount={payment.amount}"
        )

        # Step 2: Idempotency - check if already verified with same payment ID
        if payment.status == PaymentStatus.SUCCESS:
            if payment.razorpay_payment_id == data.razorpay_payment_id:
                logger.info(
                    f"[VERIFY] Payment already verified (idempotent): payment_id={payment.id}"
                )
                return payment
            else:
                # Different payment ID - potential duplicate attempt
                logger.warning(
                    f"[VERIFY] Payment already SUCCESS with different razorpay_payment_id: "
                    f"existing={payment.razorpay_payment_id}, new={data.razorpay_payment_id}"
                )
                raise HTTPException(
                    status_code=409,
                    detail="This payment has already been processed with a different payment ID",
                )

        # Step 3: Check if this exact payment ID was already used (unique constraint)
        existing_with_same_id = PaymentRepository.get_by_payment_id(
            db, data.razorpay_payment_id
        )
        if existing_with_same_id and existing_with_same_id.id != payment.id:
            logger.warning(
                f"[VERIFY] Payment ID already used on different payment: "
                f"razorpay_payment_id={data.razorpay_payment_id}, "
                f"existing_payment_id={existing_with_same_id.id}"
            )
            raise HTTPException(
                status_code=409, detail="This payment has already been processed"
            )

        # Step 4: Verify Razorpay signature
        if not verify_signature(
            data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature
        ):
            logger.error(
                f"[VERIFY] Invalid signature for order: {data.razorpay_order_id}"
            )
            payment.status = PaymentStatus.FAILED
            try:
                db.commit()
                logger.info(
                    f"[VERIFY] Payment marked as FAILED due to invalid signature"
                )
            except Exception as e:
                db.rollback()
                logger.error(f"[VERIFY] Failed to commit FAILED status: {e}")
            raise HTTPException(status_code=400, detail="Invalid payment signature")

        logger.info(f"[VERIFY] Signature verified successfully")

        # Step 5: Update payment with transaction safety
        try:
            payment.status = PaymentStatus.SUCCESS
            payment.razorpay_payment_id = data.razorpay_payment_id

            booking = payment.booking
            logger.info(
                f"[VERIFY] Processing booking: booking_id={booking.id}, "
                f"current_status={booking.status}, payment_type={payment.payment_type.value}"
            )

            # Step 6: Update booking status based on payment type
            if payment.payment_type == PaymentType.ADVANCE:
                logger.info(f"[VERIFY] Processing ADVANCE payment")

                payment.escrow_status = EscrowStatus.HELD

                vendor_share = int(payment.amount * ADVANCE_TO_VENDOR_PERCENT)
                escrow_share = payment.amount - vendor_share

                payment.vendor_released_amount = vendor_share
                payment.escrow_amount = escrow_share
                payment.escrow_status = EscrowStatus.PARTIALLY_RELEASED

                # Update booking: AWAITING_ADVANCE → CONFIRMED (atomic)
                old_status = booking.status
                booking.status = BookingStatus.CONFIRMED
                booking.advance_paid = True
                booking.advance_payment_status = AdvancePaymentStatus.PAID

                logger.info(
                    f"[VERIFY] [CONFIRMED] Advance payment processed: "
                    f"vendor_share={vendor_share}, escrow_share={escrow_share}, "
                    f"booking_status: {old_status} -> {booking.status}, "
                    f"advance_paid=True"
                )

                # Create payout for vendor
                payout = Payout(
                    payment_id=payment.id,
                    booking_id=booking.id,
                    vendor_id=booking.listing.vendor_id,
                    amount=vendor_share,
                    currency=payment.currency,
                    status=PayoutStatus.COMPLETED,
                )
                PayoutRepository.create(db, payout)
                logger.info(f"[VERIFY] Vendor payout created: amount={vendor_share}")

            elif payment.payment_type == PaymentType.FINAL:
                logger.info(f"[VERIFY] Processing FINAL payment")

                payment.escrow_status = EscrowStatus.HELD
                payment.escrow_amount = payment.amount

                old_status = booking.status
                booking.status = BookingStatus.COMPLETED

                logger.info(
                    f"[VERIFY] Final payment processed: "
                    f"escrow_amount={payment.amount}, "
                    f"booking_status: {old_status} -> {booking.status}"
                )

            # Step 7: Commit all changes atomically
            db.commit()
            db.refresh(payment)

            logger.info(
                f"[VERIFY] Payment verified successfully: "
                f"payment_id={payment.id}, status={payment.status}, "
                f"booking_status={booking.status}"
            )

        except Exception as e:
            db.rollback()
            logger.exception(f"[VERIFY] Failed to verify payment: {e}")
            raise HTTPException(
                status_code=500, detail="Payment verification failed. Please try again."
            )

        # Step 8: Create notification for user
        try:
            from app.modules.notifications.models import NotificationType
            from app.modules.notifications.repository import NotificationRepository

            payment_type_label = (
                "Advance" if payment.payment_type == PaymentType.ADVANCE else "Final"
            )
            logger.info(
                f"[TEMP LOG] [Payment] verify_payment (notification): DB payment.amount={payment.amount}, "
                f"payment_type={payment.payment_type.value}, formatted value for message={payment.amount:.2f}"
            )
            notification_data = {
                "user_id": booking.user_id,
                "type": NotificationType.PAYMENT,
                "reference_id": booking.id,
                "title": f"Payment {payment_type_label} Successful",
                "message": f"Your {payment_type_label.lower()} payment of ₹{payment.amount:.2f} has been processed successfully.",
            }
            logger.info(
                f"[TEMP LOG] [Payment] Notification title: '{notification_data['title']}', message: '{notification_data['message']}'"
            )
            NotificationRepository(db).create_notification(notification_data)
            logger.info(
                f"[VERIFY] Payment notification created for user {booking.user_id}"
            )

            # Notify vendor
            if payment.payment_type == PaymentType.ADVANCE:
                from app.modules.vendors.models import Vendor
                vendor = db.query(Vendor).filter(Vendor.id == booking.listing.vendor_id).first()
                if vendor and vendor.user_id:
                    try:
                        from app.modules.notifications.trigger import notification_trigger
                        notification_trigger.notify_vendor_advance_paid_sync(
                            vendor_user_id=vendor.user_id,
                            booking_id=booking.id,
                            listing_title=booking.listing.title if booking.listing else "booking",
                            amount=payment.amount,
                        )
                        logger.info(f"[VERIFY] Vendor notified for advance payment: vendor_user={vendor.user_id}")
                    except Exception as ve:
                        logger.error(f"[VERIFY] Failed to create vendor payment notification: {ve}")

        except Exception as e:
            logger.error(f"[VERIFY] Failed to create payment notification: {e}")

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
    def refund(
        db: Session, payment_id: UUID, initiated_by: str = "user", user_id: UUID = None
    ):
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
            logger.warning(
                f"Refund denied: user {user_id} does not own booking {booking.id}"
            )
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

    @staticmethod
    def process_cancellation_refund(db: Session, booking_id: UUID, vendor_id: UUID):
        """
        Vendor-approved partial refund (70%) of advance payment for customer-initiated CANCELLATION_REQUESTED booking.
        
        Flow: Razorpay Refund → Success → Update Payment → Update Booking → Notify
        If refund fails: booking stays CANCELLATION_REQUESTED, no status change.
        """
        booking = BookingRepository.get_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        # Verify vendor owns the listing of this booking
        if booking.listing.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not authorized to refund this booking")

        if booking.status != BookingStatus.CANCELLATION_REQUESTED:
            raise HTTPException(
                status_code=400,
                detail=f"Booking must be in CANCELLATION_REQUESTED status. Current status: {booking.status.value}",
            )

        # Find the successful advance payment
        advance_payment = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.payment_type == PaymentType.ADVANCE,
                Payment.status == PaymentStatus.SUCCESS,
            )
            .first()
        )

        if not advance_payment:
            raise HTTPException(
                status_code=400,
                detail="No successful advance payment found for this booking"
            )

        refund_percentage = 0.7
        refund_amount = int(advance_payment.amount * refund_percentage)
        listing_title = booking.listing.title if booking.listing else "booking"

        logger.info(
            f"[REFUND] [CUSTOMER_CANCEL] Processing 70% refund: booking_id={booking_id}, "
            f"advance_amount={advance_payment.amount}, refund_amount={refund_amount}, "
            f"razorpay_payment_id={advance_payment.razorpay_payment_id}"
        )

        # Step 1: Call Razorpay refund API
        try:
            refund_result = refund_payment(advance_payment.razorpay_payment_id, amount=refund_amount)
            logger.info(
                f"[REFUND] [REFUND_SUCCESS] Razorpay refund confirmed: "
                f"razorpay_payment_id={advance_payment.razorpay_payment_id}, "
                f"refund_amount={refund_amount}, result={refund_result}"
            )
        except Exception as e:
            # CRITICAL: Refund failed — do NOT update booking status
            logger.error(
                f"[REFUND] [REFUND_FAILED] Razorpay refund failed: "
                f"booking_id={booking_id}, error={e}"
            )
            
            # Notify vendor of failure
            try:
                from app.modules.notifications.trigger import notification_trigger
                from app.modules.vendors.models import Vendor
                vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
                vendor_user_id = vendor.user_id if vendor else None
                if vendor_user_id:
                    notification_trigger.notify_vendor_refund_result_sync(
                        vendor_user_id=vendor_user_id,
                        booking_id=booking_id,
                        listing_title=listing_title,
                        success=False,
                    )
            except Exception as notify_err:
                logger.error(f"[REFUND] Failed to send refund failure notification: {notify_err}")
            
            raise HTTPException(status_code=500, detail="Refund processing failed. Booking remains in cancellation requested status.")

        # Step 2: Refund succeeded — update payment record
        advance_payment.status = PaymentStatus.REFUNDED
        advance_payment.escrow_status = EscrowStatus.REFUNDED
        advance_payment.refunded_amount = refund_amount
        advance_payment.refund_percentage = refund_percentage

        # Customer cancellation after advance payment:
        # Platform commission = 10% of advance amount.
        # Vendor earnings = remaining retained amount - platform commission.
        platform_commission = int(advance_payment.amount * PLATFORM_COMMISSION)
        retained_amount = advance_payment.amount - refund_amount
        vendor_earnings = max(0, retained_amount - platform_commission)

        advance_payment.vendor_released_amount = vendor_earnings
        advance_payment.escrow_amount = platform_commission

        # Adjust payout ledger
        payout = db.query(Payout).filter(Payout.payment_id == advance_payment.id).first()
        if payout:
            payout.amount = vendor_earnings
            logger.info(f"[REFUND] Vendor payout adjusted: new_amount={payout.amount}")

        # Step 3: Update booking status to CANCELLED
        booking.status = BookingStatus.CANCELLED
        booking.expires_at = None

        db.commit()

        logger.info(
            f"[REFUND] [CANCELLED] Booking cancelled after refund: "
            f"booking_id={booking_id}, refunded_amount={refund_amount}, "
            f"vendor_earnings={advance_payment.vendor_released_amount}"
        )

        # Step 4: Send notifications
        try:
            from app.modules.notifications.trigger import notification_trigger
            from app.modules.vendors.models import Vendor
            vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
            vendor_user_id = vendor.user_id if vendor else None

            # Notify customer: refund processed
            notification_trigger.notify_refund_processed_sync(
                user_id=booking.user_id,
                booking_id=booking_id,
                listing_title=listing_title,
                refund_amount=refund_amount,
            )
            # Notify customer: refund credited
            notification_trigger.notify_refund_credited_sync(
                user_id=booking.user_id,
                booking_id=booking_id,
                refund_amount=refund_amount,
            )
            # Notify vendor: refund success
            if vendor_user_id:
                notification_trigger.notify_vendor_refund_result_sync(
                    vendor_user_id=vendor_user_id,
                    booking_id=booking_id,
                    listing_title=listing_title,
                    success=True,
                    refund_amount=refund_amount,
                )
            logger.info(f"[REFUND] All refund notifications sent successfully")
        except Exception as e:
            logger.error(f"[REFUND] Failed to send refund notifications: {e}")

        return advance_payment

    @staticmethod
    def process_vendor_cancellation_refund(db: Session, booking_id: UUID, vendor_id: UUID):
        """
        Vendor-initiated 100% refund of advance payment.
        No platform commission charged. Full refund to customer.
        
        Flow: Razorpay Refund → Success → Update Payment → Update Booking → Notify
        If refund fails: booking stays in current status, exception raised.
        """
        booking = BookingRepository.get_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        if booking.listing.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Find the successful advance payment
        advance_payment = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.payment_type == PaymentType.ADVANCE,
                Payment.status == PaymentStatus.SUCCESS,
            )
            .first()
        )

        if not advance_payment:
            raise HTTPException(
                status_code=400,
                detail="No successful advance payment found for this booking"
            )

        refund_amount = advance_payment.amount  # 100% refund
        listing_title = booking.listing.title if booking.listing else "booking"

        logger.info(
            f"[REFUND] [VENDOR_CANCEL] Processing 100% refund: booking_id={booking_id}, "
            f"refund_amount={refund_amount}, razorpay_payment_id={advance_payment.razorpay_payment_id}"
        )

        # Step 1: Call Razorpay refund API (100%)
        try:
            refund_result = refund_payment(advance_payment.razorpay_payment_id, amount=refund_amount)
            logger.info(
                f"[REFUND] [REFUND_SUCCESS] Vendor cancellation refund confirmed: "
                f"refund_amount={refund_amount}, result={refund_result}"
            )
        except Exception as e:
            logger.error(
                f"[REFUND] [REFUND_FAILED] Vendor cancellation refund failed: "
                f"booking_id={booking_id}, error={e}"
            )
            raise HTTPException(
                status_code=500,
                detail="Refund processing failed. Cannot complete vendor cancellation.",
            )

        # Step 2: Update payment record
        advance_payment.status = PaymentStatus.REFUNDED
        advance_payment.escrow_status = EscrowStatus.REFUNDED
        advance_payment.refunded_amount = refund_amount
        advance_payment.refund_percentage = 1.0
        advance_payment.vendor_released_amount = 0  # Vendor gets nothing
        advance_payment.escrow_amount = 0  # No platform commission

        # Zero out payout ledger
        payout = db.query(Payout).filter(Payout.payment_id == advance_payment.id).first()
        if payout:
            payout.amount = 0
            logger.info(f"[REFUND] Vendor payout zeroed out for vendor cancellation")

        # Step 3: Update booking to CANCELLED
        booking.status = BookingStatus.CANCELLED
        booking.expires_at = None

        db.commit()

        logger.info(
            f"[REFUND] [VENDOR_CANCELLED] Booking cancelled: booking_id={booking_id}, "
            f"full_refund={refund_amount}"
        )

        # Step 4: Send notifications
        try:
            from app.modules.notifications.trigger import notification_trigger
            from app.modules.vendors.models import Vendor
            vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
            vendor_user_id = vendor.user_id if vendor else None

            # Notify customer: vendor cancelled + full refund
            notification_trigger.notify_vendor_cancelled_by_vendor_sync(
                customer_user_id=booking.user_id,
                booking_id=booking_id,
                listing_title=listing_title,
                refund_amount=refund_amount,
            )
            # Notify customer: refund credited
            notification_trigger.notify_refund_credited_sync(
                user_id=booking.user_id,
                booking_id=booking_id,
                refund_amount=refund_amount,
            )
            # Notify vendor: refund success
            if vendor_user_id:
                notification_trigger.notify_vendor_refund_result_sync(
                    vendor_user_id=vendor_user_id,
                    booking_id=booking_id,
                    listing_title=listing_title,
                    success=True,
                    refund_amount=refund_amount,
                )
            logger.info(f"[REFUND] All vendor cancellation notifications sent successfully")
        except Exception as e:
            logger.error(f"[REFUND] Failed to send vendor cancellation notifications: {e}")

        return advance_payment
