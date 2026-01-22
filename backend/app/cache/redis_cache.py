import redis.asyncio as redis
import json
from datetime import datetime
from typing import Optional

from app.config import settings


class RedisCache:
    _client: redis.Redis | None = None
    
    @classmethod
    async def init(cls):
        """Initialisiert Redis-Verbindung"""
        cls._client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
    
    @classmethod
    async def close(cls):
        """Schließt Redis-Verbindung"""
        if cls._client:
            await cls._client.close()
    
    @classmethod
    def client(cls) -> redis.Redis:
        if not cls._client:
            raise RuntimeError("Redis not initialized")
        return cls._client


class FeedCache:
    """
    Cached den Feed eines Users für 30 Sekunden.
    Key-Schema: feed:{uid}
    """
    
    PREFIX = "feed"
    TTL = settings.feed_cache_ttl  # 30 Sekunden
    
    @classmethod
    def _key(cls, uid: int) -> str:
        return f"{cls.PREFIX}:{uid}"
    
    @classmethod
    async def get(cls, uid: int) -> dict | None:
        """
        Holt gecachten Feed.
        Returns: {"posts": [...], "cached_at": "ISO timestamp"} oder None
        """
        data = await RedisCache.client().get(cls._key(uid))
        if data:
            return json.loads(data)
        return None
    
    @classmethod
    async def set(cls, uid: int, posts: list[dict]) -> None:
        """Cached den Feed für 30 Sekunden"""
        cache_data = {
            "posts": posts,
            "cached_at": datetime.utcnow().isoformat()
        }
        await RedisCache.client().setex(
            cls._key(uid),
            cls.TTL,
            json.dumps(cache_data, default=str)
        )
    
    @classmethod
    async def invalidate(cls, uid: int) -> None:
        """Invalidiert den Cache eines Users"""
        await RedisCache.client().delete(cls._key(uid))
    
    @classmethod
    async def invalidate_for_friends(cls, uid: int, friend_uids: list[int]) -> None:
        """
        Invalidiert Cache für alle Freunde wenn ein User postet.
        So sehen sie den neuen Post beim nächsten Refresh.
        """
        keys = [cls._key(uid)] + [cls._key(f) for f in friend_uids]
        if keys:
            await RedisCache.client().delete(*keys)


class SessionCache:
    """
    Optional: Session-basiertes Caching für Auth-Tokens.
    Kann genutzt werden um Tokens zu invalidieren.
    """
    
    PREFIX = "session"
    TTL = 60 * 60 * 24  # 24 Stunden
    
    @classmethod
    def _key(cls, uid: int) -> str:
        return f"{cls.PREFIX}:{uid}"
    
    @classmethod
    async def set_session(cls, uid: int, token_data: dict) -> None:
        await RedisCache.client().setex(
            cls._key(uid),
            cls.TTL,
            json.dumps(token_data)
        )
    
    @classmethod
    async def get_session(cls, uid: int) -> dict | None:
        data = await RedisCache.client().get(cls._key(uid))
        return json.loads(data) if data else None
    
    @classmethod
    async def invalidate_session(cls, uid: int) -> None:
        await RedisCache.client().delete(cls._key(uid))


class OnlineStatus:
    """
    Trackt welche User online sind.
    Setzt einen Key mit kurzem TTL, der bei jedem Request erneuert wird.
    """
    
    PREFIX = "online"
    TTL = 60  # 1 Minute ohne Aktivität = offline
    
    @classmethod
    def _key(cls, uid: int) -> str:
        return f"{cls.PREFIX}:{uid}"
    
    @classmethod
    async def set_online(cls, uid: int) -> None:
        """Markiert User als online"""
        await RedisCache.client().setex(
            cls._key(uid),
            cls.TTL,
            datetime.utcnow().isoformat()
        )
    
    @classmethod
    async def is_online(cls, uid: int) -> bool:
        """Prüft ob User online ist"""
        return await RedisCache.client().exists(cls._key(uid)) > 0
    
    @classmethod
    async def get_online_friends(cls, friend_uids: list[int]) -> list[int]:
        """Gibt Liste der online Freunde zurück"""
        if not friend_uids:
            return []
        
        pipeline = RedisCache.client().pipeline()
        for uid in friend_uids:
            pipeline.exists(cls._key(uid))
        
        results = await pipeline.execute()
        return [uid for uid, exists in zip(friend_uids, results) if exists]
