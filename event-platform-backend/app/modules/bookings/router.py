# app/modules/bookings/router.py

from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from uuid import UUID
from typing import List
from app.db.session import get_db
from .service import BookingService
from .schemas import BookingCreate, BookingResponse, BookingStatusUpdate
from app.core.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter()


@router.post("", response_model=BookingResponse)
def create_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print("[Bookings API] POST /bookings - create_booking called")
    return BookingService.create_booking(db, current_user.id, data)


@router.patch("/{booking_id}", response_model=BookingResponse)
def update_status(
    booking_id: UUID,
    data: BookingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BookingService.update_status(
        db, booking_id, data.status, user_id=current_user.id
    )


@router.get("/my", response_model=List[BookingResponse])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BookingService.get_user_bookings(db, current_user.id)


@router.get("/user/{user_id}", response_model=List[BookingResponse])
def get_user_bookings(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot view other user's bookings")
    return BookingService.get_user_bookings(db, user_id)


@router.get("/vendor/{vendor_id}", response_model=List[BookingResponse])
def get_vendor_bookings(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate the current user owns this vendor profile
    from app.modules.vendors.models import Vendor

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor or vendor.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to view these bookings"
        )
    bookings, _ = BookingService.get_vendor_bookings(db, vendor_id)
    return bookings
