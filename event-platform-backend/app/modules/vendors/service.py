from sqlalchemy.orm import Session  # type: ignore
from fastapi import HTTPException  # type: ignore
from uuid import UUID
from .repository import VendorRepository
from .models import Vendor
from .schemas import VendorCreate
from app.modules.users.repository import UserRepository


class VendorService:
    @staticmethod
    def become_vendor(db: Session, user_id: UUID, data: VendorCreate):
        existing = VendorRepository.get_by_user(db, user_id)

        if existing:
            raise HTTPException(400, "Vendor profile already exists")

        user = UserRepository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(404, "User not found")

        user.role = "VENDOR"
        db.commit()
        db.refresh(user)

        vendor = Vendor(
            user_id=user_id,
            vendor_type=data.vendor_type,
            business_name=data.business_name,
            description=data.description,
        )

        return VendorRepository.create(db, vendor)
