"""
Central model registry to ensure all SQLAlchemy models are loaded and registered.

This file MUST be imported early in both:
1. FastAPI application startup (main.py)
2. Celery worker initialization

This ensures all models are registered with SQLAlchemy's Base.metadata
and relationship string references (like "User") are properly resolved.
"""

# Import all models to register them with Base.metadata
# Order matters: models without foreign keys first, then dependent models

# Core models
import app.modules.users.models  # User - no dependencies
import app.modules.auth.models  # RefreshToken - depends on User

# Business models
import app.modules.vendors.models  # Vendor - depends on User
import app.modules.listings.models  # Listing, ListingImage - no dependencies
import app.modules.listings.field_models  # ListingField, ListingFieldValue

# Booking & Payment models (depends on User, Listing)
import app.modules.bookings.models  # Booking - depends on User, Listing
import app.modules.payments.models  # Payment, Payout - depends on Booking

# Chat model (depends on User, Booking)
import app.modules.chat.models  # ChatRoom, Message - depends on User, Booking

# Review model (depends on User, Listing)
import app.modules.reviews.models  # Review - depends on User, Listing

# Notification model (depends on User) - MUST be last to avoid circular imports
import app.modules.notifications.models  # Notification - depends on User
