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
    VendorPaymentHistoryResponse,
    CustomerPaymentHistoryResponse,
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


@router.get("/vendor/history", response_model=VendorPaymentHistoryResponse)
def get_vendor_payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.modules.vendors.models import Vendor
    from app.modules.listings.models import Listing
    from app.modules.bookings.models import Booking
    from app.modules.users.models import User as DBUser
    from .models import Payment, PaymentStatus, PaymentType, EscrowStatus, Payout, PayoutStatus

    vendor = db.query(Vendor).filter(Vendor.user_id == current_user.id).first()
    if not vendor:
        raise HTTPException(
            status_code=400,
            detail="Current user is not registered as a vendor",
        )

    listings = db.query(Listing).filter(Listing.vendor_id == vendor.id).all()
    listing_map = {l.id: l for l in listings}
    listing_ids = list(listing_map.keys())

    if not listing_ids:
        return {
            "summary": {
                "total_received": 0.0,
                "total_refunded": 0.0,
                "total_pending_release": 0.0,
                "total_earned": 0.0,
            },
            "transactions": [],
        }

    bookings = db.query(Booking).filter(Booking.listing_id.in_(listing_ids)).all()
    booking_map = {b.id: b for b in bookings}
    booking_ids = list(booking_map.keys())

    if not booking_ids:
        return {
            "summary": {
                "total_received": 0.0,
                "total_refunded": 0.0,
                "total_pending_release": 0.0,
                "total_earned": 0.0,
            },
            "transactions": [],
        }

    customer_ids = list(set([b.user_id for b in bookings]))
    customers = db.query(DBUser).filter(DBUser.id.in_(customer_ids)).all()
    customer_map = {c.id: c for c in customers}

    payments = (
        db.query(Payment)
        .filter(
            Payment.booking_id.in_(booking_ids),
            Payment.status.in_([PaymentStatus.SUCCESS, PaymentStatus.REFUNDED, PaymentStatus.PENDING]),
        )
        .order_by(Payment.created_at.desc())
        .all()
    )

    transactions = []
    total_received = 0.0
    total_refunded = 0.0
    total_pending_release = 0.0

    for payment in payments:
        booking = booking_map.get(payment.booking_id)
        if not booking:
            continue
        listing = listing_map.get(booking.listing_id)
        customer = customer_map.get(booking.user_id)

        customer_name = customer.full_name if customer else "Customer"
        listing_title = listing.title if listing else "Event Listing"

        year = booking.created_at.year if booking.created_at else 2026
        short_uuid = str(booking.id)[:4].upper() if booking.id else "0000"
        display_booking_id = f"BK-{year}-{short_uuid}"

        tx_type = "ADVANCE_PAYMENT" if payment.payment_type == PaymentType.ADVANCE else "FINAL_PAYMENT"

        # Calculate summary metrics and add transaction records
        if payment.status in [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED]:
            total_received += payment.amount

            transactions.append({
                "id": f"pay_captured_{payment.id}",
                "booking_id": booking.id,
                "booking_display_id": display_booking_id,
                "transaction_type": tx_type,
                "amount": float(payment.amount),
                "customer_name": customer_name,
                "listing_title": listing_title,
                "status": "SUCCESS",
                "created_at": payment.created_at,
                "payment_id": payment.razorpay_payment_id or str(payment.id),
                "escrow_status": payment.escrow_status.value if payment.escrow_status else None,
                "released_amount": float(payment.vendor_released_amount or 0),
                "refunded_amount": float(payment.refunded_amount or 0),
            })

            # Add REFUND entry if refunded
            if payment.status == PaymentStatus.REFUNDED or payment.refunded_amount > 0:
                ref_amount = payment.refunded_amount if payment.refunded_amount > 0 else (
                    payment.amount if payment.payment_type == PaymentType.FINAL else int(payment.amount * 0.7)
                )
                total_refunded += ref_amount
                transactions.append({
                    "id": f"pay_refunded_{payment.id}",
                    "booking_id": booking.id,
                    "booking_display_id": display_booking_id,
                    "transaction_type": "REFUND",
                    "amount": float(ref_amount),
                    "customer_name": customer_name,
                    "listing_title": listing_title,
                    "status": "SUCCESS",
                    "created_at": payment.created_at,
                    "payment_id": payment.razorpay_payment_id or str(payment.id),
                    "escrow_status": payment.escrow_status.value if payment.escrow_status else None,
                    "released_amount": 0.0,
                    "refunded_amount": float(ref_amount),
                })

            # If successful but escrow is not released, sum pending release and add pending transaction
            if payment.status == PaymentStatus.SUCCESS and payment.escrow_status != EscrowStatus.RELEASED:
                total_pending_release += payment.escrow_amount
                transactions.append({
                    "id": f"pay_pending_{payment.id}",
                    "booking_id": booking.id,
                    "booking_display_id": display_booking_id,
                    "transaction_type": "PENDING_SETTLEMENT",
                    "amount": float(payment.escrow_amount),
                    "customer_name": customer_name,
                    "listing_title": listing_title,
                    "status": "PENDING",
                    "created_at": payment.created_at,
                    "payment_id": payment.razorpay_payment_id or str(payment.id),
                    "escrow_status": payment.escrow_status.value if payment.escrow_status else None,
                    "released_amount": 0.0,
                    "refunded_amount": 0.0,
                })
        elif payment.status == PaymentStatus.PENDING:
            transactions.append({
                "id": f"pay_checkout_pending_{payment.id}",
                "booking_id": booking.id,
                "booking_display_id": display_booking_id,
                "transaction_type": tx_type,
                "amount": float(payment.amount),
                "customer_name": customer_name,
                "listing_title": listing_title,
                "status": "PENDING",
                "created_at": payment.created_at,
                "payment_id": payment.razorpay_payment_id or str(payment.id),
                "escrow_status": payment.escrow_status.value if payment.escrow_status else None,
                "released_amount": 0.0,
                "refunded_amount": 0.0,
            })

    # Process payouts to generate SETTLEMENT_RELEASED and PENDING_SETTLEMENT (payout layer) entries
    payouts = db.query(Payout).filter(Payout.vendor_id == vendor.id).all()
    for payout in payouts:
        booking = booking_map.get(payout.booking_id)
        if not booking:
            continue
        listing = listing_map.get(booking.listing_id)
        customer = customer_map.get(booking.user_id)

        customer_name = customer.full_name if customer else "Customer"
        listing_title = listing.title if listing else "Event Listing"

        year = booking.created_at.year if booking.created_at else 2026
        short_uuid = str(booking.id)[:4].upper() if booking.id else "0000"
        display_booking_id = f"BK-{year}-{short_uuid}"

        if payout.status == PayoutStatus.COMPLETED:
            if payout.amount <= 0:
                continue
            transactions.append({
                "id": f"payout_released_{payout.id}",
                "booking_id": booking.id,
                "booking_display_id": display_booking_id,
                "transaction_type": "SETTLEMENT_RELEASED",
                "amount": float(payout.amount),
                "customer_name": customer_name,
                "listing_title": listing_title,
                "status": "SUCCESS",
                "created_at": payout.created_at,
                "payment_id": None,
                "escrow_status": "RELEASED",
                "released_amount": float(payout.amount),
                "refunded_amount": 0.0,
            })
        elif payout.status == PayoutStatus.PENDING:
            if payout.amount <= 0:
                continue
            transactions.append({
                "id": f"payout_pending_{payout.id}",
                "booking_id": booking.id,
                "booking_display_id": display_booking_id,
                "transaction_type": "PENDING_SETTLEMENT",
                "amount": float(payout.amount),
                "customer_name": customer_name,
                "listing_title": listing_title,
                "status": "PENDING",
                "created_at": payout.created_at,
                "payment_id": None,
                "escrow_status": "HELD",
                "released_amount": 0.0,
                "refunded_amount": 0.0,
            })

    transactions.sort(key=lambda t: t["created_at"], reverse=True)

    return {
        "summary": {
            "total_received": total_received,
            "total_refunded": total_refunded,
            "total_pending_release": total_pending_release,
            "total_earned": total_received - total_refunded - total_pending_release,
        },
        "transactions": transactions,
    }


