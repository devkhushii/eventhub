import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def print_payload(name, data):
    print(f"\n{'='*50}\nPAYLOAD: {name}\n{'='*50}")
    print(json.dumps(data, indent=2))

def create_user(email, password, full_name, role="user"):
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email, "password": password, "full_name": full_name
    })
    try:
        return res.json()
    except Exception:
        print(f"Error registering user. Status: {res.status_code}, Text: {res.text}")
        raise

def login(email, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email, "password": password
    })
    data = res.json()
    if "access_token" not in data:
        print(f"Login failed: {res.status_code} {res.text}")
    return data["access_token"]

def main():
    print("Running Verification Flow...")
    
    # 1. Setup Accounts
    c_email = f"cust_{int(time.time())}@test.com"
    v_email = f"vend_{int(time.time())}@test.com"
    create_user(c_email, "password", "Test Customer")
    create_user(v_email, "password", "Test Vendor")
    
    # Bypass email verification directly in the DB using raw SQL
    from app.db.session import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    db.execute(text("UPDATE users SET is_active = true, is_verified = true WHERE email IN (:c_email, :v_email)"), 
               {"c_email": c_email, "v_email": v_email})
    db.commit()
    db.close()
    
    c_token = login(c_email, "password")
    v_token = login(v_email, "password")
    
    c_headers = {"Authorization": f"Bearer {c_token}"}
    v_headers = {"Authorization": f"Bearer {v_token}"}
    
    # 2. Become Vendor & Create Listing
    res = requests.post(f"{BASE_URL}/vendors/become-host", json={
        "business_name": "Test Events", "vendor_type": "manager"
    }, headers=v_headers)
    vendor_id = res.json()["id"]
    
    # Approve Vendor via Admin API
    a_email = f"admin_{int(time.time())}@test.com"
    create_user(a_email, "password", "Admin User")
    db = SessionLocal()
    db.execute(text("UPDATE users SET is_active = true, is_verified = true, is_admin = true, role = 'ADMIN' WHERE email = :a_email"), 
               {"a_email": a_email})
    db.commit()
    db.close()
    
    a_token = login(a_email, "password")
    a_headers = {"Authorization": f"Bearer {a_token}"}
    res_verify = requests.post(f"{BASE_URL}/admin/verify-vendor", json={
        "vendor_id": vendor_id, "approve": True
    }, headers=a_headers)
    print(f"Verify Vendor response: {res_verify.status_code} {res_verify.text}")
    
    res = requests.post(f"{BASE_URL}/listings/", json={
        "title": "Party Hall", "description": "A nice hall", "listing_type": "VENUE",
        "price": 10000.0, "location": "City Center", "details": {"capacity": 100}
    }, headers=v_headers)
    data = res.json()
    if "id" not in data:
        print(f"Failed to create listing: {res.text}")
        raise ValueError("Failed to create listing")
    listing_id = data["id"]
    
    res_pub = requests.put(f"{BASE_URL}/admin/listings/{listing_id}/status", json={"status": "PUBLISHED", "is_active": True}, headers=a_headers)
    if res_pub.status_code != 200:
        print(f"Failed to publish listing: {res_pub.status_code} {res_pub.text}")
    
    # --- FLOW 1: CUSTOMER CANCELLATION & REFUND ---
    print("\n--- FLOW 1: CUSTOMER CANCELLATION ---")
    
    res = requests.post(f"{BASE_URL}/bookings", json={
        "listing_id": listing_id, "event_date": "2027-01-01T10:00:00Z",
        "end_date": "2027-01-02T10:00:00Z", "special_request": "None"
    }, headers=c_headers)
    data = res.json()
    if "id" not in data:
        print(f"Failed to create booking: {res.status_code} {res.text}")
        raise ValueError("Failed to create booking")
    booking_id = data["id"]
    
    # Vendor accepts
    requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id}", json={"status": "APPROVED"}, headers=v_headers)
    
    # Fetch AWAITING_ADVANCE payload
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_headers)
    booking = [b for b in res.json() if b["id"] == booking_id][0]
    print_payload("1. AWAITING_ADVANCE", booking)
    
    # Customer pays advance (simulate via payment endpoint)
    res = requests.post(f"{BASE_URL}/payments/create-order", json={
        "booking_id": booking_id, "payment_type": "ADVANCE"
    }, headers=c_headers)
    payment_info = res.json()
    if "order_id" not in payment_info:
        print(f"Failed to create payment order: {res.status_code} {res.text}")
        raise ValueError("Failed to create payment order")
    order_id = payment_info["order_id"]
    
    # Verify payment (simulation mode should bypass signature)
    res = requests.post(f"{BASE_URL}/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": f"pay_{int(time.time())}",
        "razorpay_signature": "simulated_signature"
    }, headers=c_headers)
    
    # Fetch CONFIRMED payload
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_headers)
    booking = [b for b in res.json() if b["id"] == booking_id][0]
    print_payload("2. CONFIRMED (Advance Paid)", booking)
    
    # Customer requests cancellation
    requests.patch(f"{BASE_URL}/bookings/{booking_id}", json={"status": "CANCELLATION_REQUESTED"}, headers=c_headers)
    
    # Fetch CANCELLATION_REQUESTED payload
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_headers)
    booking = [b for b in res.json() if b["id"] == booking_id][0]
    print_payload("3. CANCELLATION_REQUESTED", booking)
    
    # Vendor approves 70% refund
    res = requests.post(f"{BASE_URL}/vendors/bookings/{booking_id}/refund", headers=v_headers)
    refund_payload = res.json()
    print_payload("4. REFUND_SUCCESS (70% Refund Response)", refund_payload)
    
    # Assert conservation of money for customer cancellation
    c_paid = refund_payload["customer_paid"]
    r_amount = refund_payload["refunded_amount"]
    p_comm = refund_payload["platform_commission"]
    v_earn = refund_payload["vendor_final_earnings"]
    
    assert c_paid == r_amount + p_comm + v_earn, f"Accounting mismatch! {c_paid} != {r_amount} + {p_comm} + {v_earn}"
    print("✅ Customer Cancellation Accounting Validated Successfully!")
    
    # Fetch CANCELLED payload
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_headers)
    booking = [b for b in res.json() if b["id"] == booking_id][0]
    print_payload("5. CANCELLED", booking)

    print("\n--- FLOW 2: VENDOR CANCELLATION ---")
    # Customer creates a new booking
    res = requests.post(f"{BASE_URL}/bookings", json={
        "listing_id": listing_id, "event_date": "2027-02-01T10:00:00Z",
        "end_date": "2027-02-02T10:00:00Z", "special_request": "None"
    }, headers=c_headers)
    booking_id_2 = res.json()["id"]

    # Vendor approves booking
    res = requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id_2}", json={"status": "APPROVED"}, headers=v_headers)
    if res.status_code != 200:
        print(f"Failed to approve booking 2: {res.status_code} {res.text}")
        raise ValueError("Failed to approve booking 2")

    # Customer pays advance
    res = requests.post(f"{BASE_URL}/payments/create-order", json={
        "booking_id": booking_id_2, "payment_type": "ADVANCE"
    }, headers=c_headers)
    payment_info_2 = res.json()
    if "order_id" not in payment_info_2:
        print(f"Failed to create payment order 2: {res.status_code} {res.text}")
        raise ValueError("Failed to create payment order 2")
    order_id_2 = payment_info_2["order_id"]
    
    res = requests.post(f"{BASE_URL}/payments/verify", json={
        "razorpay_order_id": order_id_2,
        "razorpay_payment_id": f"pay_{int(time.time())}",
        "razorpay_signature": "simulated_signature"
    }, headers=c_headers)

    # Vendor cancels the booking
    res = requests.patch(f"{BASE_URL}/vendors/bookings/{booking_id_2}", json={"status": "CANCELLED"}, headers=v_headers)
    vendor_cancel_payload = res.json()
    
    # Fetch CANCELLED payload to check payment details for vendor cancellation
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_headers)
    booking_2 = [b for b in res.json() if b["id"] == booking_id_2][0]
    
    adv_payment_2 = [p for p in booking_2["payments"] if p["payment_type"] == "ADVANCE"][0]
    
    # Assert conservation of money for vendor cancellation
    c_paid_2 = adv_payment_2["amount"]
    r_amount_2 = adv_payment_2["refunded_amount"]
    p_comm_2 = adv_payment_2["escrow_amount"]
    v_earn_2 = adv_payment_2["vendor_released_amount"]
    
    print(f"\nVendor Cancel Settlement: paid={c_paid_2}, refunded={r_amount_2}, comm={p_comm_2}, vendor={v_earn_2}")
    assert c_paid_2 == r_amount_2 + p_comm_2 + v_earn_2, f"Accounting mismatch! {c_paid_2} != {r_amount_2} + {p_comm_2} + {v_earn_2}"
    assert r_amount_2 == c_paid_2, "Vendor cancel should trigger 100% refund!"
    assert p_comm_2 == 0, "Vendor cancel should yield 0 platform commission!"
    assert v_earn_2 == 0, "Vendor cancel should yield 0 vendor earnings!"
    
    print("✅ Vendor Cancellation Accounting Validated Successfully!")

    print("\nCheck the docker logs for the notification, expiry, and detailed refund logs.")

if __name__ == "__main__":
    main()
