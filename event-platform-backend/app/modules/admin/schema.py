# app/modules/admin/schema.py

from pydantic import BaseModel      # type: ignore
from typing import Optional, List
from uuid import UUID


class VendorVerificationRequest(BaseModel):
    vendor_id: UUID
    approve: bool
    rejection_reason: Optional[str] = None


class UserStatusUpdate(BaseModel):
    user_id: UUID
    is_active: bool


class VendorStatusUpdate(BaseModel):
    vendor_id: UUID
    is_active: bool


class DashboardStats(BaseModel):
    total_users: int
    total_vendors: int
    pending_vendors: int
    active_vendors: int