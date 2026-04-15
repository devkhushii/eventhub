# app/modules/payments/repository.py
from sqlalchemy.orm import Session, joinedload
from app.modules.bookings.models import Booking
from .models import Payment, Payout, PaymentStatus, PaymentType


class PaymentRepository:
    @staticmethod
    def create(db: Session, obj):
        db.add(obj)
        db.flush()
        return obj

    @staticmethod
    def get_by_order_id(db, order_id):
        return (
            db.query(Payment)
            .options(joinedload(Payment.booking).joinedload(Booking.listing))
            .filter(Payment.razorpay_order_id == order_id)
            .first()
        )

    @staticmethod
    def get_by_id(db, payment_id):
        return db.query(Payment).filter(Payment.id == payment_id).first()

    @staticmethod
    def get_success_payment(db, booking_id, payment_type):
        return (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.payment_type == PaymentType[payment_type],
                Payment.status == PaymentStatus.SUCCESS,
            )
            .first()
        )

    @staticmethod
    def get_booking_payments(db, booking_id):
        return db.query(Payment).filter(Payment.booking_id == booking_id).all()

    @staticmethod
    def get_booking_payment_by_type(db, booking_id, payment_type):
        return (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id, Payment.payment_type == payment_type
            )
            .first()
        )


class PayoutRepository:
    @staticmethod
    def create(db: Session, obj):
        db.add(obj)
        db.flush()
        return obj

    @staticmethod
    def get_by_booking_id(db, booking_id):
        return db.query(Payout).filter(Payout.booking_id == booking_id).all()

    @staticmethod
    def get_by_payment_id(db, payment_id):
        return db.query(Payout).filter(Payout.payment_id == payment_id).first()
