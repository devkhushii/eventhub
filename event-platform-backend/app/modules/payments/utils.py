import hmac
import hashlib
import razorpay
from app.core.config import settings

client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def create_order(amount):
    return client.order.create(
        {"amount": amount * 100, "currency": "INR", "payment_capture": 1}
    )


def create_payment_link(amount, customer):
    return client.payment_link.create(
        {
            "amount": amount * 100,
            "currency": "INR",
            "description": "Booking Payment",
            "customer": customer,
        }
    )


def verify_signature(order_id, payment_id, signature):
    """Use Razorpay SDK's built-in verification instead of manual HMAC."""
    try:
        params_dict = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }
        client.utility.verify_payment_signature(params_dict)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify Razorpay webhook signature."""
    try:
        expected_signature = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)
    except Exception:
        return False


def refund_payment(payment_id):
    return client.payment.refund(payment_id)
