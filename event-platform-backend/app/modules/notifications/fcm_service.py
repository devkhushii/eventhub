# app/modules/notifications/fcm_service.py

"""
FCM Service for Firebase Cloud Messaging.
Sends push notifications via Firebase Admin SDK.
"""

import logging
import os
from typing import Optional, List

logger = logging.getLogger(__name__)


class FCMService:
    """Service for sending push notifications via Firebase Cloud Messaging."""

    def __init__(self):
        self.initialized = False
        self._initialize()

    def _initialize(self):
        """Initialize Firebase Admin SDK with service account."""
        try:
            import firebase_admin
            from firebase_admin import credentials

            candidates = [
                "/app/service_account.json",
                os.path.join(
                    os.path.dirname(__file__), "..", "..", "..", "service_account.json"
                ),
                os.path.join(
                    os.path.dirname(__file__),
                    "..",
                    "..",
                    "..",
                    "..",
                    "service_account.json",
                ),
            ]

            service_account_path = None
            for candidate in candidates:
                if os.path.exists(candidate):
                    service_account_path = candidate
                    logger.info(f"[FCM] Found service account at: {candidate}")
                    break

            if not service_account_path:
                logger.warning("[FCM] Service account file not found")
                return

            if not firebase_admin._apps:
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)

            self.initialized = True
            logger.info("[FCM] Firebase Admin SDK initialized successfully")

        except ImportError:
            logger.warning("[FCM] firebase-admin not installed. FCM disabled.")
        except Exception as e:
            logger.warning(f"[FCM] Failed to initialize Firebase: {e}")

    def is_available(self) -> bool:
        """Check if FCM service is available."""
        return self.initialized

    async def send_notification(
        self,
        token: str,
        title: str,
        message: str,
        data: Optional[dict] = None,
    ) -> dict:
        """Send push notification via FCM to a single device."""
        if not self.initialized:
            return {"success": False, "error": "FCM not initialized"}

        try:
            from firebase_admin import messaging

            android_config = messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="default",
                    title=title,
                    body=message,
                ),
            )

            apns_config = messaging.ApnsConfig(
                payload=messaging.Aps(
                    alert=messaging.ApsAlert(title=title, body=message),
                    badge=1,
                )
            )

            notification = messaging.Notification(
                title=title,
                body=message,
            )

            fcm_message = messaging.Message(
                notification=notification,
                data=data or {},
                token=token,
                android=android_config,
                apns=apns_config,
            )

            response = messaging.send(fcm_message)
            logger.info(f"[FCM] Message sent successfully: {response}")
            return {"success": True, "message_id": response}

        except Exception as e:
            logger.error(f"[FCM] Failed to send notification: {e}")
            return {"success": False, "error": str(e)}

    async def send_batch(
        self,
        tokens: List[str],
        title: str,
        message: str,
        data: Optional[dict] = None,
    ) -> dict:
        """Send push notification to multiple devices via FCM."""
        if not self.initialized:
            return {"success": False, "error": "FCM not initialized"}

        try:
            from firebase_admin import messaging

            android_config = messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="default",
                    title=title,
                    body=message,
                ),
            )

            messages = []
            for token in tokens:
                msg = messaging.Message(
                    notification=messaging.Notification(title=title, body=message),
                    data=data or {},
                    token=token,
                    android=android_config,
                )
                messages.append(msg)

            response = messaging.send_all(messages)

            logger.info(
                f"[FCM] Batch sent: {response.success_count} successful, "
                f"{response.failure_count} failed"
            )

            return {
                "success": response.success_count > 0,
                "sent": response.success_count,
                "total": len(tokens),
                "failed": response.failure_count,
            }

        except Exception as e:
            logger.error(f"[FCM] Batch send failed: {e}")
            return {"success": False, "error": str(e)}


fcm_service = FCMService()
