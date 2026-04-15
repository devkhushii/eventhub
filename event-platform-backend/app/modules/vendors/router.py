from fastapi import APIRouter, Depends, Query  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from uuid import UUID

from app.db.session import get_db
from app.core.dependencies import get_current_user

from .service import VendorService
from .schemas import VendorCreate, VendorResponse
from .dependencies import require_vendor, require_admin
from .models import Vendor
from app.modules.bookings.service import BookingService
from app.modules.bookings.schemas import (
    VendorBookingResponse,
    PaginatedVendorBookingsResponse,
    BookingStatusUpdate,
)

router = APIRouter()
service = VendorService()


@router.post("/become-host", response_model=VendorResponse)
def become_host(
    data: VendorCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.become_vendor(db, current_user.id, data)


@router.get("/me", response_model=VendorResponse)
def get_my_vendor_profile(vendor=Depends(require_vendor)):
    return vendor


@router.get("/bookings", response_model=PaginatedVendorBookingsResponse)
def get_vendor_bookings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    vendor: Vendor = Depends(require_vendor),
):
    skip = (page - 1) * limit
    bookings, total = BookingService.get_vendor_bookings(
        db, vendor.id, skip=skip, limit=limit
    )

    return PaginatedVendorBookingsResponse(
        data=[VendorBookingResponse.model_validate(b) for b in bookings],
        total=total,
        page=page,
        limit=limit,
    )


@router.patch("/bookings/{booking_id}", response_model=VendorBookingResponse)
def update_booking_status(
    booking_id: UUID,
    data: BookingStatusUpdate,
    db: Session = Depends(get_db),
    vendor: Vendor = Depends(require_vendor),
):
    booking = BookingService.vendor_update_booking_status(
        db, vendor.id, booking_id, data.status
    )
    return VendorBookingResponse.model_validate(booking)
