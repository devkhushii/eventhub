import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def print_payload(name, data):
    print(f"\n{'='*50}\n{name}\n{'='*50}")
    print(json.dumps(data, indent=2))

def create_user(email, password, full_name):
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email, "password": password, "full_name": full_name
    })
    return res.json()

def login(email, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email, "password": password
    })
    return res.json()["access_token"]

def main():
    print("Testing Vendor Payment History Endpoint...")
    
    # 1. Setup Accounts
    c_email = f"cust_h_{int(time.time())}@test.com"
    v_email = f"vend_h_{int(time.time())}@test.com"
    create_user(c_email, "password", "Test Customer")
    create_user(v_email, "password", "Test Vendor")
    
    # Verify directly in DB
    from app.db.session import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    db.execute(text("UPDATE users SET is_active = true, is_verified = true WHERE email IN (:c_email, :v_email)"), 
               {"c_email": c_email, "v_email": v_email})
    db.commit()
    
    c_token = login(c_email, "password")
    v_token = login(v_email, "password")
    
    c_headers = {"Authorization": f"Bearer {c_token}"}
    v_headers = {"Authorization": f"Bearer {v_token}"}
    
    # 2. Become Vendor & Create Listing
    res = requests.post(f"{BASE_URL}/vendors/become-host", json={
        "business_name": "Grand Palace Hall", "vendor_type": "manager"
    }, headers=v_headers)
    vendor_id = res.json()["id"]
    
    # Approve Vendor via Admin
    a_email = f"admin_h_{int(time.time())}@test.com"
    create_user(a_email, "password", "Admin User")
    db.execute(text("UPDATE users SET is_active = true, is_verified = true, is_admin = true, role = 'ADMIN' WHERE email = :a_email"), 
               {"a_email": a_email})
    db.commit()
    db.close()
    
    a_token = login(a_email, "password")
    a_headers = {"Authorization": f"Bearer {a_token}"}
    requests.post(f"{BASE_URL}/admin/verify-vendor", json={"vendor_id": vendor_id, "approve": True}, headers=a_headers)
    
    # Create Listing
    res = requests.post(f"{BASE_URL}/listings/", json={
        "title": "Grand Palace Hall", "description": "Beautiful events hall", "listing_type": "VENUE",
        "price": 10000.0, "location": "City Center", "details": {"capacity": 100}
    }, headers=v_headers)
    listing_id = res.json()["id"]
    
    # Publish Listing
    requests.put(f"{BASE_URL}/admin/listings/{listing_id}/status", json={"status": "PUBLISHED", "is_active": True}, headers=a_headers)
    
    # 3. Create Bookings & Simulate Payments
    print("\nSimulating Bookings and Payments...")
    
    # Booking 1: Customer registers, pays advance, gets refund
    res = requests.post(f"{BASE_URL}/bookings", json={
        "listing_id": listing_id, "event_date": "2027-05-01T10:00:00Z",
        "end_date": "2027-05-02T10:00:00Z", "special_request": "None"
    }, headers=c_headers)
    booking_id_1 = res.json()["id"]
    
    # Vendor approves
    requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id_1}", json={"status": "APPROVED"}, headers=v_headers)
    
    # Customer pays advance
    res = requests.post(f"{BASE_URL}/payments/create-order", json={"booking_id": booking_id_1, "payment_type": "ADVANCE"}, headers=c_headers)
    order_id_1 = res.json()["order_id"]
    requests.post(f"{BASE_URL}/payments/verify", json={
        "razorpay_order_id": order_id_1, "razorpay_payment_id": f"pay_adv_{int(time.time())}", "razorpay_signature": "simulated"
    }, headers=c_headers)
    
    # Vendor cancels
    res = requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id_1}", json={"status": "CANCELLED"}, headers=v_headers)
    print(f"Vendor Cancel Status: {res.status_code}, Response: {res.text}")
    
    # Booking 2: Customer registers, pays advance, completes booking (fully released)
    res = requests.post(f"{BASE_URL}/bookings", json={
        "listing_id": listing_id, "event_date": "2027-06-01T10:00:00Z",
        "end_date": "2027-06-02T10:00:00Z", "special_request": "None"
    }, headers=c_headers)
    booking_id_2 = res.json()["id"]
    print(f"Booking 2 ID: {booking_id_2}")
    
    res = requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id_2}", json={"status": "APPROVED"}, headers=v_headers)
    print(f"Booking 2 Approve Status: {res.status_code}")
    
    res = requests.post(f"{BASE_URL}/payments/create-order", json={"booking_id": booking_id_2, "payment_type": "ADVANCE"}, headers=c_headers)
    order_id_2 = res.json()["order_id"]
    res = requests.post(f"{BASE_URL}/payments/verify", json={
        "razorpay_order_id": order_id_2, "razorpay_payment_id": f"pay_adv_2_{int(time.time())}", "razorpay_signature": "simulated"
    }, headers=c_headers)
    print(f"Booking 2 Pay Advance Verify Status: {res.status_code}")
    
    # Call Vendor History endpoint
    print("\nCalling GET /api/v1/payments/vendor/history...")
    res = requests.get(f"{BASE_URL}/payments/vendor/history", headers=v_headers)
    
    if res.status_code == 200:
        print("✅ VENDOR API SUCCESS!")
        print_payload("Vendor Payment History JSON Response", res.json())
    else:
        print(f"❌ VENDOR API FAILED! Status: {res.status_code}, Response: {res.text}")

    # Call Customer History endpoint
    print("\nCalling GET /api/v1/payments/customer/history...")
    res = requests.get(f"{BASE_URL}/payments/customer/history", headers=c_headers)
    
    if res.status_code == 200:
        print("✅ CUSTOMER API SUCCESS!")
        print_payload("Customer Payment History JSON Response", res.json())
    else:
        print(f"❌ CUSTOMER API FAILED! Status: {res.status_code}, Response: {res.text}")

if __name__ == "__main__":
    main()
