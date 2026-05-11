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

    def _is_user_online(self, user_id: UUID, conversation_id: UUID = None) -> bool:
        """Check if user is online via WebSocket."""
        if not self.websocket_manager:
            return False
        try:
            return self.websocket_manager.is_user_connected(str(user_id))
        except Exception:
            return False

    def _should_send_push(
        self,
        user_id: UUID,
        conversation_id: UUID = None,
        active_conversation_id: UUID = None,
    ) -> bool:
        """Smart notification decision engine.

        Send push if:
        - User is not online (websocket disconnected)
        - User is viewing a DIFFERENT conversation
        - User has no active websocket connection
        """
        is_online = self._is_user_online(user_id, conversation_id)

        if not is_online:
            logger.info(f"[NotificationTrigger] User {user_id} offline - sending push")
            return True

        if conversation_id and active_conversation_id:
            if str(conversation_id) != str(active_conversation_id):
                logger.info(
                    f"[NotificationTrigger] User in different conversation - sending push"
                )
                return True

        logger.info(f"[NotificationTrigger] User {user_id} online - skipping push")
        return False

    async def send(
        self,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        reference_id: UUID = None,
        send_push: bool = True,
        send_websocket: bool = True,
        conversation_id: UUID = None,
        active_conversation_id: UUID = None,
        chat_name: str = None,
        sender_id: UUID = None,
    ):
        """Send notification via all available channels.

        Uses smart decision engine to determine if push notification should be sent.
        """
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

        # Send via WebSocket if user is connected
        if send_websocket and self.websocket_manager:
            try:
                if self._is_user_online(user_id, conversation_id):
                    await self.websocket_manager.send_notification(
                        str(user_id),
                        notification_data or {"title": title, "message": message},
                    )
                    logger.info(
                        f"[NotificationTrigger] Sent via WebSocket to user {user_id}"
                    )
            except Exception as e:
                logger.error(f"[NotificationTrigger] WebSocket failed: {e}")

        # Smart push notification decision
        if send_push and self.push_service:
            should_push = self._should_send_push(
                user_id, conversation_id, active_conversation_id
            )

            if should_push:
                try:
                    push_data = {
                        "type": notification_type,
                        "reference_id": str(reference_id) if reference_id else None,
                    }

                    # Add chat_id and chat_name for MESSAGE notifications
                    if notification_type == "MESSAGE" and conversation_id:
                        push_data["chat_id"] = str(conversation_id)
                    if notification_type == "MESSAGE" and chat_name:
                        push_data["chat_name"] = chat_name
                    if notification_type == "MESSAGE" and sender_id:
                        push_data["sender_id"] = str(sender_id)

                    await self.push_service.send_notification(
                        user_id=user_id,
                        title=title,
                        body=message,
                        data=push_data,
                    )
                    logger.info(
                        f"[NotificationTrigger] Sent push to user {user_id} with data: {push_data}"
                    )
                except Exception as e:
                    logger.error(f"[NotificationTrigger] Push failed: {e}")
            else:
                logger.info(f"[NotificationTrigger] Skipped push - user online")

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
        self,
        user_id: UUID,
        chat_id: UUID,
        sender_id: UUID,
        sender_name: str,
        message_preview: str,
        active_conversation_id: UUID = None,
    ):
        """Notify user when they receive a new chat message.

        Args:
            user_id: The user to notify
            chat_id: The chat/conversation ID
            sender_id: ID of the message sender
            sender_name: Name of the message sender
            message_preview: Preview of the message
            active_conversation_id: The conversation the user currently has open (if any)
        """
        await self.send(
            user_id=user_id,
            notification_type="MESSAGE",
            title=f"New message from {sender_name}",
            message=message_preview[:100]
            if message_preview
            else "You have a new message",
            reference_id=chat_id,
            conversation_id=chat_id,
            active_conversation_id=active_conversation_id,
            chat_name=sender_name,
            sender_id=sender_id,
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
