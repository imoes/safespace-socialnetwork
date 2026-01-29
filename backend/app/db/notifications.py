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
                group_id INTEGER,
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
    comment_id: Optional[int] = None,
    comment_content: Optional[str] = None,
    birthday_age: Optional[int] = None,
    group_id: Optional[int] = None,
    group_name: Optional[str] = None
) -> dict:
    """
    Erstellt eine neue Benachrichtigung

    Types:
    - 'post_liked': Jemand hat deinen Post geliked
    - 'post_commented': Jemand hat deinen Post kommentiert
    - 'comment_liked': Jemand hat deinen Kommentar geliked
    - 'group_post': Jemand hat in deiner Gruppe gepostet
    - 'group_join_request': Jemand möchte deiner Gruppe beitreten
    - 'birthday': Ein Freund hat heute Geburtstag
    - 'welcome': Willkommens-Benachrichtigung für neue User
    """
    # Erstelle keine Benachrichtigung wenn User sich selbst liked/kommentiert
    # (Ausnahme: welcome-Benachrichtigung)
    if user_uid == actor_uid and notification_type != "welcome":
        return None

    async with PostgresDB.connection() as conn:
        result = await conn.execute("""
            INSERT INTO notifications (user_uid, actor_uid, type, post_id, post_author_uid, comment_id, group_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING notification_id, user_uid, actor_uid, type, post_id, post_author_uid, comment_id, group_id, is_read, created_at
        """, (user_uid, actor_uid, notification_type, post_id, post_author_uid, comment_id, group_id))
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
                "group_id": row["group_id"],
                "is_read": row["is_read"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            }

            # E-Mail-Benachrichtigung versenden (async, fire and forget)
            try:
                from app.services.email_service import EmailService
                import asyncio

                # User-Daten für E-Mail abrufen (inkl. Preferences und Sprache)
                user_result = await conn.execute("""
                    SELECT u1.username as to_username, u1.email as to_email,
                           u1.notification_preferences as prefs,
                           u1.preferred_language as language,
                           u2.username as actor_username
                    FROM users u1
                    JOIN users u2 ON u2.uid = %s
                    WHERE u1.uid = %s
                """, (actor_uid, user_uid))
                user_row = await user_result.fetchone()

                if user_row and user_row["to_email"]:
                    # Prüfe ob User diese Benachrichtigung per E-Mail erhalten möchte
                    prefs = user_row.get("prefs") or {}
                    email_enabled = prefs.get(notification_type, True)  # Default: aktiviert

                    if email_enabled:
                        # Post-Inhalt laden falls vorhanden
                        post_content = None
                        if post_id and post_author_uid:
                            try:
                                from app.db.sqlite_posts import UserPostsDB
                                posts_db = UserPostsDB(post_author_uid)
                                post = await posts_db.get_post(post_id)
                                if post:
                                    post_content = post.get("content")
                            except Exception as e:
                                print(f"⚠️ Failed to load post content for email: {e}")

                        user_language = user_row.get("language") or "de"

                        # Hintergrund-Task für E-Mail-Versand
                        asyncio.create_task(
                            EmailService.send_notification_email(
                                to_email=user_row["to_email"],
                                to_username=user_row["to_username"],
                                actor_username=user_row["actor_username"],
                                notification_type=notification_type,
                                post_id=post_id,
                                post_author_uid=post_author_uid,
                                comment_id=comment_id,
                                post_content=post_content,
                                comment_content=comment_content,
                                birthday_age=birthday_age,
                                user_language=user_language,
                                group_id=group_id,
                                group_name=group_name
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
                n.group_id,
                n.is_read,
                n.created_at,
                u.username as actor_username,
                u.profile_picture as actor_profile_picture,
                g.name as group_name
            FROM notifications n
            JOIN users u ON n.actor_uid = u.uid
            LEFT JOIN groups g ON n.group_id = g.group_id
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
                "group_id": row["group_id"],
                "group_name": row["group_name"],
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
