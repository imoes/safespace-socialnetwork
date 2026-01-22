import asyncio
from datetime import datetime
from typing import Optional

from app.db.postgres import get_friends, get_username_map
from app.db.sqlite_posts import UserPostsDB
from app.cache.redis_cache import FeedCache
from app.config import settings


# Visibility Hierarchie: family > close_friends > friends > acquaintance > public
VISIBILITY_TIERS = {
    "family": ["family"],
    "close_friends": ["family", "close_friends"],
    "friends": ["family", "close_friends", "friend"],
    "acquaintance": ["family", "close_friends", "friend", "acquaintance"],
    "public": ["family", "close_friends", "friend", "acquaintance"]  # Public = alle
}


class FeedService:
    """
    Service für das asynchrone Laden und Aggregieren des Feeds.
    Lädt Posts von allen Freunden parallel und cached das Ergebnis.
    
    Sichtbarkeits-Hierarchie:
    - family: Nur Familie sieht den Post
    - close_friends: Familie + Enge Freunde
    - friends: Familie + Enge Freunde + Freunde (Standard)
    - public: Alle (auch Nicht-Freunde)
    - private: Nur der Autor selbst
    """
    
    @classmethod
    async def get_feed(
        cls,
        uid: int,
        limit: int = 50,
        offset: int = 0,
        force_refresh: bool = False
    ) -> dict:
        """
        Lädt den Feed für einen User.
        
        1. Prüft Redis Cache (30 Sek TTL)
        2. Falls Cache Miss: Lädt parallel von allen Freunden
        3. Sortiert nach Datum
        4. Cached das Ergebnis
        
        Returns: {"posts": [...], "has_more": bool, "cached_at": datetime|None}
        """
        
        # Cache prüfen
        if not force_refresh:
            cached = await FeedCache.get(uid)
            if cached:
                posts = cached["posts"][offset:offset + limit]
                return {
                    "posts": posts,
                    "has_more": len(cached["posts"]) > offset + limit,
                    "cached_at": cached["cached_at"]
                }
        
        # Cache Miss - Posts laden
        all_posts = await cls._load_all_posts(uid)
        
        # Cache setzen
        await FeedCache.set(uid, all_posts)
        
        # Paginieren und zurückgeben
        paginated = all_posts[offset:offset + limit]
        return {
            "posts": paginated,
            "has_more": len(all_posts) > offset + limit,
            "cached_at": None  # Frisch geladen
        }
    
    @classmethod
    async def _load_all_posts(cls, uid: int) -> list[dict]:
        """
        Lädt Posts von allen Freunden + eigene Posts parallel.
        Berücksichtigt Freundschafts-Tiers für Sichtbarkeit.
        """
        from app.db.postgres import get_relation_type
        
        # Freundesliste holen
        friend_uids = await get_friends(uid)
        all_uids = [uid] + friend_uids
        
        # Usernamen für alle UIDs laden
        username_map = await get_username_map(all_uids)
        
        # Friendship Tiers laden
        tier_map = {}
        for friend_uid in friend_uids:
            tier = await get_relation_type(uid, friend_uid)
            tier_map[friend_uid] = tier or "friend"  # Default: friend
        
        # Posts parallel laden
        tasks = []
        for user_uid in all_uids:
            if user_uid == uid:
                # Eigene Posts: alle Sichtbarkeiten
                visibility = None
                allowed_tiers = None
            else:
                # Freundes-Posts: basierend auf Tier
                my_tier = tier_map.get(user_uid, "friend")
                # Welche Visibility-Levels kann ich sehen basierend auf meinem Tier?
                allowed_visibility = cls._get_visible_posts_for_tier(my_tier)
                visibility = allowed_visibility
                allowed_tiers = None
            
            tasks.append(
                cls._load_user_posts(user_uid, visibility, username_map)
            )
        
        # Parallel ausführen
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Ergebnisse zusammenführen
        all_posts = []
        for result in results:
            if isinstance(result, Exception):
                print(f"Error loading posts: {result}")
                continue
            all_posts.extend(result)
        
        # Nach Datum sortieren (neueste zuerst)
        all_posts.sort(key=lambda p: p["created_at"], reverse=True)
        
        return all_posts
    
    @classmethod
    def _get_visible_posts_for_tier(cls, viewer_tier: str) -> list[str]:
        """
        Gibt zurück welche Post-Visibility ein Viewer mit bestimmtem Tier sehen kann.
        
        Beispiel: Ich bin "close_friend" von jemand
        → Ich kann Posts sehen die für "close_friends" oder "friends" oder "public" sind
        """
        # Mapping: Mein Tier → Welche Post-Visibilities kann ich sehen
        tier_to_visibility = {
            "family": ["family", "close_friends", "friends", "public"],
            "close_friend": ["close_friends", "friends", "public"],
            "friend": ["friends", "public"],
            "acquaintance": ["public"],
        }
        return tier_to_visibility.get(viewer_tier, ["public"])
    
    @classmethod
    async def _load_user_posts(
        cls,
        user_uid: int,
        visibility: list[str] | None,
        username_map: dict[int, str]
    ) -> list[dict]:
        """Lädt Posts eines Users und reichert sie mit Metadaten an"""
        
        posts_db = UserPostsDB(user_uid)
        raw_posts = await posts_db.get_posts(
            visibility=visibility,
            limit=100  # Max Posts pro User im Feed
        )
        
        enriched = []
        for post in raw_posts:
            # Likes und Comments Count laden
            likes_count = await posts_db.get_likes_count(post["post_id"])
            comments_count = await posts_db.get_comments_count(post["post_id"])
            
            enriched.append({
                "post_id": post["post_id"],
                "author_uid": user_uid,
                "author_username": username_map.get(user_uid, "Unknown"),
                "content": post["content"],
                "media_urls": cls._build_media_urls(user_uid, post["media_paths"]),
                "visibility": post["visibility"],
                "created_at": post["created_at"],
                "likes_count": likes_count,
                "comments_count": comments_count
            })
        
        return enriched
    
    @classmethod
    def _build_media_urls(cls, uid: int, media_paths: list[str]) -> list[str]:
        """Baut URLs für Media-Dateien"""
        if not media_paths:
            return []
        return [f"/api/media/{uid}/{path}" for path in media_paths]
    
    @classmethod
    async def invalidate_feed(cls, uid: int) -> None:
        """
        Invalidiert den Feed-Cache eines Users und seiner Freunde.
        Wird aufgerufen wenn ein User einen neuen Post erstellt.
        """
        friend_uids = await get_friends(uid)
        await FeedCache.invalidate_for_friends(uid, friend_uids)


