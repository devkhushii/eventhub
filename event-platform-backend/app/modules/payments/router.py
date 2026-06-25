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
    logger.info(
        f"[VERIFY API HIT] razorpay_order_id={req.razorpay_order_id}, "
        f"razorpay_payment_id={req.razorpay_payment_id}, user_id={current_user.id}"
    )

    try:
        result = PaymentService.verify_payment(db, req)
        logger.info(
            f"[VERIFY API] Payment marked SUCCESS: payment_id={result.id}, "
            f"booking_id={result.booking_id}, booking_status={result.booking.status}"
        )

        if result.booking.status == BookingStatus.COMPLETED:
            try:
                PaymentService.release_payout(db, result.booking_id, is_automatic=True)
                logger.info(f"Auto-released payout for booking: {result.booking_id}")
            except Exception as e:
                logger.error(f"Failed to auto-release payout: {e}")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[VERIFY API] Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Payment verification failed. Please try again.",
        )


@router.post("/refund")
def refund(
    req: RefundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(
        f"Refund requested: payment_id={req.payment_id}, user={current_user.id}"
    )
    return PaymentService.refund(
        db, req.payment_id, initiated_by="user", user_id=current_user.id
    )


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
    from app.modules.bookings.models import BookingStatus, AdvancePaymentStatus

    try:
        body = await request.body()
        data = await request.json()
        event = data.get("event", "")

        logger.info(f"[Webhook] Event received: {event}")
        logger.info(f"[Webhook] Full payload: {data}")

        signature = request.headers.get("x-razorpay-signature")
        signature_verified = False
        if signature:
            from .utils import verify_webhook_signature

            signature_verified = verify_webhook_signature(body, signature)
            logger.info(
                f"[Webhook] Signature verification: {'SUCCESS' if signature_verified else 'FAILED'}"
            )

            if not signature_verified:
                logger.error(
                    f"[Webhook] ❌ INVALID SIGNATURE - REJECTING EVENT: {event}"
                )
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            logger.warning(f"[Webhook] ⚠️ No signature provided, event: {event}")

        if event == "payment.captured":
            payment_entity = data["payload"]["payment"]["entity"]
            razorpay_order_id = payment_entity.get("order_id")
            razorpay_payment_id = payment_entity["id"]

            logger.info(
                f"[Webhook] payment_id={razorpay_payment_id}, order_id={razorpay_order_id}"
            )

            flow_type = "PAYMENT_LINK" if razorpay_payment_id else "ORDER"
            logger.info(f"[Webhook] Payment flow: {flow_type}")

            payment = PaymentRepository.get_by_payment_id(db, razorpay_payment_id)
            logger.info(
                f"[Webhook] Payment found by payment_id: {'YES' if payment else 'NO'}"
            )

            if not payment and razorpay_order_id:
                logger.warning(f"[Webhook] Trying order_id lookup: {razorpay_order_id}")
                payment = PaymentRepository.get_by_order_id(db, razorpay_order_id)
                logger.info(
                    f"[Webhook] Payment found by order_id: {'YES' if payment else 'NO'}"
                )

            if not payment:
                logger.error(
                    f"[Webhook] ❌ Payment not found in DB! order_id={razorpay_order_id}, payment_id={razorpay_payment_id}"
                )
                return {"status": "ok", "message": "Payment not found in system"}

            logger.info(f"[Webhook] Current DB status: {payment.status}")

            if payment.status == PaymentStatus.SUCCESS:
                logger.info(
                    f"[Webhook] ✅ Payment already SUCCESS (idempotent), skipping. payment_id={payment.id}"
                )
                return {"status": "ok", "message": "Payment already processed"}

            if payment.status == PaymentStatus.FAILED:
                logger.warning(
                    f"[Webhook] Payment already FAILED, skipping. payment_id={payment.id}"
                )
                return {"status": "ok", "message": "Payment already failed"}

            payment.status = PaymentStatus.SUCCESS
            payment.razorpay_payment_id = razorpay_payment_id
            logger.info(
                f"[Webhook] Stored razorpay_payment_id={razorpay_payment_id}, updating status → SUCCESS"
            )

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
                payment.booking.advance_paid = True
                payment.booking.advance_payment_status = AdvancePaymentStatus.PAID
                logger.info(
                    f"[Webhook] Advance payment processed, "
                    f"booking_status -> CONFIRMED, advance_paid=True"
                )

            elif payment.payment_type == PaymentType.FINAL:
                payment.escrow_status = EscrowStatus.HELD
                payment.escrow_amount = payment.amount
                payment.booking.status = BookingStatus.COMPLETED
                logger.info(f"[Webhook] Final payment processed, booking completed")

            try:
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"[Webhook] Failed to commit payment update: {e}")
                return {"status": "error", "message": "Failed to update payment"}

            if payment.booking.status == BookingStatus.COMPLETED:
                try:
                    PaymentService.release_payout(
                        db, payment.booking_id, is_automatic=True
                    )
                except Exception as e:
                    logger.error(f"[Webhook] Auto-release failed: {e}")

            logger.info(
                f"[Webhook] Payment status updated to SUCCESS, payment_id={payment.id}"
            )

        elif event == "payment.failed":
            payment_entity = data["payload"]["payment"]["entity"]
            razorpay_order_id = payment_entity.get("order_id")
            razorpay_payment_id = payment_entity.get("id")

            logger.info(
                f"[Webhook] Payment failed: payment_id={razorpay_payment_id}, order_id={razorpay_order_id}"
            )

            payment = PaymentRepository.get_by_payment_id(db, razorpay_payment_id)
            if not payment:
                logger.warning(
                    f"[Webhook] No payment found by payment_id, trying order_id lookup"
                )
                payment = PaymentRepository.get_by_order_id(db, razorpay_order_id)

            if not payment:
                logger.error(
                    f"[Webhook] Payment not found: order_id={razorpay_order_id}, payment_id={razorpay_payment_id}"
                )
                return {"status": "ok", "message": "Payment not found in system"}

            if payment.status == PaymentStatus.SUCCESS:
                logger.info(
                    f"[Webhook] Payment already SUCCESS, skipping failed event. payment_id={payment.id}"
                )
                return {"status": "ok", "message": "Payment already processed"}

            if payment.status == PaymentStatus.FAILED:
                logger.info(
                    f"[Webhook] Payment already FAILED, skipping. payment_id={payment.id}"
                )
                return {"status": "ok", "message": "Payment already failed"}

            payment.status = PaymentStatus.FAILED
            try:
                db.commit()
                logger.info(
                    f"[Webhook] Payment marked as FAILED, payment_id={payment.id}"
                )
            except Exception as e:
                db.rollback()
                logger.error(f"[Webhook] Failed to commit FAILED status: {e}")
                return {"status": "error", "message": "Failed to update payment"}

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
