# app/modules/listings/field_models.py

import uuid
from sqlalchemy import Column, String, Boolean, Enum, DateTime  # type: ignore
from sqlalchemy.dialects.postgresql import UUID, JSONB  # type: ignore
from sqlalchemy.sql import func  # type: ignore

from app.db.base import Base
from .models import ListingType


class ListingFieldDefinition(Base):
    __tablename__ = "listing_field_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    listing_type = Column(Enum(ListingType), nullable=False)

    field_name = Column(String(100), nullable=False)
    field_label = Column(String(255), nullable=False)

    field_type = Column(String(50), nullable=False)
    # text, number, boolean, select

    is_required = Column(Boolean, default=False)

    # used when field_type = select
    options = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())