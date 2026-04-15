# app/modules/admin/repository.py

from sqlalchemy.orm import Session     # type: ignore
from uuid import UUID
from app.modules.users.models import User
from app.modules.vendors.models import Vendor
from app.modules.vendors.models import VerificationStatus

class AdminRepository:

    # ---------- Vendor ----------
    @staticmethod
    def get_vendor_by_id(db: Session, vendor_id: UUID):
        return db.query(Vendor).filter(Vendor.id == vendor_id).first()

    @staticmethod
    def count_vendors(db: Session):
        return db.query(Vendor).count()

    @staticmethod
    def count_pending_vendors(db: Session):
        return db.query(Vendor).filter(
            Vendor.verification_status == VerificationStatus.PENDING
        ).count()

    @staticmethod
    def count_active_vendors(db: Session):
        return db.query(Vendor).filter(
            Vendor.is_active == True
        ).count()

    # ---------- User ----------
    @staticmethod
    def get_user_by_id(db: Session, user_id: UUID):
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def count_users(db: Session):
        return db.query(User).count()