# scripts/generate_fake_data.py
# Robust fake data generator for FastAPI + SQLAlchemy event platform
# Safe to run multiple times - handles existing data gracefully

import random
from typing import Any
from datetime import datetime, timedelta, timezone
from collections import Counter

from app.db.session import SessionLocal
from app.modules.users.models import User

from app.modules.auth.models import (
    RefreshToken,
    EmailVerificationToken,
    PasswordResetToken,
)
from app.modules.notifications.models import Notification, NotificationType
from app.modules.notifications.models import DeviceToken, DevicePlatform
from app.modules.vendors.models import Vendor, VendorType, VerificationStatus
from app.modules.listings.models import (
    Listing,
    ListingStatus,
    ListingType,
    ListingImage,
)
from app.modules.bookings.models import Booking, BookingStatus, AdvancePaymentStatus
from app.modules.reviews.models import Review
from app.modules.payments.models import (
    Payment,
    Payout,
    PaymentType,
    PaymentStatus,
    EscrowStatus,
    PayoutStatus,
)
from app.modules.chat.models import ChatRoom, Message
from app.core.security import hash_password
from app.modules.payments.constant import ADVANCE_PERCENTAGE, ADVANCE_TO_VENDOR_PERCENT

from faker import Faker

fake = Faker()

db = SessionLocal()

# --- CONSTANTS ---

SERVICE_TYPES = [
    ListingType.VENUE,
    ListingType.DJ,
    ListingType.CATERER,
    ListingType.DECORATOR,
    ListingType.PHOTOGRAPHER,
    ListingType.EVENT_MANAGER,
    ListingType.OTHER,
]

LISTING_STATUSES = [
    ListingStatus.PUBLISHED,
    ListingStatus.DRAFT,
    ListingStatus.ARCHIVED,
]

BOOKING_STATUS_DISTRIBUTION = [
    (BookingStatus.PENDING, 10),
    (BookingStatus.AWAITING_ADVANCE, 15),
    (BookingStatus.CONFIRMED, 20),
    (BookingStatus.AWAITING_FINAL_PAYMENT, 10),
    (BookingStatus.COMPLETED, 25),
    (BookingStatus.CANCELLATION_REQUESTED, 5),
    (BookingStatus.CANCELLED, 8),
    (BookingStatus.REJECTED, 4),
    (BookingStatus.PAYMENT_FAILED, 3),
]

VENDOR_TYPES = [VendorType.INDIVIDUAL, VendorType.MANAGER]

VERIFICATION_STATUSES = [
    VerificationStatus.PENDING,
    VerificationStatus.APPROVED,
    VerificationStatus.REJECTED,
]

PAYMENT_TYPES = [PaymentType.ADVANCE, PaymentType.FINAL]

PAYMENT_STATUSES = [
    PaymentStatus.PENDING,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.REFUNDED,
]

ESCROW_STATUSES = [
    EscrowStatus.PENDING,
    EscrowStatus.HELD,
    EscrowStatus.PARTIALLY_RELEASED,
    EscrowStatus.RELEASED,
    EscrowStatus.REFUNDED,
]

PAYOUT_STATUSES = [PayoutStatus.PENDING, PayoutStatus.COMPLETED, PayoutStatus.FAILED]

CITIES = [
    "Mumbai",
    "Delhi",
    "Bangalore",
    "Hyderabad",
    "Kolkata",
    "Chennai",
    "Pune",
    "Ahmedabad",
    "Jaipur",
    "Surat",
    "Lucknow",
    "Kanpur",
    "Nagpur",
    "Indore",
]

CURRENCY = "INR"


# --- HELPER FUNCTIONS ---


def get_random_safe(items: list) -> Any:
    if not items:
        return None
    return random.choice(items)


def get_random_sample_safe(items: list, n: int) -> list:
    if not items or n <= 0:
        return []
    return random.sample(items, min(n, len(items)))


def pick_weighted(weighted_items: list) -> Any:
    items, weights = zip(*weighted_items)
    return random.choices(items, weights=weights, k=1)[0]


