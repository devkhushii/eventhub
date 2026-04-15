# app/modules/bookings/schemas.py

from pydantic import BaseModel, Field, computed_field  # type: ignore
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum


class BookingStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    AWAITING_ADVANCE = "AWAITING_ADVANCE"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    AWAITING_FINAL_PAYMENT = "AWAITING_FINAL_PAYMENT"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


BOOKING_TRANSITIONS = {
    BookingStatus.PENDING: [BookingStatus.APPROVED, BookingStatus.REJECTED],
    BookingStatus.APPROVED: [BookingStatus.AWAITING_ADVANCE, BookingStatus.CANCELLED],
    BookingStatus.AWAITING_ADVANCE: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    BookingStatus.CONFIRMED: [
        BookingStatus.AWAITING_FINAL_PAYMENT,
        BookingStatus.CANCELLED,
    ],
    BookingStatus.AWAITING_FINAL_PAYMENT: [BookingStatus.COMPLETED],
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


class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    listing_id: UUID
    event_date: datetime
    end_date: Optional[datetime]
    total_price: float
    status: BookingStatus
    advance_amount: Optional[float] = None
    special_request: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

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
    total_price: float
    status: BookingStatus
    advance_amount: Optional[float] = None
    special_request: Optional[str]
    created_at: datetime
    user: UserInfo
    listing: ListingInfo

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
