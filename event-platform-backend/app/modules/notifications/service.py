# app/modules/notifications/service.py

import logging
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.schemas import (
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
    UnreadCountResponse,
    NotificationListResponse,
)
from app.modules.notifications.models import NotificationType

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = NotificationRepository(db)

    def fetch_notifications(
        self,
        user,
        skip: int = 0,
        limit: int = 50,
        include_read: bool = True,
        notification_type: Optional[NotificationType] = None,
        is_read: Optional[bool] = None,
    ) -> NotificationListResponse:
        logger.info(f"Fetching notifications for user {user.id}")

        notifications = self.repository.get_notifications_by_user(
            user_id=user.id,
            skip=skip,
            limit=limit,
            include_read=include_read,
            notification_type=notification_type,
            is_read=is_read,
        )

        total = len(notifications)

        return NotificationListResponse(
            notifications=[
                NotificationResponse(
                    id=n.id,
                    user_id=n.user_id,
                    type=n.type,
                    reference_id=n.reference_id,
                    title=n.title,
                    message=n.message,
                    is_read=n.is_read,
                    created_at=n.created_at,
                )
                for n in notifications
            ],
            total=total,
        )

    def fetch_unread_count(self, user) -> UnreadCountResponse:
        logger.info(f"Fetching unread count for user {user.id}")

        count = self.repository.get_unread_count(user.id)

        return UnreadCountResponse(unread_count=count)

    def create_notification_service(
        self, data: NotificationCreate
    ) -> NotificationResponse:
        logger.info(f"Creating notification for user {data.user_id}")

        notification = self.repository.create_notification(data.model_dump())

        response = NotificationResponse(
            id=notification.id,
            user_id=notification.user_id,
            type=notification.type,
            reference_id=notification.reference_id,
            title=notification.title,
            message=notification.message,
            is_read=notification.is_read,
            created_at=notification.created_at,
        )

        self._trigger_delivery(notification, data.user_id, data.type, data.reference_id)

        return response

    def _trigger_delivery(
        self,
        notification,
        user_id: UUID,
        notification_type: NotificationType,
        reference_id: Optional[UUID],
    ):
        """Send notification via WebSocket and trigger Celery push task."""

        notification_data = {
            "id": str(notification.id),
            "type": str(notification_type.value),
            "title": notification.title,
            "message": notification.message,
            "reference_id": str(reference_id) if reference_id else None,
            "created_at": notification.created_at.isoformat()
            if notification.created_at
            else None,
            "is_read": notification.is_read,
        }

        self._send_websocket_notification(str(user_id), notification_data)
        self._trigger_push_task(
            str(user_id),
            notification.title,
            notification.message,
            {
                "type": notification_type.value,
                "reference_id": str(reference_id) if reference_id else None,
                "notification_id": str(notification.id),
            },
        )

    def _send_websocket_notification(self, user_id: str, notification_data: dict):
        """Send real-time notification via WebSocket."""
        try:
            from app.modules.notifications.websocket_manager import notification_manager
            import asyncio

            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(
                    notification_manager.send_notification(user_id, notification_data)
                )
            else:
                loop.run_until_complete(
                    notification_manager.send_notification(user_id, notification_data)
                )
            logger.info(
                f"[Service] WebSocket notification triggered for user {user_id}"
            )
        except Exception as e:
            logger.warning(f"[Service] WebSocket delivery failed: {e}")

    def _trigger_push_task(self, user_id: str, title: str, message: str, data: dict):
        """Trigger Celery task for push notification."""
        try:
            from app.modules.tasks import send_push_notification_task
            from celery import shared_task

            if isinstance(send_push_notification_task, shared_task):
                send_push_notification_task.delay(user_id, title, message, data)
            else:
                send_push_notification_task(user_id, title, message, data)

            logger.info(f"[Service] Push task queued for user {user_id}")
        except Exception as e:
            logger.warning(f"[Service] Push task failed to queue: {e}")

    def create_notification(
        self,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        reference_id: UUID = None,
    ) -> Optional[NotificationResponse]:
        """Helper method to create notifications from other services."""
        try:
            type_enum = NotificationType(notification_type)

            notification_data = NotificationCreate(
                user_id=user_id,
                type=type_enum,
                reference_id=reference_id,
                title=title,
                message=message,
            )

            return self.create_notification_service(notification_data)
        except Exception as e:
            logger.error(f"Failed to create notification: {e}")
            return None

    def mark_notification_read(
        self, notification_id: UUID, user_id: UUID
    ) -> Optional[NotificationResponse]:
        logger.info(
            f"Marking notification {notification_id} as read for user {user_id}"
        )

        notification = self.repository.get_notification_by_id(notification_id)

        if not notification:
            logger.warning(f"Notification {notification_id} not found")
            return None

        if notification.user_id != user_id:
            logger.warning(
                f"User {user_id} does not own notification {notification_id}"
            )
            return None

        notification.is_read = True
        self.db.commit()
        self.db.refresh(notification)

        return NotificationResponse(
            id=notification.id,
            user_id=notification.user_id,
            type=notification.type,
            reference_id=notification.reference_id,
            title=notification.title,
            message=notification.message,
            is_read=notification.is_read,
            created_at=notification.created_at,
        )

    def mark_all_notifications_read(self, user) -> int:
        logger.info(f"Marking all notifications as read for user {user.id}")

        return self.repository.mark_all_as_read(user.id)