class PostService:
    """Service für Post-Operationen"""
    
    @classmethod
    async def create_post(
        cls,
        uid: int,
        content: str,
        media_paths: list[str] = None,
        visibility: str = "friends",
        username: str = None
    ) -> dict:
        """Erstellt einen Post und invalidiert relevante Caches"""
        
        posts_db = UserPostsDB(uid)
        post = await posts_db.create_post(content, media_paths, visibility)
        
        # Feed-Cache invalidieren
        await FeedService.invalidate_feed(uid)
        
        # SafeSpace: Post zur Moderation-Queue hinzufügen
        try:
            from app.safespace.kafka_service import PostModerationQueue
            from app.safespace.config import safespace_settings
            
            if safespace_settings.moderation_enabled:
                await PostModerationQueue.enqueue_post(
                    post_id=post["post_id"],
                    author_uid=uid,
                    author_username=username or f"user_{uid}",
                    content=content,
                    media_paths=media_paths,
                    visibility=visibility
                )
        except Exception as e:
            # Moderation-Fehler soll Post nicht blockieren
            print(f"⚠️ SafeSpace Queue Error: {e}")
        
        return post
    
    @classmethod
    async def delete_post(cls, uid: int, post_id: int) -> bool:
        """Löscht einen Post"""
        posts_db = UserPostsDB(uid)
        success = await posts_db.delete_post(post_id)

        if success:
            await FeedService.invalidate_feed(uid)

        return success

    @classmethod
    async def update_visibility(cls, uid: int, post_id: int, visibility: str) -> dict | None:
        """Aktualisiert die Sichtbarkeit eines Posts"""
        posts_db = UserPostsDB(uid)
        updated_post = await posts_db.update_visibility(post_id, visibility)

        if updated_post:
            # Feed-Cache invalidieren (wichtig, da sich Sichtbarkeit geändert hat)
            await FeedService.invalidate_feed(uid)

        return updated_post
    
    @classmethod
    async def like_post(cls, author_uid: int, post_id: int, liker_uid: int) -> bool:
        """Liked einen Post"""
        posts_db = UserPostsDB(author_uid)
        return await posts_db.add_like(post_id, liker_uid)
    
    @classmethod
    async def unlike_post(cls, author_uid: int, post_id: int, liker_uid: int) -> bool:
        """Entfernt Like von einem Post"""
        posts_db = UserPostsDB(author_uid)
        return await posts_db.remove_like(post_id, liker_uid)
    
    @classmethod
    async def add_comment(
        cls,
        author_uid: int,
        post_id: int,
        commenter_uid: int,
        content: str
    ) -> dict:
        """Fügt Kommentar hinzu"""
        posts_db = UserPostsDB(author_uid)
        return await posts_db.add_comment(post_id, commenter_uid, content)
    
    @classmethod
    async def get_comments(cls, author_uid: int, post_id: int) -> list[dict]:
        """Lädt Kommentare eines Posts"""
        posts_db = UserPostsDB(author_uid)
        return await posts_db.get_comments(post_id)
