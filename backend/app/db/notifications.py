"""Notifications System für User-Benachrichtigungen"""

from typing import List, Optional
from datetime import datetime
from app.db.postgres import PostgresDB


async def create_notifications_table():
    """Erstellt die Notifications-Tabelle"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                notification_id SERIAL PRIMARY KEY,
                user_uid INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                actor_uid INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                post_id INTEGER,
                post_author_uid INTEGER,
                comment_id INTEGER,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user
            ON notifications(user_uid, is_read, created_at DESC)
        """)

        await conn.commit()


async def create_notification(
    user_uid: int,
    actor_uid: int,
    notification_type: str,
    post_id: Optional[int] = None,
    post_author_uid: Optional[int] = None,
    comment_id: Optional[int] = None
) -> dict:
    """
    Erstellt eine neue Benachrichtigung

    Types:
    - 'post_liked': Jemand hat deinen Post geliked
    - 'post_commented': Jemand hat deinen Post kommentiert
    - 'comment_liked': Jemand hat deinen Kommentar geliked
    """
    # Erstelle keine Benachrichtigung wenn User sich selbst liked/kommentiert
    if user_uid == actor_uid:
        return None

    async with PostgresDB.connection() as conn:
        result = await conn.execute("""
            INSERT INTO notifications (user_uid, actor_uid, type, post_id, post_author_uid, comment_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING notification_id, user_uid, actor_uid, type, post_id, post_author_uid, comment_id, is_read, created_at
        """, (user_uid, actor_uid, notification_type, post_id, post_author_uid, comment_id))
        row = await result.fetchone()
        await conn.commit()

        if row:
            notification = {
                "notification_id": row["notification_id"],
                "user_uid": row["user_uid"],
                "actor_uid": row["actor_uid"],
                "type": row["type"],
                "post_id": row["post_id"],
                "post_author_uid": row["post_author_uid"],
                "comment_id": row["comment_id"],
                "is_read": row["is_read"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            }

            # E-Mail-Benachrichtigung versenden (async, fire and forget)
            try:
                from app.services.email_service import EmailService
                import asyncio

                # User-Daten für E-Mail abrufen
                user_result = await conn.execute("""
                    SELECT u1.username as to_username, u1.email as to_email,
                           u2.username as actor_username
                    FROM users u1
                    JOIN users u2 ON u2.uid = %s
                    WHERE u1.uid = %s
                """, (actor_uid, user_uid))
                user_row = await user_result.fetchone()

                if user_row and user_row["to_email"]:
                    # Hintergrund-Task für E-Mail-Versand
                    asyncio.create_task(
                        EmailService.send_notification_email(
                            to_email=user_row["to_email"],
                            to_username=user_row["to_username"],
                            actor_username=user_row["actor_username"],
                            notification_type=notification_type,
                            post_id=post_id,
                            comment_id=comment_id
                        )
                    )
            except Exception as e:
                # E-Mail-Fehler sollen Notification nicht blockieren
                print(f"⚠️ Failed to send notification email: {e}")

            return notification
        return None


async def get_notifications(user_uid: int, limit: int = 50, offset: int = 0, unread_only: bool = False) -> List[dict]:
    """Holt alle Benachrichtigungen eines Users mit Actor-Info"""
    async with PostgresDB.connection() as conn:
        query = """
            SELECT
                n.notification_id,
                n.user_uid,
                n.actor_uid,
                n.type,
                n.post_id,
                n.post_author_uid,
                n.comment_id,
                n.is_read,
                n.created_at,
                u.username as actor_username,
                u.profile_picture as actor_profile_picture
            FROM notifications n
            JOIN users u ON n.actor_uid = u.uid
            WHERE n.user_uid = %s
        """

        params = [user_uid]

        if unread_only:
            query += " AND n.is_read = FALSE"

        query += " ORDER BY n.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        result = await conn.execute(query, tuple(params))

        notifications = []
        async for row in result:
            notifications.append({
                "notification_id": row["notification_id"],
                "user_uid": row["user_uid"],
                "actor_uid": row["actor_uid"],
                "actor_username": row["actor_username"],
                "actor_profile_picture": row["actor_profile_picture"],
                "type": row["type"],
                "post_id": row["post_id"],
                "post_author_uid": row["post_author_uid"],
                "comment_id": row["comment_id"],
                "is_read": row["is_read"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            })

        return notifications


async def get_unread_count(user_uid: int) -> int:
    """Gibt die Anzahl ungelesener Benachrichtigungen zurück"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute("""
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_uid = %s AND is_read = FALSE
        """, (user_uid,))
        row = await result.fetchone()
        return row["count"] if row else 0


async def mark_notification_as_read(notification_id: int, user_uid: int) -> bool:
    """Markiert eine Benachrichtigung als gelesen"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE notification_id = %s AND user_uid = %s
        """, (notification_id, user_uid))
        await conn.commit()
        return True


async def mark_all_as_read(user_uid: int) -> bool:
    """Markiert alle Benachrichtigungen eines Users als gelesen"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_uid = %s AND is_read = FALSE
        """, (user_uid,))
        await conn.commit()
        return True


async def delete_notification(notification_id: int, user_uid: int) -> bool:
    """Löscht eine Benachrichtigung"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            DELETE FROM notifications
            WHERE notification_id = %s AND user_uid = %s
        """, (notification_id, user_uid))
        await conn.commit()
        return True
