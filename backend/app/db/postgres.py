import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from datetime import datetime, timedelta

from app.config import settings


class PostgresDB:
    _pool: AsyncConnectionPool | None = None
    
    @classmethod
    async def init_pool(cls):
        """Initialisiert den Connection Pool beim App-Start"""
        cls._pool = AsyncConnectionPool(
            conninfo=settings.postgres_dsn,
            min_size=5,
            max_size=20,
            kwargs={"row_factory": dict_row}
        )
        await cls._pool.open()
        await cls._init_schema()
    
    @classmethod
    async def close_pool(cls):
        """Schließt den Pool beim App-Shutdown"""
        if cls._pool:
            await cls._pool.close()
    
    @classmethod
    @asynccontextmanager
    async def connection(cls) -> AsyncGenerator[psycopg.AsyncConnection, None]:
        """Context Manager für Datenbankverbindungen"""
        async with cls._pool.connection() as conn:
            yield conn
    
    @classmethod
    async def _init_schema(cls):
        """Erstellt die Tabellen falls nicht vorhanden"""
        async with cls.connection() as conn:
            # Users mit Rollen
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    uid SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'user',
                    bio TEXT,
                    is_banned BOOLEAN DEFAULT FALSE,
                    banned_until TIMESTAMP,
                    ban_reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    profile_picture TEXT,
                    first_name VARCHAR(100),
                    last_name VARCHAR(100)
                )
            """)

            # Migrations: Add columns if they don't exist
            await conn.execute("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS profile_picture TEXT
            """)

            await conn.execute("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)
            """)

            await conn.execute("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)
            """)
            
            # Friendships mit Beziehungstyp
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS friendships (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                    friend_id INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                    relation_type VARCHAR(20) DEFAULT 'friend',
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, friend_id)
                )
            """)
            
            # User Reports (Meldungen)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_reports (
                    report_id SERIAL PRIMARY KEY,
                    post_id INTEGER NOT NULL,
                    author_uid INTEGER REFERENCES users(uid),
                    reporter_uid INTEGER REFERENCES users(uid),
                    reason VARCHAR(50) NOT NULL,
                    description TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_at TIMESTAMP,
                    reviewed_by INTEGER REFERENCES users(uid),
                    action_taken TEXT
                )
            """)
            
            # Moderation Log
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS moderation_log (
                    log_id SERIAL PRIMARY KEY,
                    moderator_uid INTEGER REFERENCES users(uid),
                    target_uid INTEGER REFERENCES users(uid),
                    post_id INTEGER,
                    action VARCHAR(50) NOT NULL,
                    reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Indexes
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_friendships_user 
                ON friendships(user_id, status)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_friendships_friend 
                ON friendships(friend_id, status)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_reports_status 
                ON user_reports(status, created_at)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_users_role 
                ON users(role)
            """)
            
            await conn.commit()


# === User Queries ===
async def get_user_by_uid(uid: int) -> dict | None:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """SELECT uid, username, email, role, bio, is_banned, banned_until, created_at 
               FROM users WHERE uid = %s""",
            (uid,)
        )
        return await result.fetchone()


async def get_user_by_username(username: str) -> dict | None:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT * FROM users WHERE username = %s",
            (username,)
        )
        return await result.fetchone()


async def create_user(username: str, email: str, password_hash: str, first_name: str = None, last_name: str = None) -> dict:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            INSERT INTO users (username, email, password_hash, role, first_name, last_name)
            VALUES (%s, %s, %s, 'user', %s, %s)
            RETURNING uid, username, email, role, created_at
            """,
            (username, email, password_hash, first_name, last_name)
        )
        await conn.commit()
        return await result.fetchone()


async def update_user_role(uid: int, role: str) -> bool:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "UPDATE users SET role = %s WHERE uid = %s RETURNING uid",
            (role, uid)
        )
        await conn.commit()
        return await result.fetchone() is not None


async def ban_user(uid: int, days: int | None, reason: str) -> bool:
    """Bannt einen User temporär oder permanent"""
    async with PostgresDB.connection() as conn:
        if days:
            banned_until = datetime.utcnow() + timedelta(days=days)
            await conn.execute(
                "UPDATE users SET is_banned = TRUE, banned_until = %s, ban_reason = %s WHERE uid = %s",
                (banned_until, reason, uid)
            )
        else:
            await conn.execute(
                "UPDATE users SET is_banned = TRUE, banned_until = NULL, ban_reason = %s WHERE uid = %s",
                (reason, uid)
            )
        await conn.commit()
        return True


