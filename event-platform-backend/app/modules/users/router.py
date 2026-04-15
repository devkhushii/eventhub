# backend/app/modules/users/router.py

from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role

from .service import UserService
from .schema import (
    UserResponse,
    UserUpdate,
    PublicUserResponse,
    DeviceTokenUpdate,
    DeviceTokenResponse,
)
from .models import User

router = APIRouter()
service = UserService()


# 🔹 Get current user
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    print("[Users API] GET /users/me - get_me called")
    return current_user


# 🔹 Update profile
@router.put("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_user(db, current_user.id, data)


# 🔹 Public profile
@router.get("/{user_id}", response_model=PublicUserResponse)
def get_public_user(user_id: UUID, db: Session = Depends(get_db)):
    return service.get_user(db, user_id)


# 🔹 Admin: List users
@router.get("/", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"])),
):
    return service.list_users(db, skip, limit)


# 🔹 Admin: Deactivate user
@router.delete("/{user_id}")
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"])),
):
    return service.deactivate_user(db, user_id)


# 🔹 Save FCM/Device Token
@router.post("/device-token", response_model=DeviceTokenResponse)
def save_device_token(
    data: DeviceTokenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save or update device notification token for the current user."""
    import logging

    logger = logging.getLogger(__name__)

    logger.info(f"Saving device token for user {current_user.id}")

    if data.device_token:
        current_user.device_token = data.device_token
        current_user.fcm_token = data.device_token
        db.commit()
        db.refresh(current_user)
        logger.info(f"Device token saved: {data.device_token[:20]}...")

    return DeviceTokenResponse(success=True, message="Device token saved successfully")


# 🔹 Remove Device Token
@router.delete("/device-token", response_model=DeviceTokenResponse)
def remove_device_token(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Remove device notification token for the current user."""
    import logging

    logger = logging.getLogger(__name__)

    logger.info(f"Removing device token for user {current_user.id}")

    current_user.device_token = None
    current_user.fcm_token = None
    db.commit()

    return DeviceTokenResponse(
        success=True, message="Device token removed successfully"
    )
