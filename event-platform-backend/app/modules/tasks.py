import logging
from app.core.celery_app import celery_app
from smtplib import SMTPException

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def send_verification_email_task(self, email_to: str, token: str):
    """
    Background task to send verification emails without blocking APIs.
    """
    logger.info(f"Received verification email task for {email_to}")
    try:
        import asyncio
        from app.modules.auth.email_service import EmailService

        # Celery evaluates synchronously, so we run the async method manually
        asyncio.run(EmailService.send_verification_email(email_to, token))

        logger.info(f"Verification email task completed for {email_to}")
        return {"status": "success", "to": email_to}
    except Exception as exc:
        logger.error(f"Error sending verification email to {email_to}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=5)
def verify_payment_status_task(self, payment_id: str):
    """
    Background job to periodically check payment status if webhook fails.
    """
    try:
        from app.db.session import SessionLocal
        from app.modules.payments.service import PaymentService
        from app.modules.payments.repository import PaymentRepository

        db = SessionLocal()
        try:
            payment = PaymentRepository.get_by_id(db, payment_id)
            if payment and payment.status == "PENDING":
                # Call razorpay or update logic
                logger.info(f"Checking payment {payment_id} status...")
        finally:
            db.close()
    except Exception as exc:
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(bind=True, max_retries=3)
def send_push_notification_task(
    user_id: str, title: str, message: str, data: dict = None
):
    """
    Background task to send Expo push notification to user.

    Args:
        user_id: UUID of the user to send notification to
        title: Notification title
        message: Notification body
        data: Optional additional data payload
    """
    logger.info(f"[PushTask] Sending push to user {user_id}: {title}")

    try:
        from app.db.session import SessionLocal
        from app.modules.users.models import User
        from app.modules.notifications.expo_push_service import expo_push_service

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()

            if not user:
                logger.warning(f"[PushTask] User {user_id} not found")
                return {"success": False, "error": "User not found"}

            if not user.expo_push_token:
                logger.info(f"[PushTask] No expo_push_token for user {user_id}")
                return {"success": False, "error": "No push token"}

            result = expo_push_service.send_notification(
                token=user.expo_push_token,
                title=title,
                message=message,
                data=data,
            )

            if not result.get("success") and result.get("error"):
                error_msg = result.get("error", "")

                if "Invalid" in error_msg or "Device" in error_msg:
                    logger.warning(
                        f"[PushTask] Invalid token, removing for user {user_id}"
                    )
                    user.expo_push_token = None
                    db.commit()

            return result

        finally:
            db.close()

    except Exception as exc:
        logger.error(f"[PushTask] Failed to send push: {exc}")
        raise self.retry(exc=exc, countdown=30)