@router.get("/customer/history", response_model=CustomerPaymentHistoryResponse)
def get_customer_payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.modules.bookings.models import Booking, BookingStatus, AdvancePaymentStatus
    from app.modules.listings.models import Listing
    from app.modules.vendors.models import Vendor
    from .models import Payment, PaymentStatus, PaymentType, EscrowStatus

    # Fetch all bookings for this customer
    bookings = db.query(Booking).filter(Booking.user_id == current_user.id).all()
    booking_map = {b.id: b for b in bookings}
    booking_ids = list(booking_map.keys())

    if not booking_ids:
        return {
            "summary": {
                "total_paid": 0.0,
                "total_refunded": 0.0,
                "total_pending_refunds": 0.0,
                "net_spent": 0.0,
            },
            "transactions": [],
        }

    # Fetch listing and vendor maps for descriptions
    listing_ids = list(set([b.listing_id for b in bookings]))
    listings = db.query(Listing).filter(Listing.id.in_(listing_ids)).all()
    listing_map = {l.id: l for l in listings}

    vendor_ids = list(set([l.vendor_id for l in listings]))
    vendors = db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()
    vendor_map = {v.id: v for v in vendors}

    # Fetch payments for customer bookings
    payments = (
        db.query(Payment)
        .filter(
            Payment.booking_id.in_(booking_ids),
            Payment.status.in_([PaymentStatus.SUCCESS, PaymentStatus.REFUNDED, PaymentStatus.PENDING]),
        )
        .order_by(Payment.created_at.desc())
        .all()
    )

    transactions = []
    total_paid = 0.0
    total_refunded = 0.0
    total_pending_refunds = 0.0

    for payment in payments:
        booking = booking_map.get(payment.booking_id)
        if not booking:
            continue
        listing = listing_map.get(booking.listing_id)
        vendor = vendor_map.get(listing.vendor_id) if listing else None

        listing_title = listing.title if listing else "Event Space"
        vendor_name = vendor.business_name if vendor else "ABC Events"

        year = booking.created_at.year if booking.created_at else 2026
        short_uuid = str(booking.id)[:4].upper() if booking.id else "0000"
        display_booking_id = f"BK-{year}-{short_uuid}"

        tx_type = "ADVANCE_PAYMENT" if payment.payment_type == PaymentType.ADVANCE else "FINAL_PAYMENT"

        # A. Process successful payments
        if payment.status in [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED]:
            total_paid += payment.amount
            transactions.append({
                "id": f"cust_pay_success_{payment.id}",
                "booking_id": booking.id,
                "booking_display_id": display_booking_id,
                "transaction_type": tx_type,
                "amount": float(payment.amount),
                "listing_title": listing_title,
                "vendor_name": vendor_name,
                "status": "SUCCESS",
                "created_at": payment.created_at,
                "payment_id": payment.razorpay_payment_id or str(payment.id),
                "refunded_amount": float(payment.refunded_amount or 0),
            })

            # Process completed refund if status is REFUNDED or refunded_amount > 0
            if payment.status == PaymentStatus.REFUNDED or payment.refunded_amount > 0:
                ref_amount = payment.refunded_amount if payment.refunded_amount > 0 else (
                    payment.amount if payment.payment_type == PaymentType.FINAL else int(payment.amount * 0.7)
                )
                total_refunded += ref_amount
                transactions.append({
                    "id": f"cust_refund_rec_{payment.id}",
                    "booking_id": booking.id,
                    "booking_display_id": display_booking_id,
                    "transaction_type": "REFUND_RECEIVED",
                    "amount": float(ref_amount),
                    "listing_title": listing_title,
                    "vendor_name": vendor_name,
                    "status": "SUCCESS",
                    "created_at": payment.created_at,
                    "payment_id": payment.razorpay_payment_id or str(payment.id),
                    "refunded_amount": float(ref_amount),
                })

        # B. Process pending payments
        elif payment.status == PaymentStatus.PENDING:
            transactions.append({
                "id": f"cust_pay_pending_{payment.id}",
                "booking_id": booking.id,
                "booking_display_id": display_booking_id,
                "transaction_type": tx_type,
                "amount": float(payment.amount),
                "listing_title": listing_title,
                "vendor_name": vendor_name,
                "status": "PENDING",
                "created_at": payment.created_at,
                "payment_id": payment.razorpay_payment_id or str(payment.id),
                "refunded_amount": 0.0,
            })

    # C. Process cancellation requested but not fully refunded as REFUND_PENDING
    for booking in bookings:
        if booking.status == BookingStatus.CANCELLATION_REQUESTED:
            # Let's see if there is a successful advance payment to refund
            adv_pay = db.query(Payment).filter(
                Payment.booking_id == booking.id,
                Payment.payment_type == PaymentType.ADVANCE,
                Payment.status == PaymentStatus.SUCCESS
            ).first()

            if adv_pay and adv_pay.refunded_amount == 0:
                expected_refund = int(adv_pay.amount * 0.7)
                total_pending_refunds += expected_refund

                listing = listing_map.get(booking.listing_id)
                vendor = vendor_map.get(listing.vendor_id) if listing else None
                listing_title = listing.title if listing else "Event Space"
                vendor_name = vendor.business_name if vendor else "ABC Events"

                year = booking.created_at.year if booking.created_at else 2026
                short_uuid = str(booking.id)[:4].upper() if booking.id else "0000"
                display_booking_id = f"BK-{year}-{short_uuid}"

                transactions.append({
                    "id": f"cust_refund_pend_{booking.id}",
                    "booking_id": booking.id,
                    "booking_display_id": display_booking_id,
                    "transaction_type": "REFUND_PENDING",
                    "amount": float(expected_refund),
                    "listing_title": listing_title,
                    "vendor_name": vendor_name,
                    "status": "PENDING",
                    "created_at": booking.updated_at or booking.created_at,
                    "payment_id": adv_pay.razorpay_payment_id or str(adv_pay.id),
                    "refunded_amount": 0.0,
                })

        elif booking.status == BookingStatus.CANCELLED:
            # Check if there are no successful payments, or if it was cancelled at PENDING stage
            # We can also add BOOKING_CANCELLED explicitly.
            listing = listing_map.get(booking.listing_id)
            vendor = vendor_map.get(listing.vendor_id) if listing else None
            listing_title = listing.title if listing else "Event Space"
            vendor_name = vendor.business_name if vendor else "ABC Events"

            year = booking.created_at.year if booking.created_at else 2026
            short_uuid = str(booking.id)[:4].upper() if booking.id else "0000"
            display_booking_id = f"BK-{year}-{short_uuid}"

            transactions.append({
                "id": f"cust_booking_cancelled_{booking.id}",
                "booking_id": booking.id,
                "booking_display_id": display_booking_id,
                "transaction_type": "BOOKING_CANCELLED",
                "amount": 0.0,
                "listing_title": listing_title,
                "vendor_name": vendor_name,
                "status": "CANCELLED",
                "created_at": booking.updated_at or booking.created_at,
                "payment_id": None,
                "refunded_amount": 0.0,
            })

    transactions.sort(key=lambda t: t["created_at"], reverse=True)

    return {
        "summary": {
            "total_paid": total_paid,
            "total_refunded": total_refunded,
            "total_pending_refunds": total_pending_refunds,
            "net_spent": total_paid - total_refunded,
        },
        "transactions": transactions,
    }


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
