#!/usr/bin/env python
"""
Add type and reference_id columns to notifications table.
"""

from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    # Check if columns already exist
    result = db.execute(
        text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name IN ('type', 'reference_id')
    """)
    )
    existing_cols = [row[0] for row in result.fetchall()]

    if "type" not in existing_cols:
        db.execute(
            text("""
            ALTER TABLE notifications 
            ADD COLUMN type VARCHAR(20) DEFAULT 'SYSTEM' NOT NULL
        """)
        )
        print("Added 'type' column")

    if "reference_id" not in existing_cols:
        db.execute(
            text("""
            ALTER TABLE notifications 
            ADD COLUMN reference_id UUID
        """)
        )
        print("Added 'reference_id' column")

    # Add index on reference_id
    try:
        db.execute(
            text("""
            CREATE INDEX IF NOT EXISTS ix_notifications_reference_id 
            ON notifications(reference_id)
        """)
        )
        print("Added index on reference_id")
    except:
        pass

    db.commit()
    print("Database migration completed successfully!")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
