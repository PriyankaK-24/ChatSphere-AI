
import sqlite3
from pathlib import Path

DB_PATH = Path("chatsphere.db")
NEW_OWNER_ID = 2

if not DB_PATH.exists():
    raise FileNotFoundError("chatsphere.db not found")

conn = sqlite3.connect(DB_PATH)

try:
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.execute("BEGIN")

    # Verify the destination account exists.
    user = conn.execute(
        "SELECT id FROM users WHERE id = ?",
        (NEW_OWNER_ID,),
    ).fetchone()

    if not user:
        raise RuntimeError("Destination user ID does not exist")

    # Add ownership to existing tables.
    conn.execute("""
        ALTER TABLE conversations
        ADD COLUMN owner_id INTEGER REFERENCES users(id)
    """)

    conn.execute("""
        ALTER TABLE memories
        ADD COLUMN owner_id INTEGER REFERENCES users(id)
    """)

    conn.execute("""
        CREATE TABLE user_settings_new (
            id INTEGER NOT NULL PRIMARY KEY,
            user_id INTEGER UNIQUE REFERENCES users(id),
            memory_enabled BOOLEAN NOT NULL DEFAULT 1,
            speak_responses BOOLEAN NOT NULL DEFAULT 0
        )
    """)

    conn.execute("""
        INSERT INTO user_settings_new
        (id, user_id, memory_enabled, speak_responses)
        SELECT id, ?, memory_enabled, speak_responses
        FROM user_settings
    """, (NEW_OWNER_ID,))

    conn.execute("DROP TABLE user_settings")
    conn.execute("ALTER TABLE user_settings_new RENAME TO user_settings")

    # Transfer existing data to the real account.
    conn.execute(
        "UPDATE conversations SET owner_id = ?",
        (NEW_OWNER_ID,),
    )

    conn.execute(
        "UPDATE memories SET owner_id = ?",
        (NEW_OWNER_ID,),
    )

    conn.execute("COMMIT")

    print("Migration completed successfully!")
    print("Conversations:", conn.execute(
        "SELECT COUNT(*) FROM conversations WHERE owner_id = ?",
        (NEW_OWNER_ID,),
    ).fetchone()[0])
    print("Memories:", conn.execute(
        "SELECT COUNT(*) FROM memories WHERE owner_id = ?",
        (NEW_OWNER_ID,),
    ).fetchone()[0])
    print("Settings:", conn.execute(
        "SELECT COUNT(*) FROM user_settings WHERE user_id = ?",
        (NEW_OWNER_ID,),
    ).fetchone()[0])

except Exception:
    conn.rollback()
    raise

finally:
    conn.close()