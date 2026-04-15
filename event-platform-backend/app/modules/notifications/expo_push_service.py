# app/modules/notifications/expo_push_service.py

import logging
import requests
from typing import Optional, List
from uuid import UUID

logger = logging.getLogger(__name__)

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"


class ExpoPushService:
    """Service for sending push notifications via Expo Push API."""

    def __init__(self):
        self.api_url = EXPO_PUSH_API_URL

    def validate_token(self, token: str) -> bool:
        """Validate that token is a valid Expo push token format."""
        if not token:
            return False
        return token.startswith("ExponentPushToken[")

    def send_notification(
        self,
        token: str,
        title: str,
        message: str,
        data: Optional[dict] = None,
    ) -> dict:
        """
        Send push notification to a single Expo token.

        Args:
            token: Expo push token (must start with ExponentPushToken[...])
            title: Notification title
            message: Notification body
            data: Optional additional data payload

        Returns:
            dict with 'success' boolean and optional 'error' message
        """
        if not self.validate_token(token):
            logger.warning(f"[ExpoPush] Invalid token format: {token[:20]}...")
            return {"success": False, "error": "Invalid Expo token format"}

        try:
            payload = {
                "to": token,
                "title": title,
                "body": message,
            }

            if data:
                payload["data"] = data

            payload["sound"] = "default"
            payload["priority"] = "high"

            response = requests.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

            if response.status_code == 200:
                result = response.json()

                if result.get("errors"):
                    error_details = result["errors"]
                    logger.error(f"[ExpoPush] API errors: {error_details}")
                    return {"success": False, "error": str(error_details)}

                logger.info(
                    f"[ExpoPush] Notification sent successfully to {token[:20]}..."
                )
                return {"success": True, "response": result}
            else:
                logger.error(
                    f"[ExpoPush] HTTP error: {response.status_code} - {response.text}"
                )
                return {"success": False, "error": f"HTTP {response.status_code}"}

        except requests.exceptions.Timeout:
            logger.error("[ExpoPush] Request timeout")
            return {"success": False, "error": "Request timeout"}
        except requests.exceptions.RequestException as e:
            logger.error(f"[ExpoPush] Request failed: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"[ExpoPush] Unexpected error: {e}")
            return {"success": False, "error": str(e)}

    def send_batch(
        self,
        tokens: List[str],
        title: str,
        message: str,
        data: Optional[dict] = None,
    ) -> dict:
        """
        Send push notification to multiple Expo tokens.

        Args:
            tokens: List of Expo push tokens
            title: Notification title
            message: Notification body
            data: Optional additional data payload

        Returns:
            dict with success count and any errors
        """
        valid_tokens = [t for t in tokens if self.validate_token(t)]

        if not valid_tokens:
            logger.warning("[ExpoPush] No valid tokens provided")
            return {"success": False, "error": "No valid tokens"}

        try:
            messages = []
            for token in valid_tokens:
                msg = {
                    "to": token,
                    "title": title,
                    "body": message,
                    "sound": "default",
                    "priority": "high",
                }
                if data:
                    msg["data"] = data
                messages.append(msg)

            chunk_size = 100
            success_count = 0
            errors = []

            for i in range(0, len(messages), chunk_size):
                chunk = messages[i : i + chunk_size]

                response = requests.post(
                    self.api_url,
                    json=chunk,
                    headers={"Content-Type": "application/json"},
                    timeout=30,
                )

                if response.status_code == 200:
                    result = response.json()
                    if result.get("errors"):
                        errors.extend(result["errors"])
                    else:
                        success_count += len(chunk)
                else:
                    errors.append(f"HTTP {response.status_code}")

            logger.info(
                f"[ExpoPush] Batch sent: {success_count}/{len(valid_tokens)} successful"
            )
            return {
                "success": success_count > 0,
                "sent": success_count,
                "total": len(valid_tokens),
                "errors": errors if errors else None,
            }

        except Exception as e:
            logger.error(f"[ExpoPush] Batch send failed: {e}")
            return {"success": False, "error": str(e)}

    def remove_invalid_token(self, db, user_id: UUID, token: str) -> bool:
        """Remove invalid token from user's record."""
        try:
            from app.modules.users.models import User

            user = db.query(User).filter(User.id == user_id).first()
            if user and user.expo_push_token == token:
                user.expo_push_token = None
                db.commit()
                logger.info(f"[ExpoPush] Removed invalid token for user {user_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"[ExpoPush] Failed to remove token: {e}")
            return False


expo_push_service = ExpoPushService()
