#!/usr/bin/env python
"""
Add currency column to payments table.
"""

from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    # Check if column already exists
    result = db.execute(
        text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'currency'
    """)
    )

    if result.fetchone():
        print("Column 'currency' already exists in payments table")
    else:
        # Add the column
        db.execute(
            text("""
            ALTER TABLE payments 
            ADD COLUMN currency VARCHAR(3) DEFAULT 'INR' NOT NULL
        """)
        )
        db.commit()
        print("Successfully added 'currency' column to payments table")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
