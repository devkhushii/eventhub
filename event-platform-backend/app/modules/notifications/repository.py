# app/modules/notifications/repository.py

import logging
from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.modules.notifications.models import Notification, NotificationType

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
