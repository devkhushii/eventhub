import requests
import uuid
import time
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def log_payload(step, response):
    print(f"\n{'='*50}\n[STEP] {step}")
    print(f"Status: {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)
    print(f"{'='*50}\n")

def simulate():
    # 1. Register User
    user_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "email": user_email,
        "password": "password123",
        "full_name": "Test User",
        "phone": "9999999999",
        "role": "customer"
    })
    
    if res.status_code != 200:
        print("Registration failed", res.text)
        # Maybe user exists, let's try login
    
    # Verify user directly in DB or use an existing one if possible
    # We will just login if it exists, or create. Let's assume register works.
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": user_email, "password": "password123"})
    user_token = res.json().get("access_token")

    # 2. Register Vendor
    vendor_email = f"vendor_{uuid.uuid4().hex[:8]}@example.com"
    requests.post(f"{BASE_URL}/auth/register", json={
        "email": vendor_email,
        "password": "password123",
        "full_name": "Test Vendor",
        "phone": "8888888888",
        "role": "vendor"
    })
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": vendor_email, "password": "password123"})
    vendor_token = res.json().get("access_token")

    # 3. Create Listing
    res = requests.post(f"{BASE_URL}/listings/", headers={"Authorization": f"Bearer {vendor_token}"}, json={
        "title": "Grand Hall",
        "description": "A grand hall for events",
        "price": 5000,
        "listing_type": "VENUE",
        "location": "Mumbai",
        "capacity": 500
    })
    if res.status_code != 200:
        print("Failed to create listing", res.text)
        return
    listing_id = res.json()["id"]

    # 4. Create Booking
    event_date = (datetime.now() + timedelta(days=10)).isoformat()
    res = requests.post(f"{BASE_URL}/bookings/", headers={"Authorization": f"Bearer {user_token}"}, json={
        "listing_id": listing_id,
        "event_date": event_date,
        "special_request": "Need vegetarian food"
    })
    if res.status_code != 200:
        print("Failed to create booking", res.text)
        return
    booking_id = res.json()["id"]

    # 5. Vendor Accepts Booking
    res = requests.put(f"{BASE_URL}/vendors/bookings/{booking_id}/status", headers={"Authorization": f"Bearer {vendor_token}"}, json={
        "status": "APPROVED"
    })
    if res.status_code != 200:
        print("Failed to approve booking", res.text)
        return

    # 6. User Pays Advance
    res = requests.post(f"{BASE_URL}/payments/create", headers={"Authorization": f"Bearer {user_token}"}, json={
        "booking_id": booking_id,
        "payment_type": "ADVANCE"
    })
    log_payload("Advance Payment Intent Created", res)
    if res.status_code != 200:
        return
    
    # We must mock Razorpay verify for this to work... Wait, Razorpay integration actually requires Razorpay test keys or mocking.
    print("Cannot complete payment without mocking razorpay signature or hitting DB directly.")

if __name__ == "__main__":
    simulate()
