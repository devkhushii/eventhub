# app/modules/notifications/routes.py

import logging
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.users.models import User
from app.core.dependencies import get_current_user
from app.modules.notifications.service import NotificationService
from app.modules.notifications.schemas import (
    NotificationResponse,
    NotificationCreate,
    UnreadCountResponse,
    NotificationListResponse,
    NotificationUpdate,
    ExpoTokenRegister,
    MarkAllReadResponse,
)
from app.modules.notifications.models import NotificationType

logger = logging.getLogger(__name__)

router = APIRouter()


def get_notification_service(db: Session = Depends(get_db)) -> NotificationService:
    return NotificationService(db)


@router.post("/register-token", response_model=dict)
def register_expo_token(
    data: ExpoTokenRegister,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register or update Expo push token for the current user."""
    logger.info(f"POST /notifications/register-token - user: {current_user.id}")

    try:
        if not data.expo_push_token.startswith("ExponentPushToken["):
            raise HTTPException(
                status_code=400,
                detail="Invalid Expo push token format. Token must start with 'ExponentPushToken['",
            )

        current_user.expo_push_token = data.expo_push_token
        db.commit()

        logger.info(f"Registered Expo token for user {current_user.id}")
        return {"message": "Token registered successfully", "success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering token: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to register token")


@router.get("", response_model=NotificationListResponse)
def get_notifications(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        50, ge=1, le=100, description="Maximum number of records to return"
    ),
    include_read: bool = Query(True, description="Include read notifications"),
    type: Optional[NotificationType] = Query(
        None, description="Filter by notification type"
    ),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Get all notifications for the current user."""
    logger.info(f"GET /notifications - user: {current_user.id}")

    try:
        result = service.fetch_notifications(
            user=current_user,
            skip=skip,
            limit=limit,
            include_read=include_read,
            notification_type=type,
            is_read=is_read,
        )
        return result
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications")


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Get the count of unread notifications for the current user."""
    logger.info(f"GET /notifications/unread-count - user: {current_user.id}")

    try:
        result = service.fetch_unread_count(user=current_user)
        return result
    except Exception as e:
        logger.error(f"Error fetching unread count: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch unread count")


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Mark a specific notification as read."""
    logger.info(
        f"PATCH /notifications/{notification_id}/read - user: {current_user.id}"
    )

    try:
        result = service.mark_notification_read(
            notification_id=notification_id, user_id=current_user.id
        )

        if not result:
            raise HTTPException(status_code=404, detail="Notification not found")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to mark notification as read"
        )


@router.put("/user/{user_id}/read-all", response_model=MarkAllReadResponse)
def mark_all_read_by_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Mark all notifications as read for a specific user (admin only)."""
    logger.info(f"PUT /notifications/user/{user_id}/read-all")

    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=403, detail="Cannot mark other user's notifications as read"
        )

    try:
        count = service.repository.mark_all_as_read(user_id)
        return MarkAllReadResponse(
            message=f"Marked {count} notifications as read", count=count
        )
    except Exception as e:
        logger.error(f"Error marking all as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark all as read")


@router.post("", response_model=NotificationResponse, status_code=201)
def create_notification(
    data: NotificationCreate,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Create a new notification (admin or system use)."""
    logger.info(f"POST /notifications - user: {current_user.id}")

    if current_user.id != data.user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=403, detail="Cannot create notification for other users"
        )

    try:
        result = service.create_notification_service(data=data)
        return result
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to create notification")


@router.post("/read-all", response_model=dict)
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    """Mark all notifications as read for the current user."""
    logger.info(f"POST /notifications/read-all - user: {current_user.id}")

    try:
        count = service.mark_all_notifications_read(user=current_user)
        return {"message": f"Marked {count} notifications as read", "count": count}
    except Exception as e:
        logger.error(f"Error marking all as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark all as read")
