# app/modules/bookings/schemas.py

from pydantic import BaseModel, Field, computed_field, field_validator  # type: ignore
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum
from typing import List
from app.modules.payments.schemas import PaymentResponse


class BookingStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    AWAITING_ADVANCE = "AWAITING_ADVANCE"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    AWAITING_FINAL_PAYMENT = "AWAITING_FINAL_PAYMENT"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    CANCELLATION_REQUESTED = "CANCELLATION_REQUESTED"


BOOKING_TRANSITIONS = {
    BookingStatus.PENDING: [BookingStatus.APPROVED, BookingStatus.REJECTED, BookingStatus.CANCELLED],
    BookingStatus.APPROVED: [BookingStatus.AWAITING_ADVANCE, BookingStatus.CANCELLED],
    BookingStatus.AWAITING_ADVANCE: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    BookingStatus.CONFIRMED: [
        BookingStatus.AWAITING_FINAL_PAYMENT,
        BookingStatus.CANCELLATION_REQUESTED,
    ],
    BookingStatus.AWAITING_FINAL_PAYMENT: [
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLATION_REQUESTED,
    ],
    BookingStatus.CANCELLATION_REQUESTED: [BookingStatus.CANCELLED, BookingStatus.CONFIRMED],
    BookingStatus.COMPLETED: [],
    BookingStatus.REJECTED: [],
    BookingStatus.CANCELLED: [],
}


class BookingCreate(BaseModel):
    listing_id: UUID
    event_date: datetime
    end_date: Optional[datetime]
    special_request: Optional[str]
    advance_amount: Optional[float] = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus

    @field_validator("status", mode="before")
    @classmethod
    def to_uppercase(cls, v):
        if isinstance(v, str):
            return v.upper()
        return v


class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    listing_id: UUID
    event_date: datetime
    end_date: Optional[datetime]
    total_days: Optional[int] = None
    total_price: float
    status: BookingStatus
    advance_amount: Optional[float] = None
    advance_paid: bool = False
    special_request: Optional[str]
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    payments: list[PaymentResponse] = []

    @computed_field
    @property
    def remaining_amount(self) -> float:
        if self.advance_amount:
            return self.total_price - self.advance_amount
        return self.total_price

    class Config:
        from_attributes = True


class UserInfo(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class ListingInfo(BaseModel):
    id: UUID
    title: str
    listing_type: str
    location: Optional[str] = None

    class Config:
        from_attributes = True


class VendorBookingResponse(BaseModel):
    id: UUID
    event_date: datetime
    end_date: Optional[datetime]
    total_days: Optional[int] = None
    total_price: float
    status: BookingStatus
    advance_amount: Optional[float] = None
    advance_paid: bool = False
    special_request: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    user: UserInfo
    listing: ListingInfo
    payments: list[PaymentResponse] = []

    @computed_field
    @property
    def remaining_amount(self) -> float:
        if self.advance_amount:
            return self.total_price - self.advance_amount
        return self.total_price

    class Config:
        from_attributes = True


class PaginatedVendorBookingsResponse(BaseModel):
    data: list[VendorBookingResponse]
    total: int
    page: int
    limit: int
