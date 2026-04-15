# app/modules/auth/email_service.py

import logging
from fastapi_mail import FastMail, MessageSchema  # type: ignore
from app.core.mail import conf

logger = logging.getLogger(__name__)

# Hardcoded test email - remove after testing
# TEST_EMAIL = "devkhushii.16@gmail.com"


class EmailService:
    @staticmethod
    async def send_verification_email(email: str, token: str):
        """Send verification email"""
        print(f"[EMAIL] Starting send to {email}")

        try:
            # Use actual recipient as a list
            recipients = [email]
            print(f"[EMAIL] Recipients: {recipients}")

            verification_link = (
                f"http://localhost:8000/api/v1/auth/verify-email?token={token}"
            )

            message = MessageSchema(
                subject="[EventHub] Verify your email - Complete Registration",
                recipients=recipients,
                body=f"""
Hello,

Welcome to EventHub!

Thanks for registering with us. To complete your registration, please verify your email by clicking the link below:

{verification_link}

This link will expire in 24 hours.

If you didn't create an account with us, please ignore this email.

Best regards,
The EventHub Team
""",
                subtype="plain",
            )

            print(f"[EMAIL] Creating FastMail with {conf.MAIL_USERNAME}")
            fm = FastMail(conf)

            print("[EMAIL] Sending message...")
            result = await fm.send_message(message)

            print(f"[EMAIL] SUCCESS - Result: {result}")
            logger.info(f"Verification email sent to {email}")
            return result

        except Exception as e:
            print(f"[EMAIL] ERROR: {str(e)}")
            logger.error(f"Failed to send verification email: {str(e)}")
            raise e

    @staticmethod
    async def send_password_reset_email(email: str, token: str):
        """Send password reset email"""
        print(f"[EMAIL] Password reset to {email}")

        try:
            recipients = [TEST_EMAIL]

            reset_link = (
                f"http://localhost:8000/api/v1/auth/reset-password?token={token}"
            )

            message = MessageSchema(
                subject="[EventHub] Reset your password",
                recipients=recipients,
                body=f"""
Hello,

We received a request to reset your password:

{reset_link}

This link expires in 1 hour.

Best regards,
The EventHub Team
""",
                subtype="plain",
            )

            fm = FastMail(conf)
            result = await fm.send_message(message)

            print(f"[EMAIL] Password reset sent - Result: {result}")
            logger.info(f"Password reset email sent to {email}")
            return result

        except Exception as e:
            print(f"[EMAIL] Password reset ERROR: {str(e)}")
            logger.error(f"Failed to send password reset email: {str(e)}")
            raise e
