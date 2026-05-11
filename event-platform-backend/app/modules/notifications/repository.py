# app/modules/notifications/repository.py

import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.modules.notifications.models import (
    Notification,
    NotificationType,
    DeviceToken,
    DevicePlatform,
)

logger = logging.getLogger(__name__)


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_notifications_by_user(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 50,
        include_read: bool = True,
        notification_type: Optional[NotificationType] = None,
        is_read: Optional[bool] = None,
    ) -> list[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)

        if not include_read:
            query = query.where(Notification.is_read == False)

        if notification_type is not None:
            query = query.where(Notification.type == notification_type)

        if is_read is not None:
            query = query.where(Notification.is_read == is_read)

        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_unread_count(self, user_id: UUID) -> int:
        query = (
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)
        )

        result = self.db.execute(query)
        return result.scalar() or 0

    def get_notification_by_id(self, notification_id: UUID) -> Optional[Notification]:
        query = select(Notification).where(Notification.id == notification_id)
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def create_notification(self, data: dict) -> Notification:
        notification = Notification(**data)
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)

        logger.info(
            f"Created notification {notification.id} for user {notification.user_id}"
        )
        return notification

    def mark_as_read(self, notification_id: UUID) -> Optional[Notification]:
        notification = self.get_notification_by_id(notification_id)

        if notification:
            notification.is_read = True
            self.db.commit()
            self.db.refresh(notification)
            logger.info(f"Marked notification {notification_id} as read")

        return notification

    def mark_all_as_read(self, user_id: UUID) -> int:
        query = (
            Notification.__table__.update()
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)
            .values(is_read=True)
        )

        result = self.db.execute(query)
        self.db.commit()

        logger.info(
            f"Marked {result.rowcount} notifications as read for user {user_id}"
        )
        return result.rowcount


class DeviceTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_tokens_by_user(self, user_id: UUID) -> List[DeviceToken]:
        query = (
            select(DeviceToken)
            .where(DeviceToken.user_id == user_id)
            .where(DeviceToken.is_active == True)
        )
        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_token_by_value(self, token: str) -> Optional[DeviceToken]:
        query = select(DeviceToken).where(DeviceToken.token == token)
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def create_or_update_token(
        self,
        user_id: UUID,
        token: str,
        platform: DevicePlatform = DevicePlatform.ANDROID,
        device_id: str = None,
        app_version: str = None,
    ) -> DeviceToken:
        existing = self.get_token_by_value(token)

        if existing:
            existing.last_used_at = datetime.now(timezone.utc)
            existing.is_active = True
            if device_id:
                existing.device_id = device_id
            if app_version:
                existing.app_version = app_version
            self.db.commit()
            self.db.refresh(existing)
            logger.info(f"Updated device token {existing.id}")
            return existing

        new_token = DeviceToken(
            user_id=user_id,
            token=token,
            platform=platform,
            device_id=device_id,
            app_version=app_version,
        )
        self.db.add(new_token)
        self.db.commit()
        self.db.refresh(new_token)
        logger.info(f"Created device token {new_token.id}")
        return new_token

    def deactivate_token(self, token: str) -> bool:
        existing = self.get_token_by_value(token)
        if existing:
            existing.is_active = False
            self.db.commit()
            logger.info(f"Deactivated token {existing.id}")
            return True
        return False

    def deactivate_all_user_tokens(self, user_id: UUID) -> int:
        query = (
            DeviceToken.__table__.update()
            .where(DeviceToken.user_id == user_id)
            .where(DeviceToken.is_active == True)
            .values(is_active=False)
        )
        result = self.db.execute(query)
        self.db.commit()
        logger.info(f"Deactivated {result.rowcount} tokens for user {user_id}")
        return result.rowcount

    def cleanup_old_tokens(self, user_id: UUID, keep_recent: int = 5) -> int:
        subquery = (
            select(DeviceToken.id)
            .where(DeviceToken.user_id == user_id)
            .where(DeviceToken.is_active == True)
            .order_by(DeviceToken.last_used_at.desc())
            .limit(keep_recent)
        )
        query = (
            DeviceToken.__table__.update()
            .where(DeviceToken.user_id == user_id)
            .where(DeviceToken.is_active == True)
            .where(~DeviceToken.id.in_(subquery))
            .values(is_active=False)
        )
        result = self.db.execute(query)
        self.db.commit()
        if result.rowcount > 0:
            logger.info(f"Cleaned up {result.rowcount} old tokens")
        return result.rowcount
