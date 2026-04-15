# app/modules/notifications/trigger.py

import logging
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class NotificationTrigger:
    """Central notification trigger - integrates DB, WebSocket, and Push."""

    def __init__(self):
        self.websocket_manager = None
        self.push_service = None
        self._initialize()

    def _initialize(self):
        try:
            from app.modules.notifications.websocket_manager import notification_manager

            self.websocket_manager = notification_manager
        except Exception as e:
            logger.warning(
                f"[NotificationTrigger] WebSocket manager not available: {e}"
            )

        try:
            from app.modules.notifications.push_service import push_service

            self.push_service = push_service
        except Exception as e:
            logger.warning(f"[NotificationTrigger] Push service not available: {e}")

    async def send(
        self,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        reference_id: UUID = None,
        send_push: bool = True,
        send_websocket: bool = True,
    ):
        """Send notification via all available channels."""
        notification_data = None

        try:
            from app.db.session import SessionLocal
            from app.modules.notifications.models import NotificationType, Notification
            from app.modules.notifications.schemas import NotificationCreate

            db = SessionLocal()
            try:
                notification = Notification(
                    user_id=user_id,
                    type=NotificationType(notification_type),
                    reference_id=reference_id,
                    title=title,
                    message=message,
                    is_read=False,
                )
                db.add(notification)
                db.commit()
                db.refresh(notification)

                notification_data = {
                    "id": str(notification.id),
                    "type": notification_type,
                    "title": title,
                    "message": message,
                    "reference_id": str(reference_id) if reference_id else None,
                    "created_at": notification.created_at.isoformat()
                    if notification.created_at
                    else None,
                    "is_read": False,
                }
                logger.info(
                    f"[NotificationTrigger] Created notification {notification.id} for user {user_id}"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[NotificationTrigger] Failed to save to DB: {e}")

        if send_websocket and self.websocket_manager:
            try:
                await self.websocket_manager.send_notification(
                    str(user_id),
                    notification_data or {"title": title, "message": message},
                )
            except Exception as e:
                logger.error(f"[NotificationTrigger] WebSocket failed: {e}")

        if send_push and self.push_service:
            try:
                await self.push_service.send_notification(
                    user_id=user_id,
                    title=title,
                    body=message,
                    data={
                        "type": notification_type,
                        "reference_id": str(reference_id) if reference_id else None,
                    },
                )
            except Exception as e:
                logger.error(f"[NotificationTrigger] Push failed: {e}")

    async def notify_booking_created(
        self, vendor_id: UUID, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify vendor when new booking is created."""
        await self.send(
            user_id=vendor_id,
            notification_type="BOOKING",
            title="New Booking Request 📋",
            message=f"You have a new booking request for '{listing_title}'",
            reference_id=booking_id,
        )

    async def notify_booking_approved(
        self, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify user when booking is approved."""
        await self.send(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Approved! ✅",
            message=f"Your booking for '{listing_title}' has been approved",
            reference_id=booking_id,
        )

    async def notify_booking_rejected(
        self, user_id: UUID, booking_id: UUID, listing_title: str, reason: str = None
    ):
        """Notify user when booking is rejected."""
        msg = f"Your booking for '{listing_title}' was rejected."
        if reason:
            msg += f" Reason: {reason}"
        await self.send(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Rejected",
            message=msg,
            reference_id=booking_id,
        )

    async def notify_booking_cancelled(
        self, user_id: UUID, booking_id: UUID, listing_title: str, cancelled_by: str
    ):
        """Notify user when booking is cancelled."""
        await self.send(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Cancelled",
            message=f"Booking for '{listing_title}' was cancelled by {cancelled_by}",
            reference_id=booking_id,
        )

    async def notify_chat_message(
        self, user_id: UUID, chat_id: UUID, sender_name: str, message_preview: str
    ):
        """Notify user when they receive a new chat message."""
        await self.send(
            user_id=user_id,
            notification_type="MESSAGE",
            title=f"New message from {sender_name}",
            message=message_preview[:100]
            if message_preview
            else "You have a new message",
            reference_id=chat_id,
        )

    async def notify_vendor_approved(self, user_id: UUID, business_name: str):
        """Notify vendor when their application is approved."""
        await self.send(
            user_id=user_id,
            notification_type="SYSTEM",
            title="Vendor Application Approved! 🎉",
            message=f"Your vendor application for '{business_name}' has been approved",
        )

    async def notify_vendor_rejected(self, user_id: UUID, reason: str = None):
        """Notify vendor when their application is rejected."""
        msg = "Your vendor application was not approved."
        if reason:
            msg += f" Reason: {reason}"
        await self.send(
            user_id=user_id,
            notification_type="SYSTEM",
            title="Vendor Application Update",
            message=msg,
        )


notification_trigger = NotificationTrigger()
