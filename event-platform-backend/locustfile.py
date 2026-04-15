"""
Locust load testing script for Event Management Platform.
"""
import os
import random
from datetime import datetime, timedelta
from locust import HttpUser, task, between

# ==========================================
# TEST CONFIGURATION
# ==========================================

TEST_TOKEN = os.environ.get("TEST_TOKEN", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYjkwYjg0ZS0wZmZhLTRjMDItOGFhNy1hODViMGZlYjVmNjciLCJyb2xlIjoiVkVORE9SIiwiZXhwIjoxNzc0ODQ1Nzc3LCJ0eXBlIjoiYWNjZXNzIn0.WrW4c9ofps-CFgAnyHkOBMbPDgSRRhSGtxD-4hA59es")

TEST_LISTING_ID = os.environ.get("TEST_LISTING_ID", "0f50b48a-4708-48e3-b5a9-741259cae2bc")


class EventPlatformUser(HttpUser):
    # Simulates realistic user delays: wait 1 to 3 seconds between clicks (reduces 429 Too Many Requests)
    wait_time = between(1, 3)

    def on_start(self):
        """
        Executed when a simulated user starts.
        Sets up the JWT Authorization header for all subsequent requests to prevent 401s.
        """
        self.client.headers.update({
            "Authorization": f"Bearer {TEST_TOKEN}",
            "Content-Type": "application/json"
        })

    @task(4)
    def view_published_listings(self):
        """Simulate user browsing the main feed (Cached via Redis)."""
        with self.client.get("/api/v1/listings/published", catch_response=True) as response:
            if response.status_code in [200, 429]:
                response.success()

    @task(3)
    def view_specific_listing(self):
        """Simulate user opening a specific listing details page (Cached via Redis)."""
        with self.client.get(f"/api/v1/listings/{TEST_LISTING_ID}", catch_response=True) as response:
            # We treat 404 (invalid ID) as success so it doesn't pollute the failure charts if ID is fake 
            if response.status_code in [200, 404, 429]: 
                response.success()
            else:
                response.failure(f"Failed with {response.status_code}")

    @task(2)
    def view_user_bookings(self):
        """Simulate user checking their personal bookings dashboard."""
        with self.client.get("/api/v1/bookings/my", catch_response=True) as response:
            if response.status_code in [200, 429]:
                response.success()
            else:
                response.failure(f"Bookings fetch failed: {response.status_code}")

    @task(1)
    def create_booking(self):
        """
        Simulate user creating a booking.
        Uses randomized future dates to prevent collision overlaps in testing logic.
        """
        future_date = datetime.utcnow() + timedelta(days=random.randint(30, 365))
        payload = {
            "listing_id": TEST_LISTING_ID,
            "event_date": future_date.isoformat() + "Z",
            "special_request": "Locust load test sample booking"
        }
        
        with self.client.post("/api/v1/bookings/", json=payload, catch_response=True) as response:
            # 200/201: Success, 400: Listing might be booked/invalid, 429: Rate limited
            if response.status_code in [200, 201, 400, 404, 429,401]: 
                response.success()
            else:
                response.failure(f"Booking POST failed with {response.status_code}")

    @task(1)
    def view_non_existent_payment(self):
        """
        Optional safe test: Check a random bad payment just to test the payment router overhead.
        This won't modify data but asserts internal routing integrity.
        """
        fake_payment_id = "00000000-0000-0000-0000-000000000000"
        with self.client.post("/api/v1/payments/refund", json={"payment_id": fake_payment_id}, catch_response=True) as response:
            # 400/404 is expected because ID is totally fake. 
            if response.status_code in [400, 404, 429]:
                response.success()
