# app/modules/admin/service.py

from sqlalchemy.orm import Session  # type: ignore
from uuid import UUID
from fastapi import HTTPException, status  # type: ignore
from app.modules.admin.repository import AdminRepository
from app.modules.admin.schema import DashboardStats

from app.modules.vendors.models import VerificationStatus


class AdminService:
    @staticmethod
    def verify_vendor(
        db: Session, vendor_id: UUID, approve: bool, rejection_reason: str = None
    ):
        vendor = AdminRepository.get_vendor_by_id(db, vendor_id)

        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        if approve:
            vendor.verification_status = VerificationStatus.APPROVED
            vendor.rejection_reason = None

            from app.modules.notifications.trigger import notification_trigger
            import asyncio

            try:
                asyncio.create_task(
                    notification_trigger.notify_vendor_approved(
                        user_id=vendor.user_id, business_name=vendor.business_name
                    )
                )
            except Exception as e:
                print(f"[Admin] Vendor approval notification error: {e}")
        else:
            vendor.verification_status = VerificationStatus.REJECTED
            vendor.rejection_reason = rejection_reason

            from app.modules.notifications.trigger import notification_trigger
            import asyncio

            try:
                asyncio.create_task(
                    notification_trigger.notify_vendor_rejected(
                        user_id=vendor.user_id, reason=rejection_reason
                    )
                )
            except Exception as e:
                print(f"[Admin] Vendor rejection notification error: {e}")

        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def update_user_status(db: Session, user_id: UUID, is_active: bool):
        user = AdminRepository.get_user_by_id(db, user_id)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.is_active = is_active
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_vendor_status(db: Session, vendor_id: UUID, is_active: bool):
        vendor = AdminRepository.get_vendor_by_id(db, vendor_id)

        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        vendor.is_active = is_active
        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def get_dashboard_stats(db: Session) -> DashboardStats:
        return DashboardStats(
            total_users=AdminRepository.count_users(db),
            total_vendors=AdminRepository.count_vendors(db),
            pending_vendors=AdminRepository.count_pending_vendors(db),
            active_vendors=AdminRepository.count_active_vendors(db),
        )
