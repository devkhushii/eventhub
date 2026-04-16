# scripts/generate_fake_data.py
# Robust fake data generator for FastAPI + SQLAlchemy event platform
# Safe to run multiple times - handles existing data gracefully

import random
from faker import Faker
from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.modules.users.models import User

# Import auth models first to ensure they're registered
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

# Initialize database session - will be cleaned up at script end
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


# --- HELPER FUNCTIONS ---


def get_random_safe(items: list) -> any:
    """Safely get a random item from a list."""
    if not items:
        return None
    return random.choice(items)


def get_random_sample_safe(items: list, n: int) -> list:
    """Safely get n random items from a list."""
    if not items or n <= 0:
        return []
    return random.sample(items, min(n, len(items)))


# --- CORE FUNCTIONS ---


def create_admin_user():
    """Create admin user if not exists."""
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


def create_users(n=30):
    """
    Ensure at least n users exist in the database.
    Creates additional users if needed.
    """
    existing_count = db.query(User).count()
    existing_users = db.query(User).filter(User.role == "USER").all()

    if len(existing_users) >= n:
        print(f"Users already exist ({len(existing_users)}), using existing users")
        return existing_users[:n]

    # Need to create more users
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

    # Return all users up to n
    all_users = db.query(User).filter(User.role == "USER").all()
    return all_users[:n]


def create_vendors(users, n=12):
    """
    Create vendors for users who don't already have one.
    Returns list of actually created vendors.
    """
    if not users:
        print("No users available for vendor creation")
        return []

    # Filter out users who already have vendors
    non_vendor_users = []
    for u in users:
        # Check if user already has a vendor
        has_vendor = db.query(Vendor).filter(Vendor.user_id == u.id).first() is not None
        if not has_vendor:
            non_vendor_users.append(u)

    if not non_vendor_users:
        print("No eligible users for vendor creation (all users already have vendors)")
        return []

    # Don't create more vendors than available users
    users_to_make_vendor = min(n, len(non_vendor_users))
    selected_users = get_random_sample_safe(non_vendor_users, users_to_make_vendor)

    if not selected_users:
        print("No users selected for vendor creation")
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
    """Create listings for vendors."""
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
    """Add images to listings."""
    if not listings:
        print("No listings to add images to")
        return 0

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
    return total_images


def create_bookings(users, listings, n=60):
    """Create bookings for users and listings."""
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

        event_date = datetime.now(timezone.utc) + timedelta(days=random.randint(5, 120))
        end_date = event_date + timedelta(hours=random.choice([4, 6, 8, 12]))

        total_price = listing.price * random.uniform(0.8, 1.5)
        advance_amount = round(total_price * 0.3, 2)

        status = get_random_safe(BOOKING_STATUSES) or BookingStatus.PENDING

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
        bookings.append(booking)

    db.commit()

    print(f"{len(bookings)} bookings created")
    return bookings


def create_payments(bookings):
    """Create payments for bookings."""
    if not bookings:
        print("No bookings available to create payments")
        return []

    payments = []

    for booking in bookings:
        if not booking.listing:
            continue

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
                    escrow_status = (
                        get_random_safe(
                            [EscrowStatus.RELEASED, EscrowStatus.PARTIALLY_RELEASED]
                        )
                        or EscrowStatus.RELEASED
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
                    escrow_status=get_random_safe(
                        [EscrowStatus.RELEASED, EscrowStatus.HELD]
                    )
                    or EscrowStatus.HELD,
                    vendor_released_amount=random.randint(0, final_amount),
                    escrow_amount=random.randint(0, final_amount),
                    razorpay_order_id=f"order_{fake.uuid4().replace('-', '')[:20]}",
                    razorpay_payment_id=f"pay_{fake.uuid4().replace('-', '')[:20]}",
                )
                db.add(final_payment)
                payments.append(final_payment)

    db.commit()

    print(f"{len(payments)} payments created")
    return payments


def create_payouts(payments):
    """Create payouts from payments."""
    if not payments:
        print("No payments available to create payouts")
        return []

    payouts = []
    vendor_ids = set()

    for payment in payments:
        if payment.status == PaymentStatus.SUCCESS and payment.booking:
            if not payment.booking.listing:
                continue
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


def create_reviews(bookings, n=40):
    """Create reviews for completed bookings."""
    if not bookings:
        print("No bookings available for reviews")
        return []

    completed_bookings = [b for b in bookings if b.status == BookingStatus.COMPLETED]

    if not completed_bookings:
        print("No completed bookings available for reviews")
        return []

    selected_bookings = get_random_sample_safe(completed_bookings, n)

    if not selected_bookings:
        print("No bookings selected for reviews")
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
    """Create chat rooms."""
    if not users:
        print("No users available for chat rooms")
        return []

    if not vendors:
        print("No vendors available for chat rooms")
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
    """Create messages in chat rooms."""
    if not chat_rooms:
        print("No chat rooms available for messages")
        return []

    if not users:
        print("No users available for messages")
        return []

    messages = []

    for chat_room in chat_rooms:
        message_count = random.randint(3, 15)

        for i in range(message_count):
            sender = (
                get_random_safe([chat_room.user_id, users[0].id]) if users else None
            )
            if not sender:
                continue

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


# --- MAIN RUN FUNCTION ---


def run():
    """Generate all fake data."""
    print("Generating realistic event marketplace data...")
    print("-" * 50)

    # Step 1: Create admin user
    create_admin_user()
    print()

    # Step 2: Create users (ensure we have enough)
    users = create_users(40)
    if not users:
        print("FATAL: No users created. Aborting.")
        return
    print(f"Total users available: {len(users)}")
    print()

    # Step 3: Create vendors (requires users)
    vendors = create_vendors(users, 15)
    if not vendors:
        print(
            "No vendors created. Aborting further data generation (listings require vendors)."
        )
        return
    print(f"Total vendors available: {len(vendors)}")
    print()

    # Step 4: Create listings (requires vendors)
    listings = create_listings(vendors, 50)
    if not listings:
        print("No listings created. Aborting further data generation.")
        return
    print(f"Total listings available: {len(listings)}")
    print()

    # Step 5: Add listing images
    add_listing_images(listings)
    print()

    # Step 6: Create bookings (requires users and listings)
    bookings = create_bookings(users, listings, 70)
    if not bookings:
        print("No bookings created. Aborting further data generation.")
        return
    print(f"Total bookings available: {len(bookings)}")
    print()

    # Step 7: Create payments (requires bookings)
    payments = create_payments(bookings)
    print(f"Total payments available: {len(payments)}")
    print()

    # Step 8: Create payouts (optional - requires payments)
    create_payouts(payments)
    print()

    # Step 9: Create reviews (optional - requires bookings)
    create_reviews(bookings, 40)
    print()

    # Step 10: Create chat rooms (optional)
    chat_rooms = create_chat_rooms(users, vendors, listings, bookings, 30)
    print(f"Total chat rooms available: {len(chat_rooms)}")
    print()

    # Step 11: Create messages (optional)
    create_messages(chat_rooms, users, 100)
    print()

    print("-" * 50)
    print("Dataset generation completed!")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        db.rollback()
        raise
    finally:
        db.close()
