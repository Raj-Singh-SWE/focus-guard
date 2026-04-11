"""
One-time migration: add user_email column to driving_sessions table if missing.
Run: python fix.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "focusdrive_v2.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if column already exists
    cursor.execute("PRAGMA table_info(driving_sessions)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "user_email" not in columns:
        cursor.execute("ALTER TABLE driving_sessions ADD COLUMN user_email TEXT")
        print("✅ Added 'user_email' column to driving_sessions table.")
    else:
        print("ℹ️  Column 'user_email' already exists. No changes needed.")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
