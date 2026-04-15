# app/modules/payments/payout_service.py
import logging
from sqlalchemy.orm import Session
from uuid import UUID

from app.modules.payments.models import Payout, PayoutStatus
from app.modules.payments.repository import PayoutRepository
from app.modules.bookings.repository import BookingRepository
from app.modules.listings.repository import ListingRepository

logger = logging.getLogger(__name__)


class PayoutService:
    @staticmethod
    def create_payout(
        db: Session,
        payment_id: UUID,
        booking_id: UUID,
        vendor_id: UUID,
        amount: int,
        currency: str = "INR",
    ):
        logger.info(
            f"Creating payout: payment_id={payment_id}, vendor={vendor_id}, amount={amount}"
        )

        payout = Payout(
            payment_id=payment_id,
            booking_id=booking_id,
            vendor_id=vendor_id,
            amount=amount,
            currency=currency,
            status=PayoutStatus.COMPLETED,
        )

        PayoutRepository.create(db, payout)
        logger.info(f"Payout created: payout_id={payout.id}")
        return payout

    @staticmethod
    def create_escrow_release_payout(
        db: Session,
        booking_id: UUID,
        vendor_id: UUID,
        amount: int,
        currency: str = "INR",
    ):
        logger.info(
            f"Creating escrow release payout: booking_id={booking_id}, vendor={vendor_id}, amount={amount}"
        )

        payout = Payout(
            booking_id=booking_id,
            vendor_id=vendor_id,
            amount=amount,
            currency=currency,
            status=PayoutStatus.COMPLETED,
        )

        PayoutRepository.create(db, payout)
        logger.info(f"Escrow payout created: payout_id={payout.id}")
        return payout

    @staticmethod
    def get_booking_payouts(db: Session, booking_id: UUID):
        return PayoutRepository.get_by_booking_id(db, booking_id)
