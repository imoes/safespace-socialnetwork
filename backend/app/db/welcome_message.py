"""Welcome Message Management für Admin"""

from typing import Optional
from app.db.postgres import get_db_connection


async def create_welcome_tables():
    """Erstellt die benötigten Tabellen für Welcome Messages"""
    async with get_db_connection() as conn:
        # Welcome Messages Tabelle
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS welcome_messages (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # User Tracking - wer hat die Nachricht gesehen
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_welcome_seen (
                uid INTEGER PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
                message_id INTEGER REFERENCES welcome_messages(id) ON DELETE CASCADE,
                seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await conn.commit()


async def get_active_welcome_message() -> Optional[dict]:
    """Holt die aktive Willkommensnachricht"""
    async with get_db_connection() as conn:
        result = await conn.execute("""
            SELECT id, title, content, created_at, updated_at
            FROM welcome_messages
            WHERE is_active = TRUE
            ORDER BY id DESC
            LIMIT 1
        """)
        row = await result.fetchone()
        if row:
            return {
                "id": row["id"],
                "title": row["title"],
                "content": row["content"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
            }
        return None


async def set_welcome_message(title: str, content: str) -> dict:
    """Setzt/Aktualisiert die Willkommensnachricht (deaktiviert alte, erstellt neue)"""
    async with get_db_connection() as conn:
        # Deaktiviere alle alten Nachrichten
        await conn.execute("UPDATE welcome_messages SET is_active = FALSE")

        # Erstelle neue Nachricht
        result = await conn.execute("""
            INSERT INTO welcome_messages (title, content, is_active)
            VALUES (%s, %s, TRUE)
            RETURNING id, title, content, created_at, updated_at
        """, (title, content))
        row = await result.fetchone()
        await conn.commit()

        return {
            "id": row["id"],
            "title": row["title"],
            "content": row["content"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
        }


async def delete_welcome_message() -> bool:
    """Löscht/Deaktiviert die aktive Willkommensnachricht"""
    async with get_db_connection() as conn:
        await conn.execute("UPDATE welcome_messages SET is_active = FALSE")
        await conn.commit()
        return True


async def has_user_seen_welcome(uid: int) -> bool:
    """Prüft, ob User die aktive Willkommensnachricht gesehen hat"""
    message = await get_active_welcome_message()
    if not message:
        return True  # Keine aktive Nachricht = als gesehen behandeln

    async with get_db_connection() as conn:
        result = await conn.execute("""
            SELECT 1 FROM user_welcome_seen
            WHERE uid = %s AND message_id = %s
        """, (uid, message["id"]))
        row = await result.fetchone()
        return row is not None


async def mark_welcome_seen(uid: int) -> bool:
    """Markiert die aktive Willkommensnachricht als gesehen für diesen User"""
    message = await get_active_welcome_message()
    if not message:
        return False

    async with get_db_connection() as conn:
        await conn.execute("""
            INSERT INTO user_welcome_seen (uid, message_id)
            VALUES (%s, %s)
            ON CONFLICT (uid) DO UPDATE SET
                message_id = EXCLUDED.message_id,
                seen_at = CURRENT_TIMESTAMP
        """, (uid, message["id"]))
        await conn.commit()
        return True


async def get_welcome_stats() -> dict:
    """Admin-Statistiken: Wie viele User haben die Nachricht gesehen"""
    message = await get_active_welcome_message()
    if not message:
        return {"total_users": 0, "seen_count": 0, "unseen_count": 0}

    async with get_db_connection() as conn:
        # Anzahl aller User
        result = await conn.execute("SELECT COUNT(*) as total FROM users WHERE role != 'admin'")
        total = (await result.fetchone())["total"]

        # Anzahl User die es gesehen haben
        result = await conn.execute("""
            SELECT COUNT(*) as seen FROM user_welcome_seen
            WHERE message_id = %s
        """, (message["id"],))
        seen = (await result.fetchone())["seen"]

        return {
            "message_id": message["id"],
            "total_users": total,
            "seen_count": seen,
            "unseen_count": total - seen
        }
