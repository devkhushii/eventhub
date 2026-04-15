# app/modules/notifications/push_service.py

import logging
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Service for sending push notifications via Expo."""

    def __init__(self):
        self.enabled = False
        self._expo_client = None
        self._initialize()

    def _initialize(self):
        """Initialize Expo push notification client."""
        try:
            from expo_server_sdk import ExpoPushClient
            from expo_server_sdk import PushMessage

            self._expo_client = ExpoPushClient()
            self.enabled = True
            logger.info("[Push] Expo push notifications enabled")
        except ImportError:
            logger.warning(
                "[Push] expo-server-sdk not installed. Push notifications disabled."
            )
        except Exception as e:
            logger.warning(f"[Push] Failed to initialize Expo: {e}")

    async def send_notification(
        self,
        user_id: UUID,
        title: str,
        body: str,
        data: dict = None,
        device_tokens: list = None,
    ) -> bool:
        """Send push notification to user's device(s)."""
        if not self.enabled:
            logger.info(
                f"[Push] Push disabled, skipping notification for user {user_id}"
            )
            return False

        tokens = device_tokens or await self._get_user_device_tokens(user_id)

        if not tokens:
            logger.info(f"[Push] No device tokens for user {user_id}")
            return False

        try:
            messages = []
            for token in tokens:
                if token:
                    messages.append(
                        {
                            "to": token,
                            "title": title,
                            "body": body,
                            "data": data or {},
                            "sound": "default",
                            "priority": "high",
                        }
                    )

            if not messages:
                return False

            response = self._expo_client.push_message_send(messages)

            if response.get("errors"):
                for error in response.get("errors", []):
                    logger.error(f"[Push] Error: {error}")
                return False

            logger.info(f"[Push] Sent {len(messages)} notifications to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"[Push] Failed to send notification: {e}")
            return False

    async def _get_user_device_tokens(self, user_id: UUID) -> list:
        """Get user's device tokens from database."""
        try:
            from app.db.session import SessionLocal
            from app.modules.users.models import User

            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user and user.device_token:
                    return [user.device_token]
                if user and user.fcm_token:
                    return [user.fcm_token]
                return []
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
        """Send new chat message notification."""
        await self.send_notification(
            user_id=user_id,
            title=f"New message from {sender_name}",
            body=message_preview[:100] if message_preview else "New message",
            data={"type": "CHAT", "chat_id": str(chat_id)},
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
