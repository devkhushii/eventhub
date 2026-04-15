# scripts/generate_fake_data.py

import random
from faker import Faker
from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.modules.users.models import User

# Import auth models first to ensure they're registered before User is used
from app.modules.auth.models import (
    RefreshToken,
    EmailVerificationToken,
    PasswordResetToken,
)
from app.modules.notifications.models import Notification

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
from app.modules.notifications.models import Notification

fake = Faker()

db = SessionLocal()

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

BOOKING_STATUSES = [
    BookingStatus.PENDING,
    BookingStatus.APPROVED,
    BookingStatus.AWAITING_ADVANCE,
    BookingStatus.CONFIRMED,
    BookingStatus.AWAITING_FINAL_PAYMENT,
    BookingStatus.COMPLETED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
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


# -----------------------
# CREATE USERS
# -----------------------


def create_users(n=30):
    existing_count = db.query(User).count()
    if existing_count > 1:
        print(f"Users already exist ({existing_count}), skipping user creation")
        return db.query(User).filter(User.role == "USER").limit(n).all()

    users = []

    for _ in range(n):
        user = User(
            email=fake.unique.email(),
            password_hash=hash_password("password123"),
            full_name=fake.name(),
            phone=fake.phone_number()[:20],
            avatar_url=fake.image_url(width=200, height=200),
            fcm_token=fake.uuid4() if random.random() > 0.5 else None,
            device_token=fake.uuid4() if random.random() > 0.7 else None,
            role="USER",
            is_admin=False,
            is_active=True,
            is_verified=random.choice([True, True, True, False]),
        )

        db.add(user)
        users.append(user)

    db.commit()

    print(f"{n} users created")

    return users


# -----------------------
# CREATE ADMIN USER
# -----------------------


def create_admin_user():
    from app.modules.users.models import User

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
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    print("Admin user created")

    return admin


# -----------------------
# CREATE VENDORS
# -----------------------


def create_vendors(users, n=12):
    vendors = []

    non_vendor_users = [
        u for u in users if not hasattr(u, "vendor") or u.vendor is None
    ]

    selected_users = random.sample(non_vendor_users, min(n, len(non_vendor_users)))

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

    print(f"{n} vendors created")

    return vendors


# -----------------------
# CREATE LISTINGS
# -----------------------


def create_listings(vendors, n=40):
    listings = []

    for _ in range(n):
        vendor = random.choice(vendors)
        service = random.choice(SERVICE_TYPES)

        start = datetime.now(timezone.utc) + timedelta(days=random.randint(1, 30))
        end = start + timedelta(days=random.randint(1, 7))

        listing = Listing(
            vendor_id=vendor.id,
            title=f"{service.value} Service - {fake.company()}",
            description=fake.paragraph(nb_sentences=5),
            listing_type=service,
            price=round(random.uniform(500, 25000), 2),
            location=random.choice(CITIES),
            start_date=start,
            end_date=end,
            details={
                "capacity": random.randint(10, 500)
                if service == ListingType.VENUE
                else None,
                "duration_hours": random.choice([4, 6, 8, 12])
                if service != ListingType.VENUE
                else None,
                "equipment_included": random.choice([True, False])
                if service in [ListingType.DJ, ListingType.PHOTOGRAPHER]
                else None,
                "specializations": [fake.word() for _ in range(random.randint(1, 3))],
            },
            status=random.choice(LISTING_STATUSES),
            is_active=True,
        )

        db.add(listing)
        db.flush()

        listings.append(listing)

    db.commit()

    print(f"{n} listings created")

    return listings


# -----------------------
# ADD IMAGES TO LISTINGS
# -----------------------


def add_listing_images(listings):
    total_images = 0

    for listing in listings:
        image_count = random.randint(2, 6)

        for _ in range(image_count):
            image = ListingImage(
                listing_id=listing.id,
                image_url=f"https://picsum.photos/seed/{fake.uuid4()}/800/600",
            )

            db.add(image)
            total_images += 1

    db.commit()

    print(f"{total_images} listing images added")


# -----------------------
# CREATE BOOKINGS
# -----------------------


def create_bookings(users, listings, n=60):
    bookings = []

    for _ in range(n):
        user = random.choice(users)
        listing = random.choice(listings)

        event_date = datetime.now(timezone.utc) + timedelta(days=random.randint(5, 120))
        end_date = event_date + timedelta(hours=random.choice([4, 6, 8, 12]))

        total_price = listing.price * random.uniform(0.8, 1.5)
        advance_amount = round(total_price * 0.3, 2)

        status = random.choice(BOOKING_STATUSES)

        advance_paid = (
            status in [BookingStatus.CONFIRMED, BookingStatus.COMPLETED]
            if random.random() > 0.3
            else False
        )
        advance_payment_status = (
            AdvancePaymentStatus.PAID
            if advance_paid
            else (
                AdvancePaymentStatus.PENDING
                if advance_amount
                else AdvancePaymentStatus.NONE
            )
        )

        booking = Booking(
            user_id=user.id,
            listing_id=listing.id,
            event_date=event_date,
            end_date=end_date,
            total_price=round(total_price, 2),
            status=status,
            advance_amount=advance_amount if random.choice([True, False]) else None,
            advance_paid=advance_paid,
            advance_payment_status=advance_payment_status,
            special_request=fake.sentence() if random.random() > 0.5 else None,
        )

        db.add(booking)
        db.flush()
        bookings.append(booking)

    db.commit()

    print(f"{n} bookings created")

    return bookings


# -----------------------
# CREATE PAYMENTS
# -----------------------


def create_payments(bookings):
    payments = []

    for booking in bookings:
        if booking.status in [
            BookingStatus.CONFIRMED,
            BookingStatus.AWAITING_FINAL_PAYMENT,
            BookingStatus.COMPLETED,
        ]:
            if booking.advance_paid and booking.advance_amount:
                advance_amount_cents = int(booking.advance_amount * 100)

                escrow_status = EscrowStatus.PENDING
                if booking.status == BookingStatus.CONFIRMED:
                    escrow_status = EscrowStatus.PARTIALLY_RELEASED
                elif booking.status == BookingStatus.AWAITING_FINAL_PAYMENT:
                    escrow_status = EscrowStatus.HELD
                elif booking.status == BookingStatus.COMPLETED:
                    escrow_status = random.choice(
                        [EscrowStatus.RELEASED, EscrowStatus.PARTIALLY_RELEASED]
                    )

                vendor_released = (
                    int(advance_amount_cents * 0.3)
                    if booking.status == BookingStatus.CONFIRMED
                    else 0
                )

                payment = Payment(
                    booking_id=booking.id,
                    amount=advance_amount_cents,
                    payment_type=PaymentType.ADVANCE,
                    status=PaymentStatus.SUCCESS,
                    escrow_status=escrow_status,
                    vendor_released_amount=vendor_released,
                    escrow_amount=advance_amount_cents - vendor_released,
                    razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                    razorpay_payment_id=f"pay_{fake.uuid4().replace('-', '')[:20]}",
                    payment_link_id=f"pl_{fake.uuid4().replace('-', '')[:12]}",
                    payment_link_url=f"https://razorpay.com/payment/{fake.uuid4()[:12]}",
                )
                db.add(payment)
                db.flush()
                payments.append(payment)

        if booking.status == BookingStatus.COMPLETED:
            final_amount = int(
                (booking.total_price - (booking.advance_amount or 0)) * 100
            )
            if final_amount > 0:
                final_payment = Payment(
                    booking_id=booking.id,
                    amount=final_amount,
                    payment_type=PaymentType.FINAL,
                    status=PaymentStatus.SUCCESS,
                    escrow_status=random.choice(
                        [EscrowStatus.RELEASED, EscrowStatus.HELD]
                    ),
                    vendor_released_amount=random.randint(0, final_amount),
                    escrow_amount=random.randint(0, final_amount),
                    razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                    razorpay_payment_id=f"pay_{fake.uuid4().replace('-', '')[:20]}",
                )
                db.add(final_payment)
                db.flush()
                payments.append(final_payment)

    db.commit()

    print(f"{len(payments)} payments created")

    return payments


# -----------------------
# CREATE PAYOUTS
# -----------------------


def create_payouts(payments):
    payouts = []
    vendor_ids = set()

    for payment in payments:
        if payment.status == PaymentStatus.SUCCESS and payment.booking:
            vendor_id = payment.booking.listing.vendor_id
            vendor_ids.add(vendor_id)

            vendor_share = (
                int(payment.vendor_released_amount)
                if payment.vendor_released_amount
                else 0
            )

            if vendor_share > 0:
                payout = Payout(
                    booking_id=payment.booking_id,
                    payment_id=payment.id,
                    vendor_id=vendor_id,
                    amount=vendor_share,
                    status=PayoutStatus.COMPLETED,
                )
                db.add(payout)
                payouts.append(payout)

    db.commit()

    print(f"{len(payouts)} payouts created")

    return payouts


# -----------------------
# CREATE REVIEWS
# -----------------------


def create_reviews(bookings, n=40):
    completed_bookings = [b for b in bookings if b.status == BookingStatus.COMPLETED]

    if not completed_bookings:
        print("No completed bookings available for reviews")
        return []

    selected_bookings = random.sample(
        completed_bookings, min(n, len(completed_bookings))
    )

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


# -----------------------
# CREATE CHAT ROOMS
# -----------------------


def create_chat_rooms(users, vendors, listings, bookings, n=30):
    chat_rooms = []

    used_pairs = set()

    for _ in range(n):
        user = random.choice(users)

        vendor = random.choice(vendors)
        pair = (user.id, vendor.id)

        if pair in used_pairs and len(used_pairs) < len(users) * len(vendors):
            continue
        used_pairs.add(pair)

        listing = random.choice(listings) if random.random() > 0.3 else None
        booking = random.choice(bookings) if random.random() > 0.5 else None

        chat_room = ChatRoom(
            user_id=user.id,
            vendor_id=vendor.id,
            listing_id=listing.id if listing else None,
            booking_id=booking.id if booking else None,
        )

        db.add(chat_room)
        db.flush()
        chat_rooms.append(chat_room)

    db.commit()

    print(f"{len(chat_rooms)} chat rooms created")

    return chat_rooms


# -----------------------
# CREATE MESSAGES
# -----------------------


def create_messages(chat_rooms, users, n=100):
    messages = []

    for chat_room in chat_rooms:
        message_count = random.randint(3, 15)

        for i in range(message_count):
            sender = random.choice([chat_room.user_id, users[0].id])

            message = Message(
                chat_id=chat_room.id,
                sender_id=sender,
                content=fake.sentence(nb_words=random.randint(5, 20)),
                is_read=random.choice([True, True, False]),
            )

            db.add(message)
            messages.append(message)

    db.commit()

    print(f"{len(messages)} messages created")

    return messages


# -----------------------
# RUN ALL
# -----------------------


def run():
    print("Generating realistic event marketplace data...")
    print("-" * 50)

    create_admin_user()

    users = create_users(40)
    print()

    vendors = create_vendors(users, 15)
    print()

    listings = create_listings(vendors, 50)
    print()

    add_listing_images(listings)
    print()

    bookings = create_bookings(users, listings, 70)
    print()

    payments = create_payments(bookings)
    print()

    create_payouts(payments)
    print()

    create_reviews(bookings, 40)
    print()

    chat_rooms = create_chat_rooms(users, vendors, listings, bookings, 30)
    print()

    create_messages(chat_rooms, users, 100)
    print()

    print("-" * 50)
    print("Dataset generation completed!")


if __name__ == "__main__":
    run()
