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


@celery_app.task(bind=True, max_retries=1)
def verify_payment_status_task(self, payment_id: str):
    """
    Background job to check payment status - acts as FALLBACK only.

    For SDK flow: verifyPayment API is PRIMARY - this task is only a fallback
    if user abandons the payment after opening SDK.

    This task does NOT wait for webhook - webhook is optional for SDK flow.
    """
    from app.db.session import SessionLocal
    from app.modules.payments.repository import PaymentRepository
    from app.modules.payments.utils import client
    from app.modules.payments.models import Payment, PaymentStatus

    retry_count = self.request.retries + 1
    logger.info(
        f"[Celery] Starting fallback check: db_payment_id={payment_id}, retry_count={retry_count}"
    )

    db = SessionLocal()
    try:
        payment = PaymentRepository.get_by_id(db, payment_id)

        if not payment:
            logger.error(f"[Celery] Payment not found: db_payment_id={payment_id}")
            return {"status": "error", "message": "Payment not found"}

        db.refresh(payment)

        logger.info(
            f"[Celery] db_payment_id={payment.id}, razorpay_order_id={payment.razorpay_order_id}, "
            f"razorpay_payment_id={payment.razorpay_payment_id}, current_status={payment.status}"
        )

        if payment.status == PaymentStatus.SUCCESS:
            logger.info(
                f"[Celery] ✅ Payment already SUCCESS, skipping. db_payment_id={payment.id}"
            )
            return {
                "status": "success",
                "message": "Payment already verified",
            }

        if payment.status == PaymentStatus.FAILED:
            logger.info(
                f"[Celery] Payment already FAILED, skipping. db_payment_id={payment.id}"
            )
            return {"status": "failed", "message": "Payment already failed"}

        if not payment.razorpay_payment_id:
            logger.warning(
                f"[Celery] ⚠️ razorpay_payment_id is None - user may still complete via SDK. "
                f"db_payment_id={payment.id}, razorpay_order_id={payment.razorpay_order_id}, "
                f"retry_count={retry_count}"
            )

            if retry_count == 1:
                logger.info(
                    f"[Celery] One final check in 5 minutes - if no payment_id, mark as abandoned"
                )
                raise self.retry(
                    exc=Exception("Waiting for SDK completion"), countdown=300
                )

            logger.error(
                f"[Celery] No payment_id after timeout → marking as ABANDONED. "
                f"db_payment_id={payment.id}"
            )
            payment.status = PaymentStatus.FAILED
            payment.razorpay_payment_id = f"ABANDONED_{payment.razorpay_order_id}"
            db.commit()
            return {
                "status": "abandoned",
                "message": "Payment abandoned - timed out waiting for SDK",
            }

        logger.info(
            f"[Celery] Payment has razorpay_payment_id: checking status. "
            f"razorpay_payment_id={payment.razorpay_payment_id}"
        )

        try:
            razorpay_payment = client.payment.fetch(payment.razorpay_payment_id)
            razorpay_status = razorpay_payment.get("status")
            logger.info(
                f"[Celery] Razorpay payment status: id={payment.razorpay_payment_id}, status={razorpay_status}"
            )
        except Exception as e:
            logger.error(f"[Celery] Error fetching payment: {e}")
            return {"status": "error", "message": "Failed to verify payment"}

        if razorpay_status == "captured":
            payment.status = PaymentStatus.SUCCESS
            db.commit()
            logger.info(f"[Celery] Payment captured: {payment.id}")
            return {"status": "success", "message": "Payment captured via SDK"}
        elif razorpay_status == "failed":
            payment.status = PaymentStatus.FAILED
            db.commit()
            return {"status": "failed", "message": "Payment failed"}
        else:
            if retry_count == 1:
                raise self.retry(
                    exc=Exception("Payment not yet captured"), countdown=300
                )
            payment.status = PaymentStatus.FAILED
            db.commit()
            return {"status": "abandoned", "message": "Payment timed out"}

    except (celery_app.backend.exception_to_python.__class__, Exception) as exc:
        # Re-raise Celery retry/control exceptions so retry mechanism works
        from celery.exceptions import Retry, MaxRetriesExceededError
        if isinstance(exc, (Retry, MaxRetriesExceededError)):
            raise
        logger.error(f"[Celery] Task failed: {exc}")
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()


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
