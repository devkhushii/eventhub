from fastapi import Depends, HTTPException         # type: ignore
from sqlalchemy.orm import Session                 # type: ignore

from app.db.session import get_db
from app.core.dependencies import get_current_user
from .models import Vendor


def require_vendor(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    vendor = db.query(Vendor).filter(
        Vendor.user_id == current_user.id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=403,
            detail="You must become a vendor first"
        )

    return vendor


def require_admin(current_user = Depends(get_current_user)):
    """Fixed to use role field instead of is_admin boolean for consistency."""
    if current_user.role.upper() != "ADMIN":
        raise HTTPException(403, "Admin access required")
    return current_user