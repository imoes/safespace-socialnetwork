import aiosqlite
from pathlib import Path
from datetime import datetime
from typing import Optional
import json

from app.config import settings


class UserPostsDB:
    """
    Async SQLite-Datenbank für Posts eines einzelnen Users.
    Jeder User hat seine eigene posts.db in seinem Verzeichnis.
    """
    
    def __init__(self, uid: int):
        self.uid = uid
        self.db_path = settings.user_data_base / str(uid) / "posts.db"
    
    async def _ensure_db(self):
        """Erstellt DB und Verzeichnis falls nicht vorhanden"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    post_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    media_paths TEXT,  -- JSON Array
                    visibility TEXT DEFAULT 'friends',  -- public, friends, close_friends, family, private
                    is_deleted BOOLEAN DEFAULT FALSE,
                    deleted_at TIMESTAMP,
                    deleted_by TEXT,  -- 'user' oder 'moderator'
                    moderation_status TEXT DEFAULT 'pending',  -- pending, approved, flagged, removed
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
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_posts_visibility 
                ON posts(visibility)
            """)
            
            await db.commit()
    
    async def create_post(
        self, 
        content: str, 
        media_paths: list[str] = None,
        visibility: str = "friends"
    ) -> dict:
        """Erstellt einen neuen Post"""
        await self._ensure_db()
        
        media_json = json.dumps(media_paths) if media_paths else None
        
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                INSERT INTO posts (content, media_paths, visibility)
                VALUES (?, ?, ?)
                RETURNING *
                """,
                (content, media_json, visibility)
            )
            row = await cursor.fetchone()
            await db.commit()
            
            return self._row_to_dict(row)
    
    async def get_posts(
        self,
        visibility: list[str] = None,
        since: datetime = None,
        limit: int = 50,
        offset: int = 0,
        include_deleted: bool = False
    ) -> list[dict]:
        """Lädt Posts mit Filtern"""
        if not self.db_path.exists():
            return []
        
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            
            query = "SELECT * FROM posts WHERE 1=1"
            params = []
            
            if not include_deleted:
                query += " AND (is_deleted = FALSE OR is_deleted IS NULL)"
            
            if visibility:
                placeholders = ",".join("?" * len(visibility))
                query += f" AND visibility IN ({placeholders})"
                params.extend(visibility)
            
            if since:
                query += " AND created_at > ?"
                params.append(since.isoformat())
            
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()
            
            return [self._row_to_dict(row) for row in rows]
    
    async def get_post(self, post_id: int) -> dict | None:
        """Lädt einen einzelnen Post"""
        if not self.db_path.exists():
            return None
        
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM posts WHERE post_id = ?",
                (post_id,)
            )
            row = await cursor.fetchone()
            return self._row_to_dict(row) if row else None
    
    async def delete_post(self, post_id: int, deleted_by: str = "user") -> bool:
        """Soft-Delete eines Posts"""
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
    
    async def hard_delete_post(self, post_id: int) -> bool:
        """Permanentes Löschen eines Posts (nur für Admins)"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM posts WHERE post_id = ?",
                (post_id,)
            )
            await db.commit()
            return cursor.rowcount > 0
    
    async def restore_post(self, post_id: int) -> bool:
        """Stellt einen gelöschten Post wieder her"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """
                UPDATE posts 
                SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
                WHERE post_id = ?
                """,
                (post_id,)
            )
            await db.commit()
            return cursor.rowcount > 0
    
    async def set_moderation_status(self, post_id: int, status: str) -> bool:
        """Setzt den Moderations-Status eines Posts"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "UPDATE posts SET moderation_status = ? WHERE post_id = ?",
                (status, post_id)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def update_visibility(self, post_id: int, visibility: str) -> dict | None:
        """Aktualisiert die Sichtbarkeit eines Posts"""
        await self._ensure_db()

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                UPDATE posts
                SET visibility = ?, updated_at = CURRENT_TIMESTAMP
                WHERE post_id = ? AND is_deleted = FALSE
                """,
                (visibility, post_id)
            )
            await db.commit()

            if cursor.rowcount == 0:
                return None

            # Lade den aktualisierten Post
            cursor = await db.execute(
                "SELECT * FROM posts WHERE post_id = ?",
                (post_id,)
            )
            row = await cursor.fetchone()
            return self._row_to_dict(row) if row else None
    
    async def add_like(self, post_id: int, user_uid: int) -> bool:
        """Fügt einen Like hinzu"""
        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute(
                    "INSERT INTO likes (post_id, user_uid) VALUES (?, ?)",
                    (post_id, user_uid)
                )
                await db.commit()
                return True
            except aiosqlite.IntegrityError:
                return False  # Already liked
    
    async def remove_like(self, post_id: int, user_uid: int) -> bool:
        """Entfernt einen Like"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM likes WHERE post_id = ? AND user_uid = ?",
                (post_id, user_uid)
            )
            await db.commit()
            return cursor.rowcount > 0
    
    async def get_likes_count(self, post_id: int) -> int:
        """Zählt Likes für einen Post"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM likes WHERE post_id = ?",
                (post_id,)
            )
            row = await cursor.fetchone()
            return row[0] if row else 0
    
    async def add_comment(self, post_id: int, user_uid: int, content: str) -> dict:
        """Fügt einen Kommentar hinzu"""
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
        """Lädt Kommentare für einen Post"""
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
        """Zählt Kommentare für einen Post"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM comments WHERE post_id = ?",
                (post_id,)
            )
            row = await cursor.fetchone()
            return row[0] if row else 0
    
    def _row_to_dict(self, row: aiosqlite.Row) -> dict:
        """Konvertiert SQLite Row zu Dict mit JSON-Parsing"""
        d = dict(row)
        if d.get("media_paths"):
            d["media_paths"] = json.loads(d["media_paths"])
        else:
            d["media_paths"] = []
        return d


async def get_user_posts_db(uid: int) -> UserPostsDB:
    """Factory function für UserPostsDB"""
    db = UserPostsDB(uid)
    await db._ensure_db()
    return db
