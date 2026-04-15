#!/usr/bin/env python
from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Add new enum values to booking_status
try:
    db.execute(text("ALTER TYPE bookingstatus ADD VALUE 'AWAITING_ADVANCE'"))
    print("Added AWAITING_ADVANCE")
except Exception as e:
    print(f"Add AWAITING_ADVANCE: {e}")

try:
    db.execute(text("ALTER TYPE bookingstatus ADD VALUE 'AWAITING_FINAL_PAYMENT'"))
    print("Added AWAITING_FINAL_PAYMENT")
except Exception as e:
    print(f"Add AWAITING_FINAL_PAYMENT: {e}")

db.commit()
print("Done")
db.close()
