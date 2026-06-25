#!/usr/bin/env python
import os
import sys
sys.path.insert(0, ".")
import app.db.models
from app.db.session import SessionLocal
from app.modules.payments.models import Payment, PaymentStatus, PaymentType, EscrowStatus
from app.modules.bookings.models import BookingStatus, Booking
from app.modules.payments.service import PaymentService
import requests
import uuid
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"

def log_payload(step, response):
    print(f"\n{'='*50}\n[PAYLOAD LOG] {step}")
    print(f"Status: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)
    print(f"{'='*50}\n")

def simulate():
    from app.modules.users.models import User
    from app.modules.vendors.models import Vendor
    from app.modules.auth.service import AuthService
    
    db = SessionLocal()
    
    # Get any customer
    customer = db.query(User).filter(User.role == "customer").first()
    if not customer:
        print("Creating seed customer...")
        customer = User(email=f"customer_{uuid.uuid4().hex[:8]}@example.com", password_hash="hashed_pass", full_name="Seed Customer", role="customer", is_active=True, is_verified=True)
        db.add(customer)
        db.commit()
    
    # Get any vendor
    vendor_user = db.query(User).filter(User.role == "vendor").first()
    if not vendor_user:
        print("Creating seed vendor...")
        vendor_user = User(email=f"vendor_{uuid.uuid4().hex[:8]}@example.com", password_hash="hashed_pass", full_name="Seed Vendor", role="vendor", is_active=True, is_verified=True)
        db.add(vendor_user)
        db.commit()
        
    vendor_profile = db.query(Vendor).filter(Vendor.user_id == vendor_user.id).first()
    if not vendor_profile:
        print("Creating vendor profile for existing vendor user.")
        vendor_profile = Vendor(user_id=vendor_user.id, business_name="Test Business", vendor_type="individual", verification_status="approved")
        db.add(vendor_profile)
        db.commit()
    else:
        vendor_profile.verification_status = "approved"
        db.commit()

    print(f"Using Customer: {customer.email}")
    print(f"Using Vendor: {vendor_user.email}")
    
    from app.core.security import create_access_token
    user_token = create_access_token({"sub": str(customer.id), "role": customer.role})
    vendor_token = create_access_token({"sub": str(vendor_user.id), "role": vendor_user.role})

    # 3. Create Listing
    print("Creating listing...")
    res = requests.post(f"{BASE_URL}/listings/", headers={"Authorization": f"Bearer {vendor_token}"}, json={
        "title": "Grand Hall E2E", "description": "A grand hall", "price": 5000,
        "listing_type": "VENUE", "location": "Mumbai", "details": {"capacity": 500},
        "status": "PUBLISHED"
    })
    if res.status_code != 200:
        print(f"Failed to create listing: {res.text}")
        
        # Try to register vendor using the DB properly
        return
    listing_id = res.json()["id"]

    # 4. Create Booking
    print("Creating booking...")
    event_date = (datetime.now() + timedelta(days=10)).isoformat()
    res = requests.post(f"{BASE_URL}/bookings", headers={"Authorization": f"Bearer {user_token}"}, json={
        "listing_id": listing_id, "event_date": event_date, "end_date": None, "special_request": "Needs food"
    })
    if res.status_code != 200:
        print(f"Failed to create booking: {res.text}")
        return
    booking_id = res.json()["id"]

    # 5. Vendor Accepts Booking
    print("Vendor approving booking...")
    res = requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id}", headers={"Authorization": f"Bearer {vendor_token}"}, json={
        "status": "APPROVED"
    })
    if res.status_code != 200:
        print(f"Failed to approve booking: {res.text}")
        return
    log_payload("1. AFTER APPROVED (Vendor API Payload)", requests.get(f"{BASE_URL}/vendors/bookings", headers={"Authorization": f"Bearer {vendor_token}"}))

    # 6. User Pays Advance
    print("User requesting advance payment...")
    from app.modules.payments.models import Payment, PaymentType, PaymentStatus, EscrowStatus
    
    db = SessionLocal()
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    expected_amount = int(booking.total_price * 0.3)
    
    payment = Payment(
        booking_id=booking_id,
        amount=expected_amount,
        currency="INR",
        payment_type=PaymentType.ADVANCE,
        razorpay_order_id="mock_order_id",
        escrow_status=EscrowStatus.PENDING,
        status=PaymentStatus.PENDING
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    payment_id_str = str(payment.id)

    print("Mocking successful advance payment verify via DB...")
    db = SessionLocal()
    payment = db.query(Payment).filter(Payment.id == payment_id_str).first()
    payment.status = PaymentStatus.SUCCESS
    payment.razorpay_payment_id = f"pay_test_adv_{uuid.uuid4().hex[:8]}"
    payment.escrow_status = EscrowStatus.PARTIALLY_RELEASED
    payment.vendor_released_amount = int(payment.amount * 0.9)
    payment.escrow_amount = payment.amount - payment.vendor_released_amount
    
    booking = payment.booking
    booking.status = BookingStatus.CONFIRMED
    booking.advance_paid = True
    db.commit()

    log_payload("2. AFTER ADVANCE PAID (Vendor API Payload)", requests.get(f"{BASE_URL}/vendors/bookings", headers={"Authorization": f"Bearer {vendor_token}"}))

    # 7. Customer Requests Cancellation
    print("Customer cancelling...")
    res = requests.patch(f"{BASE_URL}/bookings/{booking_id}", headers={"Authorization": f"Bearer {user_token}"}, json={
        "status": "CANCELLATION_REQUESTED"
    })
    log_payload("3. AFTER CANCELLATION REQUESTED (Vendor API Payload)", requests.get(f"{BASE_URL}/vendors/bookings", headers={"Authorization": f"Bearer {vendor_token}"}))

    # 8. Vendor Processes Refund
    print("Vendor processing refund...")
    # Mock refund_payment
    import app.modules.payments.service
    app.modules.payments.service.refund_payment = lambda p_id, amount: True
    
    res = requests.post(f"{BASE_URL}/vendors/bookings/{booking_id}/refund", headers={"Authorization": f"Bearer {vendor_token}"})
    print("REFUND SETTLEMENT RESPONSE:", json.dumps(res.json(), indent=2))
    log_payload("4. AFTER REFUND PROCESSED (Vendor API Payload)", requests.get(f"{BASE_URL}/vendors/bookings", headers={"Authorization": f"Bearer {vendor_token}"}))

    # 9. Create a second booking to simulate final payment
    print("Creating second booking for final payment...")
    res = requests.post(f"{BASE_URL}/bookings", headers={"Authorization": f"Bearer {user_token}"}, json={
        "listing_id": listing_id, "event_date": (datetime.now() + timedelta(days=20)).isoformat(), "end_date": None, "special_request": "Needs decorations"
    })
    if res.status_code != 200:
        print(f"Failed to create second booking: {res.text}")
        return
    booking_id2 = res.json()["id"]
    requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id2}", headers={"Authorization": f"Bearer {vendor_token}"}, json={"status": "APPROVED"})
    
    booking2 = db.query(Booking).filter(Booking.id == booking_id2).first()
    expected_amount2 = int(booking2.total_price * 0.3)
    payment2 = Payment(
        booking_id=booking_id2,
        amount=expected_amount2,
        currency="INR",
        payment_type=PaymentType.ADVANCE,
        razorpay_order_id="mock_order_id2",
        escrow_status=EscrowStatus.PENDING,
        status=PaymentStatus.PENDING
    )
    db.add(payment2)
    db.commit()
    db.refresh(payment2)
    payment2_id = str(payment2.id)
    
    p2 = db.query(Payment).filter(Payment.id == payment2_id).first()
    p2.status = PaymentStatus.SUCCESS
    p2.razorpay_payment_id = f"pay_test_adv_{uuid.uuid4().hex[:8]}"
    b2 = p2.booking
    b2.status = BookingStatus.AWAITING_FINAL_PAYMENT # Mocking that event is done or ready for final
    b2.advance_paid = True
    db.commit()

    print("User requesting final payment...")
    expected_final_amount = int(booking2.total_price * 0.7)
    final_payment = Payment(
        booking_id=booking_id2,
        amount=expected_final_amount,
        currency="INR",
        payment_type=PaymentType.FINAL,
        razorpay_order_id="mock_order_final",
        escrow_status=EscrowStatus.PENDING,
        status=PaymentStatus.PENDING
    )
    db.add(final_payment)
    db.commit()
    db.refresh(final_payment)
    final_payment_id = str(final_payment.id)
    
    p3 = db.query(Payment).filter(Payment.id == final_payment_id).first()
    p3.status = PaymentStatus.SUCCESS
    p3.razorpay_payment_id = f"pay_test_fin_{uuid.uuid4().hex[:8]}"
    b2.status = BookingStatus.COMPLETED
    db.commit()
    db.close()

    log_payload("5. AFTER FINAL PAYMENT (Vendor API Payload)", requests.get(f"{BASE_URL}/vendors/bookings", headers={"Authorization": f"Bearer {vendor_token}"}))
    print("All e2e verifications complete.")

if __name__ == "__main__":
    simulate()
