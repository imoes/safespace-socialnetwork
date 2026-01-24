"""Broadcast Posts Management - Posts die an alle User gehen"""

from typing import Optional, List
from datetime import datetime
from app.db.postgres import PostgresDB


async def create_broadcast_tables():
    """Erstellt die Broadcast-Posts Tabelle"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS broadcast_posts (
                post_id SERIAL PRIMARY KEY,
                author_uid INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                content TEXT NOT NULL,
                visibility TEXT DEFAULT 'public',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT FALSE
            )
        """)

        # Likes für Broadcast-Posts
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS broadcast_post_likes (
                post_id INTEGER REFERENCES broadcast_posts(post_id) ON DELETE CASCADE,
                user_uid INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (post_id, user_uid)
            )
        """)

        # Comments für Broadcast-Posts
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS broadcast_post_comments (
                comment_id SERIAL PRIMARY KEY,
                post_id INTEGER REFERENCES broadcast_posts(post_id) ON DELETE CASCADE,
                user_uid INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Comment Likes
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS broadcast_comment_likes (
                comment_id INTEGER REFERENCES broadcast_post_comments(comment_id) ON DELETE CASCADE,
                user_uid INTEGER REFERENCES users(uid) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (comment_id, user_uid)
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_broadcast_posts_created
            ON broadcast_posts(created_at DESC)
        """)

        await conn.commit()


async def create_broadcast_post(author_uid: int, content: str, visibility: str = "public") -> dict:
    """Erstellt einen neuen Broadcast-Post"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute("""
            INSERT INTO broadcast_posts (author_uid, content, visibility)
            VALUES (%s, %s, %s)
            RETURNING post_id, author_uid, content, visibility, created_at
        """, (author_uid, content, visibility))
        row = await result.fetchone()
        await conn.commit()

        return {
            "post_id": row["post_id"],
            "author_uid": row["author_uid"],
            "content": row["content"],
            "visibility": row["visibility"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "is_broadcast": True,
            "likes_count": 0,
            "comments_count": 0,
            "user_has_liked": False,
            "comments": []
        }


async def get_broadcast_posts(limit: int = 25, offset: int = 0, current_user_uid: Optional[int] = None) -> List[dict]:
    """Holt alle Broadcast-Posts mit Like/Comment Counts"""
    async with PostgresDB.connection() as conn:
        # Hole Posts mit Counts
        result = await conn.execute("""
            SELECT
                bp.post_id,
                bp.author_uid,
                bp.content,
                bp.visibility,
                bp.created_at,
                u.username,
                u.profile_picture,
                COALESCE(likes.count, 0) as likes_count,
                COALESCE(comments.count, 0) as comments_count,
                CASE WHEN user_likes.user_uid IS NOT NULL THEN TRUE ELSE FALSE END as user_has_liked
            FROM broadcast_posts bp
            JOIN users u ON bp.author_uid = u.uid
            LEFT JOIN (
                SELECT post_id, COUNT(*) as count
                FROM broadcast_post_likes
                GROUP BY post_id
            ) likes ON bp.post_id = likes.post_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as count
                FROM broadcast_post_comments
                GROUP BY post_id
            ) comments ON bp.post_id = comments.post_id
            LEFT JOIN broadcast_post_likes user_likes ON bp.post_id = user_likes.post_id AND user_likes.user_uid = %s
            WHERE bp.is_deleted = FALSE
            ORDER BY bp.created_at DESC
            LIMIT %s OFFSET %s
        """, (current_user_uid, limit, offset))

        posts = []
        async for row in result:
            posts.append({
                "post_id": row["post_id"],
                "author_uid": row["author_uid"],
                "content": row["content"],
                "visibility": row["visibility"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "username": row["username"],
                "profile_picture": row["profile_picture"],
                "likes_count": row["likes_count"],
                "comments_count": row["comments_count"],
                "user_has_liked": row["user_has_liked"],
                "is_broadcast": True,
                "comments": []
            })

        return posts


async def toggle_broadcast_like(post_id: int, user_uid: int) -> bool:
    """Toggled Like für einen Broadcast-Post"""
    async with PostgresDB.connection() as conn:
        # Prüfe ob Like existiert
        result = await conn.execute("""
            SELECT 1 FROM broadcast_post_likes
            WHERE post_id = %s AND user_uid = %s
        """, (post_id, user_uid))
        exists = await result.fetchone()

        if exists:
            # Unlike
            await conn.execute("""
                DELETE FROM broadcast_post_likes
                WHERE post_id = %s AND user_uid = %s
            """, (post_id, user_uid))
            await conn.commit()
            return False
        else:
            # Like
            await conn.execute("""
                INSERT INTO broadcast_post_likes (post_id, user_uid)
                VALUES (%s, %s)
            """, (post_id, user_uid))
            await conn.commit()
            return True


async def add_broadcast_comment(post_id: int, user_uid: int, content: str) -> dict:
    """Fügt einen Kommentar zu einem Broadcast-Post hinzu"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute("""
            INSERT INTO broadcast_post_comments (post_id, user_uid, content)
            VALUES (%s, %s, %s)
            RETURNING comment_id, post_id, user_uid, content, created_at
        """, (post_id, user_uid, content))
        row = await result.fetchone()
        await conn.commit()

        # Hole Username
        user_result = await conn.execute("""
            SELECT username, profile_picture FROM users WHERE uid = %s
        """, (user_uid,))
        user = await user_result.fetchone()

        return {
            "comment_id": row["comment_id"],
            "post_id": row["post_id"],
            "user_uid": row["user_uid"],
            "username": user["username"] if user else "Unknown",
            "profile_picture": user["profile_picture"] if user else None,
            "content": row["content"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "likes_count": 0,
            "user_has_liked": False
        }


async def get_broadcast_comments(post_id: int, current_user_uid: Optional[int] = None) -> List[dict]:
    """Holt alle Kommentare für einen Broadcast-Post"""
    async with PostgresDB.connection() as conn:
        result = await conn.execute("""
            SELECT
                c.comment_id,
                c.post_id,
                c.user_uid,
                c.content,
                c.created_at,
                u.username,
                u.profile_picture,
                COALESCE(likes.count, 0) as likes_count,
                CASE WHEN user_likes.user_uid IS NOT NULL THEN TRUE ELSE FALSE END as user_has_liked
            FROM broadcast_post_comments c
            JOIN users u ON c.user_uid = u.uid
            LEFT JOIN (
                SELECT comment_id, COUNT(*) as count
                FROM broadcast_comment_likes
                GROUP BY comment_id
            ) likes ON c.comment_id = likes.comment_id
            LEFT JOIN broadcast_comment_likes user_likes ON c.comment_id = user_likes.comment_id AND user_likes.user_uid = %s
            WHERE c.post_id = %s
            ORDER BY c.created_at ASC
        """, (current_user_uid, post_id))

        comments = []
        async for row in result:
            comments.append({
                "comment_id": row["comment_id"],
                "post_id": row["post_id"],
                "user_uid": row["user_uid"],
                "username": row["username"],
                "profile_picture": row["profile_picture"],
                "content": row["content"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "likes_count": row["likes_count"],
                "user_has_liked": row["user_has_liked"]
            })

        return comments


async def delete_broadcast_post(post_id: int) -> bool:
    """Markiert einen Broadcast-Post als gelöscht"""
    async with PostgresDB.connection() as conn:
        await conn.execute("""
            UPDATE broadcast_posts
            SET is_deleted = TRUE
            WHERE post_id = %s
        """, (post_id,))
        await conn.commit()
        return True