async def unban_user(uid: int) -> bool:
    async with PostgresDB.connection() as conn:
        await conn.execute(
            "UPDATE users SET is_banned = FALSE, banned_until = NULL, ban_reason = NULL WHERE uid = %s",
            (uid,)
        )
        await conn.commit()
        return True


async def is_user_banned(uid: int) -> bool:
    user = await get_user_by_uid(uid)
    if not user or not user.get("is_banned"):
        return False
    
    # Prüfe ob temporärer Ban abgelaufen
    banned_until = user.get("banned_until")
    if banned_until and banned_until < datetime.utcnow():
        await unban_user(uid)
        return False
    
    return True


# === Friendship Queries mit Beziehungstyp ===
async def get_friends(uid: int) -> list[int]:
    """Gibt alle akzeptierten Freunde eines Users zurück"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT friend_id as uid, relation_type FROM friendships 
            WHERE user_id = %s AND status = 'accepted'
            UNION
            SELECT user_id as uid, relation_type FROM friendships 
            WHERE friend_id = %s AND status = 'accepted'
            """,
            (uid, uid)
        )
        rows = await result.fetchall()
        return [row["uid"] for row in rows]


async def get_friends_by_relation(uid: int, relation_types: list[str]) -> list[int]:
    """Gibt Freunde nach Beziehungstyp zurück"""
    async with PostgresDB.connection() as conn:
        placeholders = ", ".join(["%s"] * len(relation_types))
        result = await conn.execute(
            f"""
            SELECT friend_id as uid FROM friendships 
            WHERE user_id = %s AND status = 'accepted' AND relation_type IN ({placeholders})
            UNION
            SELECT user_id as uid FROM friendships 
            WHERE friend_id = %s AND status = 'accepted' AND relation_type IN ({placeholders})
            """,
            (uid, *relation_types, uid, *relation_types)
        )
        rows = await result.fetchall()
        return [row["uid"] for row in rows]


async def get_friends_with_info(uid: int) -> list[dict]:
    """Gibt Freunde mit Userinfo und Beziehungstyp zurück"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT u.uid, u.username, u.created_at, f.relation_type
            FROM users u
            INNER JOIN (
                SELECT friend_id as uid, relation_type FROM friendships 
                WHERE user_id = %s AND status = 'accepted'
                UNION
                SELECT user_id as uid, relation_type FROM friendships 
                WHERE friend_id = %s AND status = 'accepted'
            ) f ON u.uid = f.uid
            """,
            (uid, uid)
        )
        return await result.fetchall()


async def get_relation_type(uid: int, friend_uid: int) -> str | None:
    """Gibt den Beziehungstyp zwischen zwei Usern zurück"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT relation_type FROM friendships 
            WHERE ((user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s))
            AND status = 'accepted'
            """,
            (uid, friend_uid, friend_uid, uid)
        )
        row = await result.fetchone()
        return row["relation_type"] if row else None


async def send_friend_request(from_uid: int, to_uid: int, relation_type: str = "friend") -> dict:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            INSERT INTO friendships (user_id, friend_id, relation_type, status)
            VALUES (%s, %s, %s, 'pending')
            ON CONFLICT (user_id, friend_id) DO NOTHING
            RETURNING *
            """,
            (from_uid, to_uid, relation_type)
        )
        await conn.commit()
        return await result.fetchone()


async def accept_friend_request(user_uid: int, requester_uid: int) -> bool:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            UPDATE friendships 
            SET status = 'accepted'
            WHERE user_id = %s AND friend_id = %s AND status = 'pending'
            RETURNING id
            """,
            (requester_uid, user_uid)
        )
        await conn.commit()
        row = await result.fetchone()
        return row is not None


async def update_relation_type(uid: int, friend_uid: int, relation_type: str) -> bool:
    """Aktualisiert den Beziehungstyp"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            UPDATE friendships 
            SET relation_type = %s
            WHERE ((user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s))
            AND status = 'accepted'
            RETURNING id
            """,
            (relation_type, uid, friend_uid, friend_uid, uid)
        )
        await conn.commit()
        return await result.fetchone() is not None


async def remove_friend(uid: int, friend_uid: int) -> bool:
    """Entfernt eine Freundschaft"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            DELETE FROM friendships 
            WHERE (user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s)
            RETURNING id
            """,
            (uid, friend_uid, friend_uid, uid)
        )
        await conn.commit()
        return await result.fetchone() is not None


async def get_pending_requests(uid: int) -> list[dict]:
    """Gibt ausstehende Freundschaftsanfragen zurück"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT u.uid, u.username, f.relation_type, f.created_at as requested_at
            FROM friendships f
            INNER JOIN users u ON f.user_id = u.uid
            WHERE f.friend_id = %s AND f.status = 'pending'
            ORDER BY f.created_at DESC
            """,
            (uid,)
        )
        return await result.fetchall()


