# app/modules/listings/service.py

import os
import shutil
from uuid import UUID, uuid4
from fastapi import HTTPException, UploadFile  # type: ignore
from sqlalchemy.orm import Session, selectinload  # type: ignore
from sqlalchemy import or_  # type: ignore
from typing import List, Optional, Tuple

from .repository import ListingRepository
from .models import Listing, ListingImage, ListingStatus, ListingType
from .schemas import (
    ListingCreate,
    ListingUpdate,
    ListingFilterParams,
    PaginatedListingResponse,
    SortOrder,
)
from app.modules.vendors.repository import VendorRepository
from app.modules.vendors.models import VerificationStatus


UPLOAD_DIR = "uploads/listings"
MAX_IMAGES_PER_LISTING = 5


class ListingService:
    @staticmethod
    def create_listing(db: Session, vendor_id: UUID, data: ListingCreate):

        vendor = VendorRepository.get_by_id(db, vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        if vendor.verification_status != VerificationStatus.APPROVED:
            raise HTTPException(status_code=403, detail="Vendor not approved")

        listing = Listing(
            vendor_id=vendor_id,
            title=data.title,
            description=data.description,
            listing_type=data.listing_type,
            price=data.price,
            location=data.location,
            details=data.details,
            status=data.status,
        )

        return ListingRepository.create(db, listing)

    @staticmethod
    def update_listing(
        db: Session, listing_id: UUID, vendor_id: UUID, data: ListingUpdate
    ):

        listing = ListingRepository.get_by_id(db, listing_id)

        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if listing.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not allowed")

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)

        db.commit()
        db.refresh(listing)
        return listing

    @staticmethod
    def delete_listing(db: Session, listing_id: UUID, vendor_id: UUID):

        listing = ListingRepository.get_by_id(db, listing_id)

        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if listing.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not allowed")

        ListingRepository.delete(db, listing)

    @staticmethod
    def add_images(
        db: Session, listing_id: UUID, vendor_id: UUID, files: List[UploadFile]
    ):

        listing = ListingRepository.get_by_id(db, listing_id)

        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if listing.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not allowed")

        if len(listing.images) + len(files) > MAX_IMAGES_PER_LISTING:
            raise HTTPException(status_code=400, detail="Max images limit exceeded")

        folder_path = os.path.join(UPLOAD_DIR, str(listing_id))
        os.makedirs(folder_path, exist_ok=True)

        images = []

        for file in files:
            if not file.content_type or not file.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Invalid file type")

            filename = file.filename or "unknown"
            ext = filename.split(".")[-1] if "." in filename else "jpg"
            filename = f"{uuid4()}.{ext}"

            file_path = os.path.join(folder_path, filename)

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            images.append(ListingImage(listing_id=listing_id, image_url=file_path))

        return ListingRepository.add_images(db, images)

    @staticmethod
    def delete_image(db: Session, image_id: UUID, vendor_id: UUID):

        image = db.query(ListingImage).filter(ListingImage.id == image_id).first()

        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        if image.listing.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not allowed")

        if os.path.exists(image.image_url):
            os.remove(image.image_url)

        db.delete(image)
        db.commit()

    @staticmethod
    def get_published_listings(
        db: Session, params: ListingFilterParams
    ) -> Tuple[List[Listing], int]:

        query = (
            db.query(Listing)
            .options(selectinload(Listing.images))
            .filter(
                Listing.status == ListingStatus.PUBLISHED, Listing.is_active == True
            )
        )

        if params.search:
            search_term = f"%{params.search}%"
            query = query.filter(
                or_(
                    Listing.title.ilike(search_term),
                    Listing.description.ilike(search_term),
                )
            )

        if params.price_min is not None:
            query = query.filter(Listing.price >= params.price_min)

        if params.price_max is not None:
            query = query.filter(Listing.price <= params.price_max)

        if params.location:
            query = query.filter(Listing.location.ilike(f"%{params.location}%"))

        if params.listing_type:
            query = query.filter(Listing.listing_type == params.listing_type)

        if params.start_date:
            query = query.filter(Listing.start_date >= params.start_date)

        if params.end_date:
            query = query.filter(Listing.end_date <= params.end_date)

        total = query.count()

        if params.sort_by == SortOrder.PRICE_ASC:
            query = query.order_by(Listing.price.asc())
        elif params.sort_by == SortOrder.PRICE_DESC:
            query = query.order_by(Listing.price.desc())
        elif params.sort_by == SortOrder.DATE_ASC:
            query = query.order_by(Listing.created_at.asc())
        else:
            query = query.order_by(Listing.created_at.desc())

        skip = (params.page - 1) * params.limit
        listings = query.offset(skip).limit(params.limit).all()

        return listings, total

    @staticmethod
    def get_vendor_listings(
        db: Session, vendor_id: UUID, skip: int = 0, limit: int = 20
    ) -> Tuple[List[Listing], int]:

        query = db.query(Listing).filter(Listing.vendor_id == vendor_id)
        total = query.count()

        listings = (
            query.order_by(Listing.created_at.desc()).offset(skip).limit(limit).all()
        )

        return listings, total

    @staticmethod
    def update_listing_status(
        db: Session,
        listing_id: UUID,
        status: Optional[ListingStatus] = None,
        is_active: Optional[bool] = None,
    ) -> Listing:

        listing = ListingRepository.get_by_id(db, listing_id)

        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")

        if status is not None:
            listing.status = status

        if is_active is not None:
            listing.is_active = is_active

        db.commit()
        db.refresh(listing)
        return listing
