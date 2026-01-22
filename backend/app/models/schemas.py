from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from enum import Enum


# === Rollen ===
class UserRole(str, Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"


# === Beziehungstypen ===
class RelationType(str, Enum):
    FAMILY = "family"              # Familie
    CLOSE_FRIEND = "close_friend"  # Enge Freunde
    FRIEND = "friend"              # Bekannte/Freunde


# === Sichtbarkeit ===
class Visibility(str, Enum):
    PUBLIC = "public"              # Jeder
    ACQUAINTANCE = "acquaintance"  # Bekannte und höher
    FRIENDS = "friends"            # Alle Freunde (family + close + friend)
    CLOSE_FRIEND = "close_friend"  # Enge Freunde (alias für close_friends)
    CLOSE_FRIENDS = "close_friends"  # Familie + Enge Freunde
    FAMILY = "family"              # Nur Familie
    PRIVATE = "private"            # Nur ich


# === Auth ===
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    uid: int | None = None


# === User ===
class UserPublic(BaseModel):
    uid: int
    username: str
    role: UserRole = UserRole.USER
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserProfile(UserPublic):
    email: EmailStr
    bio: str | None = None
    avatar_url: str | None = None


class UserWithStats(UserPublic):
    """User mit Statistiken für Admin-Dashboard"""
    post_count: int = 0
    flagged_count: int = 0
    report_count: int = 0
    is_banned: bool = False
    banned_until: datetime | None = None


# === Posts ===
class PostCreate(BaseModel):
    content: str
    visibility: Visibility = Visibility.FRIENDS


class PostResponse(BaseModel):
    post_id: int
    author_uid: int
    author_username: str
    content: str
    media_urls: list[str] = []
    visibility: str
    created_at: datetime
    likes_count: int = 0
    comments_count: int = 0
    is_flagged: bool = False
    is_own_post: bool = False


class FeedResponse(BaseModel):
    posts: list[PostResponse]
    has_more: bool
    cached_at: datetime | None = None


# === Friendships ===
class FriendRequest(BaseModel):
    target_uid: int
    relation_type: RelationType = RelationType.FRIEND


class FriendshipResponse(BaseModel):
    uid: int
    username: str
    relation_type: RelationType
    created_at: datetime


class FriendshipUpdate(BaseModel):
    relation_type: RelationType


# === User Reports ===
class ReportReason(str, Enum):
    HATE_SPEECH = "hate_speech"
    HARASSMENT = "harassment"
    SPAM = "spam"
    VIOLENCE = "violence"
    NUDITY = "nudity"
    MISINFORMATION = "misinformation"
    OTHER = "other"


class ReportCreate(BaseModel):
    post_id: int
    author_uid: int
    reason: ReportReason
    description: str | None = None


class ReportResponse(BaseModel):
    report_id: int
    post_id: int
    author_uid: int
    reporter_uid: int
    reason: ReportReason
    description: str | None
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: int | None = None
    action_taken: str | None = None


# === Moderation ===
class ModerationAction(str, Enum):
    APPROVE = "approve"
    WARN = "warn"
    DELETE = "delete"
    BAN_TEMP = "ban_temp"
    BAN_PERM = "ban_perm"


class ModerationDecision(BaseModel):
    action: ModerationAction
    reason: str
    ban_days: int | None = None


# === Media ===
class MediaUploadResponse(BaseModel):
    media_id: str
    url: str
    media_type: str
    thumbnail_url: str | None = None
