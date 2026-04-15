# modules/vendors/schemas.py

from pydantic import BaseModel, Field        # type: ignore
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


# -----------------------------
# ENUMS (Mirror DB enums)
# -----------------------------

class VendorType(str, Enum):
    INDIVIDUAL = "individual"
    MANAGER = "manager"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# -----------------------------
# BASE SCHEMA
# -----------------------------

class VendorBase(BaseModel):
    vendor_type: VendorType
    business_name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None


# -----------------------------
# CREATE SCHEMA
# -----------------------------

class VendorCreate(VendorBase):
    pass


# -----------------------------
# UPDATE SCHEMA
# -----------------------------

class VendorUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None


# -----------------------------
# RESPONSE SCHEMA
# -----------------------------

class VendorResponse(BaseModel):
    id: UUID
    user_id: UUID
    vendor_type: VendorType
    business_name: str
    description: Optional[str]

    verification_status: VerificationStatus
    rating: float
    total_reviews: float

    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# -----------------------------
# ADMIN VERIFICATION UPDATE
# -----------------------------

class VendorVerificationUpdate(BaseModel):
    verification_status: VerificationStatus