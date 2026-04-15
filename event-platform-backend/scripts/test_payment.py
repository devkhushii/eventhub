#!/usr/bin/env python
import sys

sys.path.insert(0, ".")

from app.modules.users.models import User
from app.modules.auth.models import (
    RefreshToken,
    EmailVerificationToken,
    PasswordResetToken,
)
from app.modules.vendors.models import Vendor
from app.modules.listings.models import Listing
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.payments.models import Payment, PaymentType, PaymentStatus

from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

result = db.execute(
    text(
        "SELECT id, total_price FROM bookings WHERE status = 'AWAITING_ADVANCE' LIMIT 1"
    )
)
row = result.fetchone()

if row:
    print(f"Found booking: {row[0]}, total_price: {row[1]}")

    payment = Payment(
        booking_id=row[0],
        amount=1000,
        currency="INR",
        payment_type=PaymentType.ADVANCE,
        status=PaymentStatus.PENDING,
    )
    print("Payment object created successfully!")
    print(f"  - booking_id: {payment.booking_id}")
    print(f"  - amount: {payment.amount}")
    print(f"  - currency: {payment.currency}")
    print(f"  - payment_type: {payment.payment_type}")
    print(f"  - status: {payment.status}")
else:
    print("No AWAITING_ADVANCE booking found")

db.close()
