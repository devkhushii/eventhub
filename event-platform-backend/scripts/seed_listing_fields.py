# app/scripts/seed_listing_fields.py

import random
from faker import Faker
from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.modules.users.models import User
from app.modules.vendors.models import Vendor, VendorType, VerificationStatus
from app.modules.listings.models import (
    Listing,
    ListingStatus,
    ListingType,
    ListingImage,
)
from app.modules.listings.field_models import ListingFieldDefinition, ListingType
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
# force SQLAlchemy to load all models
from app.modules.auth.models import (
    RefreshToken,
    EmailVerificationToken,
    PasswordResetToken,
)

db = SessionLocal()



def seed_listing_fields():

    fields = [

        # ================= VENUE =================

        ListingFieldDefinition(
            listing_type=ListingType.VENUE,
            field_name="capacity",
            field_label="Guest Capacity",
            field_type="number",
            is_required=True
        ),

        ListingFieldDefinition(
            listing_type=ListingType.VENUE,
            field_name="parking",
            field_label="Parking Available",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.VENUE,
            field_name="rooms",
            field_label="Total Rooms",
            field_type="number"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.VENUE,
            field_name="indoor",
            field_label="Indoor Venue",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.VENUE,
            field_name="outdoor",
            field_label="Outdoor Lawn Available",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.VENUE,
            field_name="ac_available",
            field_label="Air Conditioning Available",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.VENUE,
            field_name="generator_backup",
            field_label="Generator Backup Available",
            field_type="boolean"
        ),

        # ================= PHOTO & VIDEO =================

        ListingFieldDefinition(
            listing_type=ListingType.PHOTOGRAPHER,
            field_name="photo_services",
            field_label="Photography Services Included",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.PHOTOGRAPHER,
            field_name="video_services",
            field_label="Videography Services Included",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.PHOTOGRAPHER,
            field_name="camera_type",
            field_label="Camera Type",
            field_type="text"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.PHOTOGRAPHER,
            field_name="team_size",
            field_label="Team Size",
            field_type="number"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.PHOTOGRAPHER,
            field_name="drone",
            field_label="Drone Coverage Available",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.PHOTOGRAPHER,
            field_name="cinematic_video",
            field_label="Cinematic Video Available",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.PHOTOGRAPHER,
            field_name="editing_included",
            field_label="Editing Included",
            field_type="boolean"
        ),

        # ================= CATERER =================

        ListingFieldDefinition(
            listing_type=ListingType.CATERER,
            field_name="cuisine_type",
            field_label="Cuisine Type",
            field_type="text"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.CATERER,
            field_name="veg_only",
            field_label="Vegetarian Only",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.CATERER,
            field_name="max_capacity",
            field_label="Maximum Serving Capacity",
            field_type="number"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.CATERER,
            field_name="live_counters",
            field_label="Live Counters Available",
            field_type="boolean"
        ),

        # ================= DECORATOR =================

        ListingFieldDefinition(
            listing_type=ListingType.DECORATOR,
            field_name="theme_decor",
            field_label="Theme Decor Available",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.DECORATOR,
            field_name="floral_decor",
            field_label="Floral Decoration",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.DECORATOR,
            field_name="lighting_setup",
            field_label="Lighting Setup Included",
            field_type="boolean"
        ),


        # ================= DJ =================

        ListingFieldDefinition(
            listing_type=ListingType.DJ,
            field_name="music_genre",
            field_label="Music Genre",
            field_type="text"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.DJ,
            field_name="sound_system",
            field_label="Sound System Included",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.DJ,
            field_name="lighting_setup",
            field_label="Lighting Setup Included",
            field_type="boolean"
        ),

        # ================= EVENT PLANNER =================

        ListingFieldDefinition(
            listing_type=ListingType.EVENT_MANAGER,
            field_name="events_handled",
            field_label="Events Handled Per Year",
            field_type="number"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.EVENT_MANAGER,
            field_name="full_service",
            field_label="Full Event Planning",
            field_type="boolean"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.EVENT_MANAGER,
            field_name="destination_wedding",
            field_label="Destination Wedding Planning",
            field_type="boolean"
        ),
        
          # ================= OTHER =================
          
        ListingFieldDefinition(
            listing_type=ListingType.OTHER,
            field_name="service_type",
            field_label="Service Type",
            field_type="text",
            is_required=True
        ),
        
        ListingFieldDefinition(
            listing_type=ListingType.OTHER,
            field_name="experience_years",
            field_label="Years of Experience",
            field_type="number"
        ),

        ListingFieldDefinition(
            listing_type=ListingType.OTHER,
            field_name="service_details",
            field_label="Service Details",
            field_type="text"
        )
    ]

    db.add_all(fields)
    db.commit()

    print("✅ Listing fields seeded successfully!")


if __name__ == "__main__":
    seed_listing_fields()