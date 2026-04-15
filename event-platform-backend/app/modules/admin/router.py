# app/modules/admin/router.py

from fastapi import APIRouter, Depends, status, Query  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from uuid import UUID
from typing import List
from app.db.session import get_db
from app.modules.admin.schema import (
    VendorVerificationRequest,
    UserStatusUpdate,
    VendorStatusUpdate,
    DashboardStats,
)
from app.modules.admin.service import AdminService
from app.core.dependencies import get_current_admin_user
from app.modules.listings.service import ListingService
from app.modules.listings.schemas import (
    PaginatedListingResponse,
    ListingResponse,
    ListingStatusUpdate,
)
from app.modules.vendors.schemas import VendorResponse

router = APIRouter()


@router.post("/verify-vendor")
def verify_vendor(
    payload: VendorVerificationRequest,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin_user),
):
    return AdminService.verify_vendor(
        db=db,
        vendor_id=payload.vendor_id,
        approve=payload.approve,
        rejection_reason=payload.rejection_reason,
    )


@router.put("/user-status")
def update_user_status(
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin_user),
):
    return AdminService.update_user_status(
        db=db, user_id=payload.user_id, is_active=payload.is_active
    )


@router.put("/vendor-status")
def update_vendor_status(
    payload: VendorStatusUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin_user),
):
    return AdminService.update_vendor_status(
        db=db, vendor_id=payload.vendor_id, is_active=payload.is_active
    )


@router.get("/dashboard", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db), admin=Depends(get_current_admin_user)
):
    return AdminService.get_dashboard_stats(db)


@router.get("/listings", response_model=PaginatedListingResponse)
def get_all_listings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin_user),
):
    from app.modules.listings.models import Listing

    skip = (page - 1) * limit
    query = db.query(Listing)
    total = query.count()

    listings = query.order_by(Listing.created_at.desc()).offset(skip).limit(limit).all()

    return PaginatedListingResponse(
        data=[ListingResponse.model_validate(l) for l in listings],
        total=total,
        page=page,
        limit=limit,
    )


@router.put("/listings/{listing_id}/status", response_model=ListingResponse)
def update_listing_status(
    listing_id: UUID,
    payload: ListingStatusUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin_user),
):
    return ListingService.update_listing_status(
        db=db, listing_id=listing_id, status=payload.status, is_active=payload.is_active
    )


@router.get("/vendors", response_model=List[VendorResponse])
def get_all_vendors(
    status_filter: str = Query(None, description="Filter by verification status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin_user),
):
    from app.modules.vendors.models import Vendor, VerificationStatus

    query = db.query(Vendor)

    if status_filter:
        try:
            status_enum = VerificationStatus[status_filter.upper()]
            query = query.filter(Vendor.verification_status == status_enum)
        except KeyError:
            pass

    skip = (page - 1) * limit
    total = query.count()
    vendors = query.order_by(Vendor.created_at.desc()).offset(skip).limit(limit).all()

    return vendors
