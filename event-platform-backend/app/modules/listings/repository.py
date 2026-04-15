# app/modules/listings/repository.py

from sqlalchemy.orm import Session, joinedload, selectinload  # type: ignore
from uuid import UUID
from .models import Listing, ListingImage, ListingStatus


class ListingRepository:

    @staticmethod
    def create(db: Session, listing: Listing):
        db.add(listing)
        db.commit()
        db.refresh(listing)
        return listing

    @staticmethod
    def get_by_id(db: Session, listing_id: UUID):
        return db.query(Listing).options(
            joinedload(Listing.vendor),
            selectinload(Listing.images)
        ).filter(Listing.id == listing_id).first()

    @staticmethod
    def get_by_vendor(db: Session, vendor_id: UUID):
        return db.query(Listing).options(
            joinedload(Listing.vendor),
            selectinload(Listing.images)
        ).filter(Listing.vendor_id == vendor_id).all()

    @staticmethod
    def get_published(db: Session, skip: int = 0, limit: int = 20):
        return db.query(Listing).options(
            joinedload(Listing.vendor),
            selectinload(Listing.images)
        ).filter(
            Listing.status == ListingStatus.PUBLISHED,
            Listing.is_active == True
        ).offset(skip).limit(limit).all()

    @staticmethod
    def delete(db: Session, listing: Listing):
        db.delete(listing)
        db.commit()

    @staticmethod
    def add_images(db: Session, images):
        db.add_all(images)
        db.commit()
        for img in images:
            db.refresh(img)
        return images