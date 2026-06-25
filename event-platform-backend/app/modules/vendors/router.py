from fastapi import APIRouter, Depends, Query, BackgroundTasks  # type: ignore
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    vendor: Vendor = Depends(require_vendor),
):
    booking = BookingService.vendor_update_booking_status(
        db, vendor.id, booking_id, data.status, background_tasks
    )
    return VendorBookingResponse.model_validate(booking)


@router.post("/bookings/{booking_id}/refund")
def process_refund(
    booking_id: UUID,
    db: Session = Depends(get_db),
    vendor: Vendor = Depends(require_vendor),
):
    """Vendor approves customer's cancellation request and processes 70% refund."""
    from app.modules.payments.service import PaymentService
    advance_payment = PaymentService.process_cancellation_refund(db, booking_id, vendor.id)
    return {
        "status": "success",
        "customer_paid": advance_payment.amount,
        "refunded_amount": advance_payment.refunded_amount,
        "refund_percentage": advance_payment.refund_percentage,
        "platform_commission": advance_payment.escrow_amount,
        "vendor_final_earnings": advance_payment.vendor_released_amount,
        "refund_status": "REFUNDED",
    }


@router.post("/bookings/{booking_id}/reject-cancellation")
def reject_cancellation(
    booking_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    vendor: Vendor = Depends(require_vendor),
):
    """Vendor rejects customer's cancellation request. Booking returns to CONFIRMED."""
    booking = BookingService.vendor_reject_cancellation(
        db, vendor.id, booking_id, background_tasks
    )
    return {
        "status": "success",
        "message": "Cancellation request rejected. Booking remains active.",
        "booking_status": booking.status.value,
    }
