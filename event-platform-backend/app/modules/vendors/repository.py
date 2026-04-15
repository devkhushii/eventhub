from sqlalchemy.orm import Session      # type: ignore
from uuid import UUID
from .models import Vendor


class VendorRepository:

    @staticmethod
    def create(db: Session, vendor: Vendor):
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def get_by_user(db: Session, user_id: UUID):
        return db.query(Vendor).filter(
            Vendor.user_id == user_id
        ).first()
   
    @staticmethod
    def get_by_id(db: Session, vendor_id: UUID):
        return db.query(Vendor).filter(
            Vendor.id == vendor_id
        ).first()

    @staticmethod
    def update(db: Session, vendor: Vendor, data: dict):
        for key, value in data.items():
            setattr(vendor, key, value)

        db.commit()
        db.refresh(vendor)
        return vendor