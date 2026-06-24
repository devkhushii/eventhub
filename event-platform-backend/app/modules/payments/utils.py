import hmac
import hashlib
import logging
import razorpay
import uuid
from app.core.config import settings

logger = logging.getLogger(__name__)

client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def is_simulation_mode():
    """Check if running in simulation/dev mode where signature verification should be bypassed."""
    return (
        settings.ENVIRONMENT.lower() in ["development", "test", "local"]
        or settings.DEBUG
        or settings.RAZORPAY_KEY_SECRET in ["", "test_secret", "test_key_secret"]
        or settings.RAZORPAY_KEY_ID.startswith("test")
    )


def create_order(amount):
    logger.info(
        f"[TEMP LOG] [Payment] create_order: amount={amount}, "
        f"amount_in_paise={amount * 100}"
    )
    return client.order.create(
        {"amount": amount * 100, "currency": "INR", "payment_capture": 1}
    )



# UNUSED: Legacy Razorpay payment link flow (app now uses SDK flow)
# def create_payment_link(amount, customer):
#     return client.payment_link.create(
#         {
#             "amount": amount * 100,
#             "currency": "INR",
#             "description": "Booking Payment",
#             "customer": customer,
#             "reference_id": f"payment_link_{uuid.uuid4().hex[:8]}",
#         }
#     )


def verify_signature(order_id, payment_id, signature):
    """
    Verify Razorpay payment signature.

    In simulation/dev mode, bypass actual verification for testing.
    In production, use Razorpay SDK's built-in verification.
    """
    # Simulation mode bypass for development/testing
    if is_simulation_mode():
        logger = logging.getLogger(__name__)
        logger.warning(
            f"[SIGNATURE] Simulation mode - bypassing signature verification. "
            f"order_id={order_id}, payment_id={payment_id}"
        )
        return True

    # Production: use Razorpay SDK's built-in verification
    try:
        params_dict = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }
        client.utility.verify_payment_signature(params_dict)
        return True
    except razorpay.errors.SignatureVerificationError:
        logger = logging.getLogger(__name__)
        logger.error(f"[SIGNATURE] Invalid signature for order: {order_id}")
        return False
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"[SIGNATURE] Verification error: {e}")
        return False


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify Razorpay webhook signature."""
    # In simulation mode, allow webhook processing without signature verification
    if is_simulation_mode():
        logger = logging.getLogger(__name__)
        logger.warning(
            f"[WEBHOOK] Simulation mode - bypassing webhook signature verification"
        )
        return True

    try:
        expected_signature = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)
    except Exception:
        return False


def refund_payment(payment_id):
    return client.payment.refund(payment_id)
