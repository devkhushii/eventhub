import sys

sys.path.insert(0, ".")

from sqlalchemy import text
from app.db.session import SessionLocal

db = SessionLocal()

result = db.execute(
    text("""
    SELECT id, status, total_price, user_id 
    FROM bookings 
    WHERE status IN ('AWAITING_ADVANCE', 'AWAITING_FINAL_PAYMENT', 'CONFIRMED')
    LIMIT 5
""")
)
rows = result.fetchall()

print("Bookings available for payment testing:")
for row in rows:
    print(f"  ID: {row[0]}")
    print(f"  Status: {row[1]}")
    print(f"  Total: {row[2]}")
    print("---")

if not rows:
    print("No bookings in payment-pending states")

db.close()