# === Report Queries ===
async def create_report(post_id: int, author_uid: int, reporter_uid: int, reason: str, description: str = None) -> dict:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            INSERT INTO user_reports (post_id, author_uid, reporter_uid, reason, description)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (post_id, author_uid, reporter_uid, reason, description)
        )
        await conn.commit()
        return await result.fetchone()


async def get_pending_reports(limit: int = 50) -> list[dict]:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT r.*, u.username as reporter_username, a.username as author_username
            FROM user_reports r
            JOIN users u ON r.reporter_uid = u.uid
            JOIN users a ON r.author_uid = a.uid
            WHERE r.status = 'pending'
            ORDER BY r.created_at ASC
            LIMIT %s
            """,
            (limit,)
        )
        return await result.fetchall()


async def get_report_by_id(report_id: int) -> dict | None:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            "SELECT * FROM user_reports WHERE report_id = %s",
            (report_id,)
        )
        return await result.fetchone()


async def update_report_status(report_id: int, status: str, reviewed_by: int, action_taken: str = None) -> bool:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            UPDATE user_reports 
            SET status = %s, reviewed_at = NOW(), reviewed_by = %s, action_taken = %s
            WHERE report_id = %s
            RETURNING report_id
            """,
            (status, reviewed_by, action_taken, report_id)
        )
        await conn.commit()
        return await result.fetchone() is not None


async def get_report_stats() -> dict:
    """Statistiken für Admin Dashboard"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
                COUNT(*) FILTER (WHERE status = 'actioned') as actioned,
                COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed,
                COUNT(*) as total
            FROM user_reports
        """)
        return await result.fetchone()


# === Moderation Log ===
async def log_moderation_action(moderator_uid: int, target_uid: int, action: str, reason: str, post_id: int = None):
    async with PostgresDB.connection() as conn:
        await conn.execute(
            """
            INSERT INTO moderation_log (moderator_uid, target_uid, post_id, action, reason)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (moderator_uid, target_uid, post_id, action, reason)
        )
        await conn.commit()


async def get_moderation_log(limit: int = 100) -> list[dict]:
    async with PostgresDB.connection() as conn:
        result = await conn.execute(
            """
            SELECT l.*, m.username as moderator_username, t.username as target_username
            FROM moderation_log l
            JOIN users m ON l.moderator_uid = m.uid
            JOIN users t ON l.target_uid = t.uid
            ORDER BY l.created_at DESC
            LIMIT %s
            """,
            (limit,)
        )
        return await result.fetchall()


# === Admin Queries ===
async def get_all_users(limit: int = 100, offset: int = 0, role: str = None) -> list[dict]:
    async with PostgresDB.connection() as conn:
        if role:
            result = await conn.execute(
                """
                SELECT uid, username, email, role, is_banned, banned_until, created_at
                FROM users WHERE role = %s
                ORDER BY created_at DESC LIMIT %s OFFSET %s
                """,
                (role, limit, offset)
            )
        else:
            result = await conn.execute(
                """
                SELECT uid, username, email, role, is_banned, banned_until, created_at
                FROM users ORDER BY created_at DESC LIMIT %s OFFSET %s
                """,
                (limit, offset)
            )
        return await result.fetchall()


async def get_user_count() -> int:
    async with PostgresDB.connection() as conn:
        result = await conn.execute("SELECT COUNT(*) as count FROM users")
        row = await result.fetchone()
        return row["count"]


async def get_username_map(uids: list[int]) -> dict[int, str]:
    """Lädt Usernamen für eine Liste von UIDs"""
    if not uids:
        return {}

    async with PostgresDB.connection() as conn:
        placeholders = ", ".join(["%s"] * len(uids))
        result = await conn.execute(
            f"SELECT uid, username FROM users WHERE uid IN ({placeholders})",
            tuple(uids)
        )
        rows = await result.fetchall()
        return {row["uid"]: row["username"] for row in rows}


async def get_user_profile_data_map(uids: list[int]) -> dict[int, dict]:
    """Lädt Username und Profilbild für eine Liste von UIDs"""
    if not uids:
        return {}

    async with PostgresDB.connection() as conn:
        placeholders = ", ".join(["%s"] * len(uids))
        result = await conn.execute(
            f"SELECT uid, username, profile_picture FROM users WHERE uid IN ({placeholders})",
            tuple(uids)
        )
        rows = await result.fetchall()
        return {
            row["uid"]: {
                "username": row["username"],
                "profile_picture": row.get("profile_picture")
            }
            for row in rows
        }
