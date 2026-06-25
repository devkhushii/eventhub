import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

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
    c_email = f"c_net_{int(time.time())}@test.com"
    v_email = f"v_net_{int(time.time())}@test.com"
    a_email = f"a_net_{int(time.time())}@test.com"
    create_user(c_email, "password123", "Cust")
    create_user(v_email, "password123", "Vend")
    create_user(a_email, "password123", "Admin")
    
    from app.db.session import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    db.execute(text("UPDATE users SET is_active = true, is_verified = true WHERE email IN (:c, :v)"), {"c": c_email, "v": v_email})
    db.execute(text("UPDATE users SET is_active = true, is_verified = true, is_admin = true, role = 'ADMIN' WHERE email = :a"), {"a": a_email})
    db.commit()
    
    c_tok = login(c_email, "password123")
    v_tok = login(v_email, "password123")
    a_tok = login(a_email, "password123")
    
    c_hdr = {"Authorization": f"Bearer {c_tok}"}
    v_hdr = {"Authorization": f"Bearer {v_tok}"}
    a_hdr = {"Authorization": f"Bearer {a_tok}"}
    
    res = requests.post(f"{BASE_URL}/vendors/become-host", json={"business_name": "Test", "vendor_type": "manager"}, headers=v_hdr)
    vid = res.json()["id"]
    requests.post(f"{BASE_URL}/admin/verify-vendor", json={"vendor_id": vid, "approve": True}, headers=a_hdr)
    
    res = requests.post(f"{BASE_URL}/listings/", json={
        "title": "Hall", "description": "Desc", "listing_type": "VENUE",
        "price": 1000.0, "location": "Loc", "details": {"capacity": 100}
    }, headers=v_hdr)
    lid = res.json()["id"]
    requests.put(f"{BASE_URL}/admin/listings/{lid}/status", json={"status": "PUBLISHED", "is_active": True}, headers=a_hdr)
    
    res = requests.post(f"{BASE_URL}/bookings", json={"listing_id": lid, "event_date": "2027-01-01T10:00:00Z", "end_date": "2027-01-02T10:00:00Z", "special_request": "None"}, headers=c_hdr)
    bid = res.json()["id"]
    
    requests.patch(f"{BASE_URL}/vendors/bookings/{bid}", json={"status": "APPROVED"}, headers=v_hdr)
    
    # AWAITING_ADVANCE state
    print("\n--- EXACT NETWORK RESPONSE (AWAITING_ADVANCE) ---")
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_hdr)
    print(json.dumps([b for b in res.json() if b["id"] == bid][0], indent=2))
    
    # Pay
    res = requests.post(f"{BASE_URL}/payments/create-order", json={"booking_id": bid, "payment_type": "ADVANCE"}, headers=c_hdr)
    oid = res.json()["order_id"]
    requests.post(f"{BASE_URL}/payments/verify", json={"razorpay_order_id": oid, "razorpay_payment_id": f"pay_{int(time.time())}", "razorpay_signature": "simulated_signature"}, headers=c_hdr)
    
    # CONFIRMED state
    print("\n--- EXACT NETWORK RESPONSE AFTER PAYMENT ---")
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_hdr)
    print(json.dumps([b for b in res.json() if b["id"] == bid][0], indent=2))

if __name__ == "__main__":
    main()