def compute_total_days(event_date: datetime, end_date: datetime | None) -> int:
    if not end_date:
        return 1
    delta = (end_date.date() - event_date.date()).days + 1
    return max(delta, 1)


# --- CORE FUNCTIONS ---


def create_admin_user():
    existing_admin = db.query(User).filter(User.email == "admin@eventhub.com").first()
    if existing_admin:
        print("Admin user already exists, skipping")
        return existing_admin

    admin = User(
        email="admin@eventhub.com",
        password_hash=hash_password("admin123"),
        full_name="System Admin",
        phone="+919999999999",
        avatar_url=fake.image_url(width=200, height=200),
        role="ADMIN",
        is_admin=True,
        is_active=True,
        is_verified=True,
        expo_push_token=None,
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    print("Admin user created")
    return admin


def create_users(n=30):
    existing_count = db.query(User).count()
    existing_users = db.query(User).filter(User.role == "USER").all()

    if len(existing_users) >= n:
        print(f"Users already exist ({len(existing_users)}), using existing users")
        return existing_users[:n]

    users_to_create = n - len(existing_users)
    print(f"Creating {users_to_create} additional users...")

    new_users = []
    for _ in range(users_to_create):
        try:
            user = User(
                email=fake.unique.email(),
                password_hash=hash_password("password123"),
                full_name=fake.name(),
                phone=fake.phone_number()[:20],
                avatar_url=fake.image_url(width=200, height=200),
                fcm_token=fake.uuid4() if random.random() > 0.5 else None,
                device_token=fake.uuid4() if random.random() > 0.7 else None,
                expo_push_token=f"ExponentPushToken[{fake.uuid4()}]"
                if random.random() > 0.6
                else None,
                role="USER",
                is_admin=False,
                is_active=True,
                is_verified=random.choice([True, True, True, False]),
            )
            db.add(user)
            new_users.append(user)
        except Exception as e:
            print(f"Warning: Could not create user: {e}")
            continue

    if new_users:
        db.commit()
        print(f"{len(new_users)} users created")

    all_users = db.query(User).filter(User.role == "USER").all()
    return all_users[:n]


def create_vendors(users, n=12):
    if not users:
        print("No users available for vendor creation")
        return []

    existing_vendor_user_ids = {v.user_id for v in db.query(Vendor).all()}
    non_vendor_users = [u for u in users if u.id not in existing_vendor_user_ids]

    if not non_vendor_users:
        print("No eligible users for vendor creation")
        return []

    users_to_make_vendor = min(n, len(non_vendor_users))
    selected_users = get_random_sample_safe(non_vendor_users, users_to_make_vendor)

    if not selected_users:
        return []

    vendors = []
    for user in selected_users:
        verification_status = random.choice(VERIFICATION_STATUSES)

        vendor = Vendor(
            user_id=user.id,
            vendor_type=random.choice(VENDOR_TYPES),
            business_name=fake.company(),
            description=fake.text(max_nb_chars=500),
            verification_status=verification_status,
            rejection_reason=None
            if verification_status != VerificationStatus.REJECTED
            else fake.sentence(),
            rating=round(random.uniform(2.5, 5.0), 1),
            total_reviews=random.randint(0, 100),
            is_active=True,
        )

        db.add(vendor)
        vendors.append(vendor)

    db.commit()

    print(f"{len(vendors)} vendors created")
    return vendors


def create_listings(vendors, n=40):
    if not vendors:
        print("No vendors available to create listings")
        return []

    listings = []

    for _ in range(n):
        vendor = get_random_safe(vendors)
        if not vendor:
            continue

        service = get_random_safe(SERVICE_TYPES)
        if not service:
            continue

        start = datetime.now(timezone.utc) + timedelta(days=random.randint(1, 30))
        end = start + timedelta(days=random.randint(1, 7))

        listing = Listing(
            vendor_id=vendor.id,
            title=f"{service.value} Service - {fake.company()}",
            description=fake.paragraph(nb_sentences=5),
            listing_type=service,
            price=round(random.uniform(500, 25000), 2),
            location=get_random_safe(CITIES) or "Mumbai",
            start_date=start,
            end_date=end,
            details={
                "capacity": random.randint(10, 500)
                if service == ListingType.VENUE
                else None,
                "duration_hours": get_random_safe([4, 6, 8, 12])
                if service != ListingType.VENUE
                else None,
                "equipment_included": get_random_safe([True, False])
                if service in [ListingType.DJ, ListingType.PHOTOGRAPHER]
                else None,
                "specializations": [fake.word() for _ in range(random.randint(1, 3))],
            },
            status=get_random_safe(LISTING_STATUSES) or ListingStatus.PUBLISHED,
            is_active=True,
        )

        db.add(listing)
        listings.append(listing)

    db.commit()

    print(f"{len(listings)} listings created")
    return listings


def add_listing_images(listings):
    if not listings:
        print("No listings to add images to")
        return 0

    total_images = 0

    for listing in listings:
        image_count = random.randint(2, 6)

        for _ in range(image_count):
            image = ListingImage(
                listing_id=listing.id,
                image_url="https://share.google/mjMSKe4QvxRc2B1Ud",
            )
            db.add(image)
            total_images += 1

    db.commit()

    print(f"{total_images} listing images added")
    return total_images


def create_bookings(users, listings, n=60):
    if not users:
        print("No users available to create bookings")
        return []

    if not listings:
        print("No listings available to create bookings")
        return []

    bookings = []

    for _ in range(n):
        user = get_random_safe(users)
        listing = get_random_safe(listings)

        if not user or not listing:
            continue

        now = datetime.now(timezone.utc)

        status = pick_weighted(BOOKING_STATUS_DISTRIBUTION)

        event_date_delta = random.randint(5, 120)
        event_date = now + timedelta(days=event_date_delta)
        is_multi_day = random.random() > 0.4
        if is_multi_day:
            end_date = event_date + timedelta(days=random.randint(1, 3))
        else:
            end_date = event_date + timedelta(hours=random.choice([4, 6, 8, 12]))

        total_days = compute_total_days(event_date, end_date)
        total_price = listing.price * total_days
        advance_amount = round(total_price * ADVANCE_PERCENTAGE, 2)

        advance_paid = False
        advance_payment_status = AdvancePaymentStatus.NONE
        booking_advance_amount = None

        if status == BookingStatus.PENDING:
            advance_paid = False
            advance_payment_status = AdvancePaymentStatus.NONE
            booking_advance_amount = None

        elif status == BookingStatus.AWAITING_ADVANCE:
            advance_paid = False
            advance_payment_status = AdvancePaymentStatus.PENDING
            booking_advance_amount = advance_amount

        elif status in (
            BookingStatus.CONFIRMED,
            BookingStatus.AWAITING_FINAL_PAYMENT,
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLATION_REQUESTED,
        ):
            advance_paid = True
            advance_payment_status = AdvancePaymentStatus.PAID
            booking_advance_amount = advance_amount

        elif status in (BookingStatus.CANCELLED, BookingStatus.REJECTED):
            advance_paid = False
            advance_payment_status = AdvancePaymentStatus.NONE
            booking_advance_amount = None

        elif status == BookingStatus.PAYMENT_FAILED:
            advance_paid = False
            advance_payment_status = AdvancePaymentStatus.FAILED
            booking_advance_amount = advance_amount

        booking = Booking(
            user_id=user.id,
            listing_id=listing.id,
            event_date=event_date,
            end_date=end_date,
            total_days=total_days,
            total_price=round(total_price, 2),
            status=status,
            advance_amount=booking_advance_amount,
            advance_paid=advance_paid,
            advance_payment_status=advance_payment_status,
            special_request=fake.sentence() if random.random() > 0.5 else None,
        )

        db.add(booking)
        bookings.append(booking)

    db.commit()

    print(f"{len(bookings)} bookings created")
    return bookings


def create_payments(bookings):
    if not bookings:
        print("No bookings available to create payments")
        return []

    payments = []

    for booking in bookings:
        listing = db.query(Listing).filter(Listing.id == booking.listing_id).first()
        if not listing:
            continue

        status = booking.status

        advance_amount = int(booking.total_price * ADVANCE_PERCENTAGE)
        final_amount = int(
            booking.total_price - (booking.total_price * ADVANCE_PERCENTAGE)
        )

        if status == BookingStatus.AWAITING_ADVANCE:
            payment = Payment(
                booking_id=booking.id,
                amount=advance_amount,
                currency=CURRENCY,
                payment_type=PaymentType.ADVANCE,
                status=PaymentStatus.PENDING,
                escrow_status=EscrowStatus.PENDING,
                vendor_released_amount=0,
                escrow_amount=0,
                refunded_amount=0,
                refund_percentage=0.0,
                razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                razorpay_payment_id=None,
            )
            db.add(payment)
            payments.append(payment)

        elif status in (
            BookingStatus.CONFIRMED,
            BookingStatus.AWAITING_FINAL_PAYMENT,
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLATION_REQUESTED,
        ):
            vendor_share = int(advance_amount * ADVANCE_TO_VENDOR_PERCENT)
            escrow_share = advance_amount - vendor_share

            escrow_status = EscrowStatus.PARTIALLY_RELEASED
            if status == BookingStatus.CONFIRMED:
                escrow_status = EscrowStatus.PARTIALLY_RELEASED
            elif status == BookingStatus.AWAITING_FINAL_PAYMENT:
                escrow_status = EscrowStatus.HELD
            elif status == BookingStatus.COMPLETED:
                escrow_status = EscrowStatus.RELEASED
            elif status == BookingStatus.CANCELLATION_REQUESTED:
                escrow_status = EscrowStatus.HELD

            advance_payment = Payment(
                booking_id=booking.id,
                amount=advance_amount,
                currency=CURRENCY,
                payment_type=PaymentType.ADVANCE,
                status=PaymentStatus.SUCCESS,
                escrow_status=escrow_status,
                vendor_released_amount=vendor_share,
                escrow_amount=escrow_share,
                refunded_amount=0,
                refund_percentage=0.0,
                razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                razorpay_payment_id=f"pay_{fake.uuid4().replace('-', '')[:20]}",
            )
            db.add(advance_payment)
            payments.append(advance_payment)

            if status == BookingStatus.AWAITING_FINAL_PAYMENT:
                final_payment = Payment(
                    booking_id=booking.id,
                    amount=final_amount,
                    currency=CURRENCY,
                    payment_type=PaymentType.FINAL,
                    status=PaymentStatus.PENDING,
                    escrow_status=EscrowStatus.PENDING,
                    vendor_released_amount=0,
                    escrow_amount=0,
                    refunded_amount=0,
                    refund_percentage=0.0,
                    razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                    razorpay_payment_id=None,
                )
                db.add(final_payment)
                payments.append(final_payment)

            elif status == BookingStatus.COMPLETED:
                final_payment = Payment(
                    booking_id=booking.id,
                    amount=final_amount,
                    currency=CURRENCY,
                    payment_type=PaymentType.FINAL,
                    status=PaymentStatus.SUCCESS,
                    escrow_status=EscrowStatus.HELD,
                    vendor_released_amount=0,
                    escrow_amount=final_amount,
                    refunded_amount=0,
                    refund_percentage=0.0,
                    razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                    razorpay_payment_id=f"pay_{fake.uuid4().replace('-', '')[:20]}",
                )
                db.add(final_payment)
                payments.append(final_payment)

        elif status == BookingStatus.PAYMENT_FAILED:
            payment = Payment(
                booking_id=booking.id,
                amount=advance_amount,
                currency=CURRENCY,
                payment_type=PaymentType.ADVANCE,
                status=PaymentStatus.FAILED,
                escrow_status=EscrowStatus.PENDING,
                vendor_released_amount=0,
                escrow_amount=0,
                refunded_amount=0,
                refund_percentage=0.0,
                razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                razorpay_payment_id=f"pay_{fake.uuid4().replace('-', '')[:20]}",
            )
            db.add(payment)
            payments.append(payment)

    db.commit()

    print(f"{len(payments)} payments created")
    return payments


def refund_advance_payments(bookings, payments):
    for booking in bookings:
        if booking.status != BookingStatus.CANCELLED:
            continue
        advance_payment = next(
            (
                p
                for p in payments
                if p.booking_id == booking.id
                and p.payment_type == PaymentType.ADVANCE
                and p.status == PaymentStatus.SUCCESS
            ),
            None,
        )
        if advance_payment is None:
            continue
        refund_percentage = 0.7
        refund_amount = int(advance_payment.amount * refund_percentage)
        advance_payment.status = PaymentStatus.REFUNDED
        advance_payment.escrow_status = EscrowStatus.REFUNDED
        advance_payment.refunded_amount = refund_amount
        advance_payment.refund_percentage = refund_percentage

    for booking in bookings:
        if booking.status != BookingStatus.CANCELLATION_REQUESTED:
            continue
        advance_payment = next(
            (
                p
                for p in payments
                if p.booking_id == booking.id
                and p.payment_type == PaymentType.ADVANCE
                and p.status == PaymentStatus.SUCCESS
            ),
            None,
        )
        if advance_payment is None:
            continue
        refund_percentage = 0.7
        refund_amount = int(advance_payment.amount * refund_percentage)
        advance_payment.status = PaymentStatus.REFUNDED
        advance_payment.escrow_status = EscrowStatus.REFUNDED
        advance_payment.refunded_amount = refund_amount
        advance_payment.refund_percentage = refund_percentage
        booking.status = BookingStatus.CANCELLED

    db.commit()


def create_payouts(payments):
    if not payments:
        print("No payments available to create payouts")
        return []

    payouts = []

    for payment in payments:
        if payment.status != PaymentStatus.SUCCESS:
            continue
        if not payment.booking:
            continue
        listing = (
            db.query(Listing).filter(Listing.id == payment.booking.listing_id).first()
        )
        if not listing:
            continue

        vendor_share = payment.vendor_released_amount or 0
        if vendor_share <= 0:
            continue

        payout = Payout(
            booking_id=payment.booking_id,
            payment_id=payment.id,
            vendor_id=listing.vendor_id,
            amount=vendor_share,
            currency=CURRENCY,
            status=PayoutStatus.COMPLETED,
        )
        db.add(payout)
        payouts.append(payout)

    db.commit()

    print(f"{len(payouts)} payouts created")
    return payouts


def create_reviews(bookings, n=40):
    if not bookings:
        print("No bookings available for reviews")
        return []

    completed_bookings = [b for b in bookings if b.status == BookingStatus.COMPLETED]

    if not completed_bookings:
        print("No completed bookings available for reviews")
        return []

    selected_bookings = get_random_sample_safe(completed_bookings, n)

    if not selected_bookings:
        return []

    for booking in selected_bookings:
        review = Review(
            booking_id=booking.id,
            user_id=booking.user_id,
            listing_id=booking.listing_id,
            rating=random.randint(3, 5),
            comment=fake.paragraph(nb_sentences=3) if random.random() > 0.2 else None,
        )
        db.add(review)

    db.commit()

    print(f"{len(selected_bookings)} reviews created")
    return selected_bookings


def create_chat_rooms(users, vendors, listings, bookings, n=30):
    if not users or not vendors:
        print("No users/vendors available for chat rooms")
        return []

    chat_rooms = []
    used_pairs = set()

    for _ in range(n):
        user = get_random_safe(users)
        vendor = get_random_safe(vendors)

        if not user or not vendor:
            continue

        pair = (user.id, vendor.id)
        if pair in used_pairs and len(used_pairs) < len(users) * len(vendors):
            continue
        used_pairs.add(pair)

        listing = get_random_safe(listings) if random.random() > 0.3 else None
        booking = get_random_safe(bookings) if random.random() > 0.5 else None

        chat_room = ChatRoom(
            user_id=user.id,
            vendor_id=vendor.id,
            listing_id=listing.id if listing else None,
            booking_id=booking.id if booking else None,
        )

        db.add(chat_room)
        chat_rooms.append(chat_room)

    db.commit()

    print(f"{len(chat_rooms)} chat rooms created")
    return chat_rooms


def create_messages(chat_rooms, users, n=100):
    if not chat_rooms or not users:
        print("No chat rooms/users available for messages")
        return []

    messages = []

    for chat_room in chat_rooms:
        message_count = random.randint(3, 15)

        for _ in range(message_count):
            sender_id = random.choice([chat_room.user_id, users[0].id])

            message = Message(
                chat_id=chat_room.id,
                sender_id=sender_id,
                content=fake.sentence(nb_words=random.randint(5, 20)),
                is_read=random.choice([True, True, False]),
            )

            db.add(message)
            messages.append(message)

    db.commit()

    print(f"{len(messages)} messages created")
    return messages


def create_notifications(users, bookings):
    if not users:
        return 0

    count = 0

    for user in get_random_sample_safe(users, min(20, len(users))):
        notification = Notification(
            user_id=user.id,
            type=random.choice(
                [
                    NotificationType.SYSTEM,
                    NotificationType.BOOKING,
                    NotificationType.PAYMENT,
                ]
            ),
            reference_id=None,
            title=random.choice(
                [
                    "Welcome to EventHub!",
                    "Your booking is confirmed",
                    "Payment successful",
                    "New features available",
                    "Vendor application update",
                ]
            ),
            message=fake.sentence(nb_words=10),
            is_read=random.choice([True, False]),
        )
        db.add(notification)
        count += 1

    for booking in bookings:
        if booking.status in (
            BookingStatus.CONFIRMED,
            BookingStatus.COMPLETED,
            BookingStatus.AWAITING_ADVANCE,
        ):
            notification = Notification(
                user_id=booking.user_id,
                type=NotificationType.BOOKING,
                reference_id=booking.id,
                title="Booking Update",
                message=f"Your booking status is: {booking.status.value}",
                is_read=random.random() > 0.3,
            )
            db.add(notification)
            count += 1

    db.commit()

    print(f"{count} notifications created")
    return count


def create_device_tokens(users):
    if not users:
        return 0

    count = 0
    for user in get_random_sample_safe(users, min(15, len(users))):
        for _ in range(random.randint(1, 2)):
            platform = random.choice(
                [DevicePlatform.ANDROID, DevicePlatform.IOS, DevicePlatform.WEB]
            )
            token = DeviceToken(
                user_id=user.id,
                token=fake.uuid4(),
                platform=platform,
                device_id=fake.uuid4()[:8],
                app_version=f"{random.randint(1, 5)}.{random.randint(0, 9)}.0",
                is_active=True,
            )
            db.add(token)
            count += 1

    db.commit()

    print(f"{count} device tokens created")
    return count


# --- VERIFICATION ---


def print_summary(
    users, vendors, listings, bookings, payments, payouts, reviews, chat_rooms, messages
):
    print()
    print("=" * 60)
    print("  VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"  Records created per model:")
    print(f"    {'Users:':20} {len(users):>4}")
    print(f"    {'Vendors:':20} {len(vendors):>4}")
    print(f"    {'Listings:':20} {len(listings):>4}")
    print(f"    {'Bookings:':20} {len(bookings):>4}")
    print(f"    {'Payments:':20} {len(payments):>4}")
    print(f"    {'Payouts:':20} {len(payouts):>4}")
    print(f"    {'Reviews:':20} {len(reviews):>4}")
    print(f"    {'Chat Rooms:':20} {len(chat_rooms):>4}")
    print(f"    {'Messages:':20} {len(messages):>4}")
    print(f"    {'Notifications:':20} {db.query(Notification).count():>4}")
    print(f"    {'Device Tokens:':20} {db.query(DeviceToken).count():>4}")
    print()

    status_counts = Counter(b.status.value for b in bookings)
    print(f"  Booking Status Distribution:")
    for status_name in sorted(status_counts.keys()):
        print(f"    {status_name + ':':30} {status_counts[status_name]:>4}")
    print()

    payment_status_counts = Counter(p.status.value for p in payments)
    print(f"  Payment Status Distribution:")
    for status_name in sorted(payment_status_counts.keys()):
        print(f"    {status_name + ':':30} {payment_status_counts[status_name]:>4}")
    print()

    payment_type_counts = Counter(p.payment_type.value for p in payments)
    print(f"  Payment Type Distribution:")
    for type_name in sorted(payment_type_counts.keys()):
        print(f"    {type_name + ':':30} {payment_type_counts[type_name]:>4}")
    print()

    total_booking_price = sum(b.total_price for b in bookings)
    total_payment_amount = sum(p.amount for p in payments)
    print(f"  Payment Statistics:")
    print(f"    {'Total booking value (INR):':30} {total_booking_price:>10.2f}")
    print(f"    {'Total payment amount:':30} {total_payment_amount:>10}")
    print()

    refunded_payments = [p for p in payments if p.status == PaymentStatus.REFUNDED]
    total_refunded = sum(p.refunded_amount or 0 for p in refunded_payments)
    print(f"  Refund Statistics:")
    print(f"    {'Refunded payments:':30} {len(refunded_payments):>4}")
    print(f"    {'Total refunded amount:':30} {total_refunded:>10}")
    print()

    inconsistencies = []

    for b in bookings:
        if b.status in (
            BookingStatus.CONFIRMED,
            BookingStatus.AWAITING_FINAL_PAYMENT,
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLATION_REQUESTED,
        ):
            if not b.advance_paid:
                inconsistencies.append(
                    f"Booking {b.id}: status={b.status.value} but advance_paid=False"
                )
            if b.total_days is None or b.total_days < 1:
                inconsistencies.append(
                    f"Booking {b.id}: invalid total_days={b.total_days}"
                )

    if inconsistencies:
        print(f"  DETECTED INCONSISTENCIES ({len(inconsistencies)}):")
        for inc in inconsistencies[:10]:
            print(f"    - {inc}")
        if len(inconsistencies) > 10:
            print(f"    ... and {len(inconsistencies) - 10} more")
    else:
        print(f"  No inconsistencies detected. All records valid.")
    print("=" * 60)


# --- MAIN RUN FUNCTION ---


def run():
    print("Generating realistic event marketplace data...")
    print("-" * 50)

    admin = create_admin_user()
    print()

    users = create_users(40)
    if not users:
        print("FATAL: No users created. Aborting.")
        db.close()
        return
    print(f"Total users available: {len(users)}")
    print()

    vendors = create_vendors(users, 15)
    if not vendors:
        print("No vendors created. Aborting further data generation.")
        db.close()
        return
    print(f"Total vendors available: {len(vendors)}")
    print()

    listings = create_listings(vendors, 50)
    if not listings:
        print("No listings created. Aborting further data generation.")
        db.close()
        return
    print(f"Total listings available: {len(listings)}")
    print()

    add_listing_images(listings)
    print()

    bookings = create_bookings(users, listings, 70)
    if not bookings:
        print("No bookings created. Aborting further data generation.")
        db.close()
        return
    print(f"Total bookings available: {len(bookings)}")
    print()

    payments = create_payments(bookings)
    print(f"Total payments available: {len(payments)}")
    print()

    refund_advance_payments(bookings, payments)
    print("Refund processing completed")
    print()

    payouts = create_payouts(payments)
    print()

    reviews = create_reviews(bookings, 40)
    print()

    chat_rooms = create_chat_rooms(users, vendors, listings, bookings, 30)
    print(f"Total chat rooms available: {len(chat_rooms)}")
    print()

    messages = create_messages(chat_rooms, users, 100)
    print()

    create_notifications(users, bookings)
    print()

    create_device_tokens(users)
    print()

    print_summary(
        users,
        vendors,
        listings,
        bookings,
        payments,
        payouts,
        reviews,
        chat_rooms,
        messages,
    )


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        db.rollback()
        raise
    finally:
        db.close()
