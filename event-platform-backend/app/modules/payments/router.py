# app/modules/payments/router.py
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.core.dependencies import get_current_user, get_current_admin_user
from app.modules.users.models import User
from .service import PaymentService
from .repository import PaymentRepository, PayoutRepository
from .models import (
    Payment,
    PaymentStatus,
    PaymentType,
    EscrowStatus,
    Payout,
    PayoutStatus,
)
from .constant import ADVANCE_TO_VENDOR_PERCENT
from app.modules.bookings.models import BookingStatus
from .schemas import (
    CreatePaymentRequest,
    VerifyPaymentRequest,
    RefundRequest,
    PaymentOrderResponse,
    PaymentResponse,
    PayoutResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/create-order", response_model=PaymentOrderResponse)
def create_order(
    req: CreatePaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a payment order with full validation.

    Validates:
    - Booking exists
    - Booking belongs to current user
    - Booking status is correct for payment type
    - No duplicate payments exist
    - Amount is calculated on backend
    """
    logger.info(
        f"[API] Payment order: booking_id={req.booking_id}, payment_type={req.payment_type.value}, "
        f"user_id={current_user.id}"
    )

    try:
        result = PaymentService.create_payment(
            db,
            booking_id=req.booking_id,
            payment_type=req.payment_type.value,
            user_id=current_user.id,
        )
        logger.info(f"[API] Payment order created successfully: {result['payment_id']}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[API] Payment order creation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create payment order. Please try again later.",
        )


@router.post("/verify", response_model=PaymentResponse)
def verify_payment(
    req: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"Payment verified: razorpay_order_id={req.razorpay_order_id}")
    result = PaymentService.verify_payment(db, req)

    if result.booking.status == BookingStatus.COMPLETED:
        try:
            PaymentService.release_payout(db, result.booking_id, is_automatic=True)
            logger.info(f"Auto-released payout for booking: {result.booking_id}")
        except Exception as e:
            logger.error(f"Failed to auto-release payout: {e}")

    return result


@router.post("/refund")
def refund(
    req: RefundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(
        f"Refund requested: payment_id={req.payment_id}, user={current_user.id}"
    )
    return PaymentService.refund(db, req.payment_id, initiated_by="user", user_id=current_user.id)


@router.post("/release/{booking_id}")
def release(
    booking_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    logger.info(f"Manual payout release: booking_id={booking_id}, admin={admin.id}")
    PaymentService.release_payout(db, booking_id, is_automatic=False)
    return {"status": "released"}


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    from .models import Payment, PaymentStatus, EscrowStatus
    from app.modules.bookings.models import BookingStatus

    try:
        body = await request.body()
        data = await request.json()
        event = data.get("event", "")

        logger.info(f"Webhook received: event={event}")

        signature = request.headers.get("x-razorpay-signature")
        if signature:
            from .utils import verify_webhook_signature

            if not verify_webhook_signature(body, signature):
                logger.error("Invalid webhook signature")
                raise HTTPException(status_code=400, detail="Invalid signature")

        if event == "payment.captured":
            payment_entity = data["payload"]["payment"]["entity"]
            razorpay_order_id = payment_entity.get("order_id")
            razorpay_payment_id = payment_entity["id"]

            logger.info(
                f"Payment captured webhook: order_id={razorpay_order_id}, payment_id={razorpay_payment_id}"
            )

            payment = PaymentRepository.get_by_order_id(db, razorpay_order_id)

            if payment and payment.status != PaymentStatus.SUCCESS:
                payment.status = PaymentStatus.SUCCESS
                payment.razorpay_payment_id = razorpay_payment_id

                if payment.payment_type == PaymentType.ADVANCE:
                    payment.escrow_status = EscrowStatus.HELD
                    vendor_share = int(payment.amount * ADVANCE_TO_VENDOR_PERCENT)
                    escrow_share = payment.amount - vendor_share
                    payment.vendor_released_amount = vendor_share
                    payment.escrow_amount = escrow_share

                    payout = Payout(
                        payment_id=payment.id,
                        booking_id=payment.booking_id,
                        vendor_id=payment.booking.listing.vendor_id,
                        amount=vendor_share,
                        currency=payment.currency,
                        status=PayoutStatus.COMPLETED,
                    )
                    PayoutRepository.create(db, payout)
                    payment.escrow_status = EscrowStatus.PARTIALLY_RELEASED

                    payment.booking.status = BookingStatus.CONFIRMED
                    logger.info(
                        f"Webhook: Advance payment processed, booking confirmed"
                    )

                elif payment.payment_type == PaymentType.FINAL:
                    payment.escrow_status = EscrowStatus.HELD
                    payment.escrow_amount = payment.amount
                    payment.booking.status = BookingStatus.COMPLETED
                    logger.info(f"Webhook: Final payment processed, booking completed")

                db.commit()

                if payment.booking.status == BookingStatus.COMPLETED:
                    try:
                        PaymentService.release_payout(
                            db, payment.booking_id, is_automatic=True
                        )
                    except Exception as e:
                        logger.error(f"Webhook: Auto-release failed: {e}")

                logger.info(f"Webhook: Payment status updated to SUCCESS")

        elif event == "payment.failed":
            payment_entity = data["payload"]["payment"]["entity"]
            razorpay_order_id = payment_entity.get("order_id")

            logger.warning(f"Payment failed webhook: order_id={razorpay_order_id}")

            payment = PaymentRepository.get_by_order_id(db, razorpay_order_id)
            if payment:
                payment.status = PaymentStatus.FAILED
                db.commit()
                logger.info(f"Webhook: Payment marked as FAILED")

        elif event == "refund.processed":
            refund_entity = data["payload"]["refund"]["entity"]
            payment_id = refund_entity.get("payment_id")

            logger.info(f"Refund processed webhook: razorpay_payment_id={payment_id}")

            payment = (
                db.query(Payment)
                .filter(Payment.razorpay_payment_id == payment_id)
                .first()
            )
            if payment:
                payment.status = PaymentStatus.REFUNDED
                payment.escrow_status = EscrowStatus.REFUNDED
                payment.booking.status = BookingStatus.CANCELLED
                db.commit()
                logger.info(f"Webhook: Payment and booking updated for refund")

        else:
            logger.info(f"Unhandled webhook event: {event}")

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing webhook: {e}")
        return {"status": "error", "message": str(e)}
