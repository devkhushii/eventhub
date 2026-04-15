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


@celery_app.task(bind=True, max_retries=6)
def verify_payment_status_task(self, payment_id: str):
    """
    Background job to periodically check payment status until captured.

    Runs with retries:
    - Retry 1: after 10 seconds
    - Retry 2: after 20 seconds
    - Retry 3: after 30 seconds
    - Retry 4: after 45 seconds
    - Retry 5: after 60 seconds
    - Retry 6: after 90 seconds

    Total wait time: up to ~4.5 minutes before giving up.
    """
    from app.db.session import SessionLocal
    from app.modules.payments.repository import PaymentRepository
    from app.modules.payments.utils import client
    from app.modules.payments.service import PaymentService
    from app.modules.payments.models import Payment, PaymentStatus

    logger.info(
        f"[PaymentVerifyTask] Starting task for payment_id={payment_id}, attempt={self.request.retries + 1}"
    )

    db = SessionLocal()
    try:
        payment = PaymentRepository.get_by_id(db, payment_id)

        if not payment:
            logger.error(f"[PaymentVerifyTask] Payment not found: {payment_id}")
            return {"status": "error", "message": "Payment not found"}

        logger.info(
            f"[PaymentVerifyTask] Payment found: id={payment.id}, razorpay_order_id={payment.razorpay_order_id}, current_status={payment.status}"
        )

        if payment.status == PaymentStatus.SUCCESS:
            logger.info(f"[PaymentVerifyTask] Payment already SUCCESS, skipping")
            return {"status": "success", "message": "Payment already verified"}

        if not payment.razorpay_order_id:
            logger.warning(
                f"[PaymentVerifyTask] No razorpay_order_id for payment {payment_id}, cannot verify"
            )
            return {"status": "error", "message": "No Razorpay order ID"}

        # Check payment status from Razorpay
        logger.info(
            f"[PaymentVerifyTask] Fetching payment status from Razorpay for order: {payment.razorpay_order_id}"
        )

        try:
            # Try to fetch payment by order_id
            razorpay_order = client.order.fetch(payment.razorpay_order_id)
            logger.info(
                f"[PaymentVerifyTask] Razorpay order response: {razorpay_order}"
            )

            # Check if payments array has any captured payments
            payments = razorpay_order.get("payments", [])

            if payments and len(payments) > 0:
                # Get the most recent payment
                payment_data = payments[0]
                razorpay_payment_id = payment_data.get("id")
                razorpay_status = payment_data.get("status")
                razorpay_authorized = payment_data.get("authorized", False)
                razorpay_captured = payment_data.get("captured", False)

                logger.info(
                    f"[PaymentVerifyTask] Razorpay payment found: id={razorpay_payment_id}, status={razorpay_status}, authorized={razorpay_authorized}, captured={razorpay_captured}"
                )

                # Also try to fetch payment directly by payment_id if we have one
                if razorpay_payment_id:
                    try:
                        direct_payment = client.payment.fetch(razorpay_payment_id)
                        logger.info(
                            f"[PaymentVerifyTask] Direct payment fetch: {direct_payment}"
                        )
                        razorpay_status = direct_payment.get("status", razorpay_status)
                        razorpay_authorized = direct_payment.get(
                            "authorized", razorpay_authorized
                        )
                        razorpay_captured = direct_payment.get(
                            "captured", razorpay_captured
                        )
                    except Exception as e:
                        logger.warning(
                            f"[PaymentVerifyTask] Direct payment fetch failed: {e}"
                        )

                # Check if payment is captured (success)
                if razorpay_captured or razorpay_status == "captured":
                    logger.info(
                        f"[PaymentVerifyTask] Payment is captured! Updating payment and booking status..."
                    )

                    # Update payment record
                    payment.status = PaymentStatus.SUCCESS
                    payment.razorpay_payment_id = razorpay_payment_id
                    db.commit()

                    # Update booking status
                    booking = payment.booking
                    if booking:
                        from app.modules.bookings.models import BookingStatus

                        if payment.payment_type.value == "ADVANCE":
                            booking.status = BookingStatus.CONFIRMED
                            logger.info(
                                f"[PaymentVerifyTask] Booking {booking.id} status updated to CONFIRMED"
                            )
                        elif payment.payment_type.value == "FINAL":
                            booking.status = BookingStatus.COMPLETED
                            logger.info(
                                f"[PaymentVerifyTask] Booking {booking.id} status updated to COMPLETED"
                            )
                        db.commit()

                    return {
                        "status": "success",
                        "message": "Payment captured and verified",
                    }

                elif razorpay_status == "failed" or razorpay_status == "failed":
                    logger.warning(f"[PaymentVerifyTask] Payment failed in Razorpay")
                    payment.status = PaymentStatus.FAILED
                    db.commit()
                    return {"status": "failed", "message": "Payment failed"}
                else:
                    # Payment not yet captured - need to retry
                    logger.info(
                        f"[PaymentVerifyTask] Payment not captured yet, status={razorpay_status}, will retry..."
                    )
            else:
                logger.info(
                    f"[PaymentVerifyTask] No payments found in Razorpay order, order may still be pending"
                )

        except Exception as e:
            logger.error(f"[PaymentVerifyTask] Error fetching from Razorpay: {e}")

        # Payment not yet captured - schedule retry with exponential backoff
        retry_countdown = (
            [10, 20, 30, 45, 60, 90][self.request.retries]
            if self.request.retries < 6
            else 90
        )
        logger.info(
            f"[PaymentVerifyTask] Scheduling retry {self.request.retries + 1} in {retry_countdown} seconds"
        )
        raise self.retry(
            exc=Exception("Payment not yet captured"), countdown=retry_countdown
        )

    except Exception as exc:
        logger.error(f"[PaymentVerifyTask] Task failed: {exc}")
        raise self.retry(exc=exc, countdown=30)
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
