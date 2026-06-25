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
    print("Running Proof Flow...")
    
    c_email = f"c_{int(time.time())}@test.com"
    v_email = f"v_{int(time.time())}@test.com"
    a_email = f"a_{int(time.time())}@test.com"
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
    
    # Vendor setup
    res = requests.post(f"{BASE_URL}/vendors/become-host", json={"business_name": "Test", "vendor_type": "manager"}, headers=v_hdr)
    vid = res.json()["id"]
    requests.post(f"{BASE_URL}/admin/verify-vendor", json={"vendor_id": vid, "approve": True}, headers=a_hdr)
    
    res = requests.post(f"{BASE_URL}/listings/", json={
        "title": "Hall", "description": "Desc", "listing_type": "VENUE",
        "price": 1000.0, "location": "Loc", "details": {"capacity": 100}
    }, headers=v_hdr)
    lid = res.json()["id"]
    requests.put(f"{BASE_URL}/admin/listings/{lid}/status", json={"status": "PUBLISHED", "is_active": True}, headers=a_hdr)
    
    # Booking creation
    res = requests.post(f"{BASE_URL}/bookings", json={"listing_id": lid, "event_date": "2027-01-01T10:00:00Z", "end_date": "2027-01-02T10:00:00Z", "special_request": "None"}, headers=c_hdr)
    bid = res.json()["id"]
    
    # Check notifications after booking creation
    db.commit()
    notifs = db.execute(text("SELECT type, title, message FROM notifications WHERE reference_id = :bid ORDER BY created_at DESC LIMIT 2"), {"bid": bid}).fetchall()
    print_payload("NOTIFICATIONS AFTER CREATION", [{"type": n[0], "title": n[1], "message": n[2]} for n in notifs])
    
    # Vendor approves
    requests.patch(f"{BASE_URL}/vendors/bookings/{bid}", json={"status": "APPROVED"}, headers=v_hdr)
    notifs = db.execute(text("SELECT type, title, message FROM notifications WHERE reference_id = :bid ORDER BY created_at DESC LIMIT 2"), {"bid": bid}).fetchall()
    print_payload("NOTIFICATIONS AFTER APPROVAL", [{"type": n[0], "title": n[1], "message": n[2]} for n in notifs])
    
    # Advance Payment
    res = requests.post(f"{BASE_URL}/payments/create-order", json={"booking_id": bid, "payment_type": "ADVANCE"}, headers=c_hdr)
    oid = res.json()["order_id"]
    requests.post(f"{BASE_URL}/payments/verify", json={"razorpay_order_id": oid, "razorpay_payment_id": f"pay_{int(time.time())}", "razorpay_signature": "simulated_signature"}, headers=c_hdr)
    
    # Check notifications after advance payment
    notifs = db.execute(text("SELECT type, title, message FROM notifications WHERE reference_id = :bid ORDER BY created_at DESC LIMIT 4"), {"bid": bid}).fetchall()
    print_payload("NOTIFICATIONS AFTER ADVANCE PAYMENT", [{"type": n[0], "title": n[1], "message": n[2]} for n in notifs])
    
    # Cancel request
    requests.patch(f"{BASE_URL}/bookings/{bid}", json={"status": "CANCELLATION_REQUESTED"}, headers=c_hdr)
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_hdr)
    booking = [b for b in res.json() if b["id"] == bid][0]
    print_payload("BOOKING STATUS BEFORE REFUND", {"status": booking["status"]})
    print_payload("PAYMENT STATUS BEFORE REFUND", [{"id": p["id"], "status": p["status"], "refunded": p["refunded_amount"]} for p in booking["payments"]])
    
    # Attempt refund
    res = requests.post(f"{BASE_URL}/vendors/bookings/{bid}/refund", headers=v_hdr)
    print_payload("REFUND API RESPONSE", {"status_code": res.status_code, "text": res.text})
    
    res = requests.get(f"{BASE_URL}/bookings/my", headers=c_hdr)
    booking = [b for b in res.json() if b["id"] == bid][0]
    print_payload("BOOKING STATUS AFTER REFUND FAILURE", {"status": booking["status"]})
    print_payload("PAYMENT STATUS AFTER REFUND FAILURE", [{"id": p["id"], "status": p["status"], "refunded": p["refunded_amount"]} for p in booking["payments"]])
    
    db.close()

if __name__ == "__main__":
    main()
