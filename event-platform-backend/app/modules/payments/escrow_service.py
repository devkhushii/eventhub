# app/modules/payments/escrow_service.py
import logging
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone

from app.modules.bookings.models import BookingStatus
from app.modules.payments.models import (
    Payment,
    PaymentStatus,
    PaymentType,
    EscrowStatus,
    Payout,
    PayoutStatus,
)
from app.modules.payments.repository import PaymentRepository, PayoutRepository
from app.modules.payments.constant import ADVANCE_TO_VENDOR_PERCENT, PLATFORM_COMMISSION

logger = logging.getLogger(__name__)


class EscrowService:
    @staticmethod
    def process_advance_escrow(db: Session, payment: Payment):
        logger.info(f"Processing advance escrow: payment_id={payment.id}")

        payment.escrow_status = EscrowStatus.HELD

        vendor_share = int(payment.amount * ADVANCE_TO_VENDOR_PERCENT)
        escrow_share = payment.amount - vendor_share

        payment.vendor_released_amount = vendor_share
        payment.escrow_amount = escrow_share

        payment.booking.status = BookingStatus.CONFIRMED

        payment.escrow_status = EscrowStatus.PARTIALLY_RELEASED

        logger.info(f"Advance escrow: vendor={vendor_share}, held={escrow_share}")
        return payment

    @staticmethod
    def process_final_escrow(db: Session, payment: Payment):
        logger.info(f"Processing final escrow: payment_id={payment.id}")

        payment.escrow_status = EscrowStatus.HELD
        payment.escrow_amount = payment.amount

        payment.booking.status = BookingStatus.COMPLETED

        logger.info(f"Final escrow held: amount={payment.amount}")
        return payment

    @staticmethod
    def release_escrow(db: Session, booking_id: UUID):
        logger.info(f"Releasing escrow: booking_id={booking_id}")

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

        for p in payments:
            p.escrow_status = EscrowStatus.RELEASED

        logger.info(
            f"Escrow released: total={total_escrow}, vendor={vendor_amount}, commission={commission}"
        )
        return vendor_amount, commission

    @staticmethod
    def refund_escrow(db: Session, payment: Payment):
        logger.info(f"Refunding escrow: payment_id={payment.id}")

        payment.escrow_status = EscrowStatus.REFUNDED

        logger.info(f"Escrow refunded for payment: {payment.id}")
        return payment
