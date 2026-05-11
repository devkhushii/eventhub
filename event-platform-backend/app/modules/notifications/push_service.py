# app/modules/notifications/push_service.py

import logging
from typing import Optional, List
from uuid import UUID

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Service for sending push notifications via FCM (Firebase Cloud Messaging)."""

    def __init__(self):
        self.enabled = False
        self._fcm_service = None
        self._initialize()

    def _initialize(self):
        """Initialize FCM service."""
        try:
            from app.modules.notifications.fcm_service import fcm_service

            self._fcm_service = fcm_service
            self.enabled = fcm_service.is_available()

            if self.enabled:
                logger.info("[Push] FCM push notifications enabled")
            else:
                logger.warning("[Push] FCM service not available")
        except Exception as e:
            logger.warning(f"[Push] Failed to initialize FCM: {e}")

    async def send_notification(
        self,
        user_id: UUID,
        title: str,
        body: str,
        data: dict = None,
        device_tokens: list = None,
    ) -> bool:
        """Send push notification to user's device(s) via FCM."""
        if not self.enabled:
            logger.info(
                f"[Push] FCM disabled, skipping notification for user {user_id}"
            )
            return False

        tokens = device_tokens or await self._get_user_device_tokens(user_id)

        if not tokens:
            logger.info(f"[Push] No device tokens for user {user_id}")
            return False

        try:
            token_strings = [t.token if hasattr(t, "token") else str(t) for t in tokens]

            logger.info(
                f"[Push] Sending FCM to {len(token_strings)} devices for user {user_id}"
            )

            if len(token_strings) == 1:
                result = await self._fcm_service.send_notification(
                    token=token_strings[0],
                    title=title,
                    message=body,
                    data=data or {},
                )
            else:
                result = await self._fcm_service.send_batch(
                    tokens=token_strings,
                    title=title,
                    message=body,
                    data=data or {},
                )

            if result.get("success"):
                logger.info(f"[Push] FCM sent successfully to user {user_id}")
                return True
            else:
                logger.error(f"[Push] FCM failed: {result.get('error')}")
                return False

        except Exception as e:
            logger.error(f"[Push] Failed to send notification: {e}")
            return False

    async def _get_user_device_tokens(self, user_id: UUID) -> List:
        """Get user's device tokens from DeviceToken table."""
        try:
            from app.modules.notifications.repository import DeviceTokenRepository
            from app.db.session import SessionLocal

            db = SessionLocal()
            try:
                repo = DeviceTokenRepository(db)
                tokens = repo.get_active_tokens_by_user(user_id)
                logger.info(
                    f"[Push] Found {len(tokens)} active tokens for user {user_id}"
                )
                return tokens
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[Push] Error fetching device tokens: {e}")
            return []

    async def send_booking_notification(
        self,
        user_id: UUID,
        booking_id: UUID,
        booking_title: str,
        status: str,
        action: str,
    ):
        """Send booking-related notification."""
        title, body = self._get_booking_message(status, action, booking_title)

        await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            data={"type": "BOOKING", "booking_id": str(booking_id), "status": status},
        )

    async def send_chat_notification(
        self, user_id: UUID, chat_id: UUID, sender_name: str, message_preview: str
    ):
        """Send new chat message notification with proper data payload."""
        await self.send_notification(
            user_id=user_id,
            title=f"New message from {sender_name}",
            body=message_preview[:100] if message_preview else "New message",
            data={
                "type": "MESSAGE",
                "chat_id": str(chat_id),
                "click_action": "OPEN_CHAT",
            },
        )

    async def send_vendor_approval_notification(
        self, user_id: UUID, approved: bool, business_name: str = None
    ):
        """Send vendor approval notification."""
        if approved:
            await self.send_notification(
                user_id=user_id,
                title="Vendor Application Approved! 🎉",
                body=f"Your vendor application for {business_name or 'your business'} has been approved.",
                data={"type": "VENDOR_APPROVED"},
            )
        else:
            await self.send_notification(
                user_id=user_id,
                title="Vendor Application Update",
                body="Your vendor application was not approved. Please contact support for details.",
                data={"type": "VENDOR_REJECTED"},
            )

    def _get_booking_message(self, status: str, action: str, title: str):
        """Get appropriate message for booking status."""
        messages = {
            "APPROVED": (
                "Booking Confirmed! ✅",
                f"Your booking for '{title}' has been approved.",
            ),
            "REJECTED": (
                "Booking Rejected",
                f"Your booking for '{title}' was not approved.",
            ),
            "CANCELLED": (
                "Booking Cancelled",
                f"Your booking for '{title}' has been cancelled.",
            ),
            "COMPLETED": (
                "Booking Completed 🎉",
                f"Your event '{title}' has been completed.",
            ),
            "CONFIRMED": (
                "Booking Confirmed",
                f"Your booking for '{title}' is now confirmed. Please complete payment.",
            ),
        }
        return messages.get(status, ("Booking Update", f"Booking update for '{title}'"))


push_service = PushNotificationService()
