#!/usr/bin/env python
"""
Add fcm_token and device_token columns to users table.
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
        WHERE table_name = 'users' AND column_name IN ('fcm_token', 'device_token')
    """)
    )
    existing_cols = [row[0] for row in result.fetchall()]

    if "fcm_token" not in existing_cols:
        db.execute(
            text("""
            ALTER TABLE users 
            ADD COLUMN fcm_token VARCHAR(512)
        """)
        )
        print("Added 'fcm_token' column")

    if "device_token" not in existing_cols:
        db.execute(
            text("""
            ALTER TABLE users 
            ADD COLUMN device_token VARCHAR(512)
        """)
        )
        print("Added 'device_token' column")

    # Add index on fcm_token
    try:
        db.execute(
            text("""
            CREATE INDEX IF NOT EXISTS ix_users_fcm_token 
            ON users(fcm_token)
        """)
        )
        print("Added index on fcm_token")
    except:
        pass

    db.commit()
    print("Database migration completed successfully!")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
