#!/usr/bin/env python
import sys
import uuid
import logging

sys.path.insert(0, ".")

from app.db.session import SessionLocal
from app.modules.bookings.models import Booking, BookingStatus
from app.modules.payments.models import Payment, PaymentType, PaymentStatus
from app.modules.users.models import User
from app.modules.listings.models import Listing
from app.modules.vendors.models import Vendor
from app.modules.payments.service import PaymentService
from sqlalchemy import text
from fastapi import HTTPException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_refund_audit():
    db = SessionLocal()
    
    # 1. Clean up old test data to avoid conflicts, if any
    
    # Setup test data
    # Create test user
    test_user_id = uuid.uuid4()
    db.execute(text("INSERT INTO users (id, name, email, phone, is_verified) VALUES (:id, 'Test User', 'testuser@example.com', '9999999990', true) ON CONFLICT DO NOTHING"), {"id": test_user_id})
    
    # Get any user for test if insert didn't work due to conflict (since ID is random, conflict is only on email/phone)
    user = db.execute(text("SELECT id FROM users WHERE email = 'testuser@example.com'")).fetchone()
    if not user:
        # Create a completely unique one
        unique_id = uuid.uuid4()
        db.execute(text("INSERT INTO users (id, name, email, phone, is_verified) VALUES (:id, 'Test User', 'testuser2@example.com', '9999999991', true)"), {"id": unique_id})
        user = db.execute(text("SELECT id FROM users WHERE email = 'testuser2@example.com'")).fetchone()
    
    user_id = user[0]
    
    # Create test vendor
    vendor_user_id = uuid.uuid4()
    db.execute(text("INSERT INTO users (id, name, email, phone, is_verified) VALUES (:id, 'Test Vendor User', 'testvendor@example.com', '9999999992', true) ON CONFLICT DO NOTHING"), {"id": vendor_user_id})
    v_user = db.execute(text("SELECT id FROM users WHERE email = 'testvendor@example.com'")).fetchone()
    vendor_user_id = v_user[0]
    
    vendor_id = uuid.uuid4()
    db.execute(text("INSERT INTO vendors (id, user_id, business_name, description, status) VALUES (:id, :uid, 'Test Vendor', 'Desc', 'APPROVED') ON CONFLICT DO NOTHING"), {"id": vendor_id, "uid": vendor_user_id})
    vendor = db.execute(text("SELECT id FROM vendors WHERE user_id = :uid"), {"uid": vendor_user_id}).fetchone()
    vendor_id = vendor[0]
    
    # Create test listing
    listing_id = uuid.uuid4()
    db.execute(text("INSERT INTO listings (id, vendor_id, title, description, category, base_price, location) VALUES (:id, :vid, 'Test Listing', 'Desc', 'VENUE', 10000, 'Test')"), {"id": listing_id, "vid": vendor_id})
    
    # Create test booking
    booking_id = uuid.uuid4()
    db.execute(text("""
        INSERT INTO bookings (id, user_id, listing_id, total_price, event_date, status) 
        VALUES (:id, :uid, :lid, 10000, '2030-01-01 00:00:00', 'CANCELLATION_REQUESTED')
    """), {"id": booking_id, "uid": user_id, "lid": listing_id})
    
    # Create successful advance payment
    payment_id = uuid.uuid4()
    db.execute(text("""
        INSERT INTO payments (id, booking_id, amount, currency, payment_type, status, razorpay_order_id, razorpay_payment_id, escrow_status)
        VALUES (:id, :bid, 3000, 'INR', 'ADVANCE', 'SUCCESS', 'order_test', 'pay_test', 'HELD')
    """), {"id": payment_id, "bid": booking_id})
    
    db.commit()
    
    print(f"Test data created. Booking ID: {booking_id}")
    
    try:
        # Audit 3: Vendor ownership validation
        print("Testing Vendor Ownership Validation...")
        fake_vendor_id = uuid.uuid4()
        try:
            PaymentService.process_cancellation_refund(db, booking_id, fake_vendor_id)
            print("ERROR: Allowed refund with fake vendor ID")
        except HTTPException as e:
            if e.status_code == 403:
                print("SUCCESS: Rejected unauthorized vendor")
            else:
                print(f"ERROR: Unexpected exception {e}")
                
        # Audit 4: Refund execution and DB consistency
        print("Testing successful refund...")
        try:
            # We mock the razorpay refund so it doesn't try to call real API for a fake pay_id
            import app.modules.payments.service
            original_refund = app.modules.payments.service.refund_payment
            app.modules.payments.service.refund_payment = lambda p_id, amount: True
            
            payment = PaymentService.process_cancellation_refund(db, booking_id, vendor_id)
            print(f"SUCCESS: Refund executed. Payment status: {payment.status}")
            
            # Check booking status
            b = db.query(Booking).filter(Booking.id == booking_id).first()
            print(f"Booking Status after refund: {b.status}")
            if b.status != BookingStatus.CANCELLED:
                print("ERROR: Booking status is not CANCELLED")
                
            if payment.status != PaymentStatus.REFUNDED:
                print("ERROR: Payment status is not REFUNDED")
            
            if payment.refunded_amount != 2100:
                print(f"ERROR: Expected refunded_amount 2100, got {payment.refunded_amount}")
                
        except Exception as e:
            print(f"ERROR: Refund failed {e}")
            
        # Audit 2: Duplicate Execution
        print("Testing duplicate refund execution...")
        try:
            # Booking is now CANCELLED, should throw 400
            PaymentService.process_cancellation_refund(db, booking_id, vendor_id)
            print("ERROR: Allowed duplicate refund")
        except HTTPException as e:
            if e.status_code == 400 and "Booking must be in CANCELLATION_REQUESTED" in e.detail:
                print("SUCCESS: Rejected duplicate refund due to status check")
            else:
                print(f"ERROR: Unexpected exception {e}")
                
    finally:
        # Cleanup
        db.execute(text("DELETE FROM payments WHERE id = :id"), {"id": payment_id})
        db.execute(text("DELETE FROM bookings WHERE id = :id"), {"id": booking_id})
        db.execute(text("DELETE FROM listings WHERE id = :id"), {"id": listing_id})
        db.execute(text("DELETE FROM vendors WHERE id = :id"), {"id": vendor_id})
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": vendor_user_id})
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        db.commit()
        db.close()
        print("Cleanup done.")

if __name__ == "__main__":
    test_refund_audit()
