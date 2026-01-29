import aiosqlite
from pathlib import Path
from datetime import datetime
from typing import Optional
import json

from app.config import settings


class GroupPostsDB:
    """
    Async SQLite-Datenbank für Posts einer Gruppe.
    Jede Gruppe hat ihre eigene posts.db unter /data/groups/{group_id}/posts.db
    """

    def __init__(self, group_id: int):
        self.group_id = group_id
        self.db_path = Path("/data/groups") / str(group_id) / "posts.db"

    async def _ensure_db(self):
        """Erstellt DB und Verzeichnis falls nicht vorhanden"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    post_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    author_uid INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    media_paths TEXT,
                    visibility TEXT DEFAULT 'internal',
                    is_deleted BOOLEAN DEFAULT FALSE,
                    deleted_at TIMESTAMP,
                    deleted_by TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            await db.execute("""
                CREATE TABLE IF NOT EXISTS likes (
                    post_id INTEGER,
                    user_uid INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (post_id, user_uid)
                )
            """)

            await db.execute("""
                CREATE TABLE IF NOT EXISTS comments (
                    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER,
                    user_uid INTEGER,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_posts_created
                ON posts(created_at DESC)
            """)

            await db.commit()

    async def create_post(
        self,
        author_uid: int,
        content: str,
        media_paths: list[str] = None,
        visibility: str = "internal"
    ) -> dict:
        await self._ensure_db()
        media_json = json.dumps(media_paths) if media_paths else None

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                INSERT INTO posts (author_uid, content, media_paths, visibility)
                VALUES (?, ?, ?, ?)
                RETURNING *
                """,
                (author_uid, content, media_json, visibility)
            )
            row = await cursor.fetchone()
            await db.commit()
            return self._row_to_dict(row)

    async def get_posts(
        self,
        limit: int = 50,
        offset: int = 0,
        visibility: list[str] = None
    ) -> list[dict]:
        if not self.db_path.exists():
            return []

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            query = "SELECT * FROM posts WHERE (is_deleted = FALSE OR is_deleted IS NULL)"
            params = []

            if visibility:
                placeholders = ",".join("?" * len(visibility))
                query += f" AND visibility IN ({placeholders})"
                params.extend(visibility)

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()
            return [self._row_to_dict(row) for row in rows]

    async def get_post(self, post_id: int) -> dict | None:
        if not self.db_path.exists():
            return None

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM posts WHERE post_id = ?", (post_id,)
            )
            row = await cursor.fetchone()
            return self._row_to_dict(row) if row else None

    async def delete_post(self, post_id: int, deleted_by: str = "user") -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """
                UPDATE posts
                SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
                WHERE post_id = ? AND is_deleted = FALSE
                """,
                (deleted_by, post_id)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def add_like(self, post_id: int, user_uid: int) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute(
                    "INSERT INTO likes (post_id, user_uid) VALUES (?, ?)",
                    (post_id, user_uid)
                )
                await db.commit()
                return True
            except aiosqlite.IntegrityError:
                return False

    async def remove_like(self, post_id: int, user_uid: int) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM likes WHERE post_id = ? AND user_uid = ?",
                (post_id, user_uid)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def get_likes_count(self, post_id: int) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM likes WHERE post_id = ?", (post_id,)
            )
            row = await cursor.fetchone()
            return row[0] if row else 0

    async def is_liked_by_user(self, post_id: int, user_uid: int) -> bool:
        """Prüft ob User den Post geliked hat"""
        if not self.db_path.exists():
            return False
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT 1 FROM likes WHERE post_id = ? AND user_uid = ? LIMIT 1",
                (post_id, user_uid)
            )
            row = await cursor.fetchone()
            return row is not None

    async def add_comment(self, post_id: int, user_uid: int, content: str) -> dict:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                INSERT INTO comments (post_id, user_uid, content)
                VALUES (?, ?, ?)
                RETURNING *
                """,
                (post_id, user_uid, content)
            )
            row = await cursor.fetchone()
            await db.commit()
            return dict(row)

    async def get_comments(self, post_id: int, limit: int = 50) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT * FROM comments
                WHERE post_id = ?
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (post_id, limit)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def get_comments_count(self, post_id: int) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM comments WHERE post_id = ?", (post_id,)
            )
            row = await cursor.fetchone()
            return row[0] if row else 0

    def _row_to_dict(self, row: aiosqlite.Row) -> dict:
        d = dict(row)
        if d.get("media_paths"):
            d["media_paths"] = json.loads(d["media_paths"])
        else:
            d["media_paths"] = []
        return d


async def get_group_posts_db(group_id: int) -> GroupPostsDB:
    """Factory function für GroupPostsDB"""
    db = GroupPostsDB(group_id)
    await db._ensure_db()
    return db
