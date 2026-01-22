from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional


class ModerationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    FLAGGED = "flagged"
    BLOCKED = "blocked"
    MODIFIED = "modified"


class HateSpeechCategory(str, Enum):
    NONE = "none"
    RACISM = "racism"
    SEXISM = "sexism"
    HOMOPHOBIA = "homophobia"
    RELIGIOUS_HATE = "religious_hate"
    DISABILITY_HATE = "disability_hate"
    XENOPHOBIA = "xenophobia"
    GENERAL_HATE = "general_hate"
    THREAT = "threat"
    HARASSMENT = "harassment"


class PostMessage(BaseModel):
    """Kafka Message für neue Posts"""
    post_id: int
    author_uid: int
    author_username: str
    content: str
    media_paths: list[str] = []
    visibility: str
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ModerationResult(BaseModel):
    """Ergebnis der DeepSeek Moderation"""
    post_id: int
    author_uid: int
    original_content: str
    
    # Analyse
    is_hate_speech: bool
    confidence_score: float  # 0.0 - 1.0
    categories: list[HateSpeechCategory] = []
    explanation: str
    
    # Verbesserungsvorschläge
    suggested_revision: Optional[str] = None
    revision_explanation: Optional[str] = None
    
    # Status
    status: ModerationStatus
    moderated_at: datetime
    
    # Zusätzliche Flags
    requires_human_review: bool = False
    auto_action_taken: Optional[str] = None


class ModerationReport(BaseModel):
    """Vollständiger Moderationsbericht (für MinIO)"""
    report_id: str
    post: PostMessage
    result: ModerationResult
    
    # DeepSeek Details
    model_used: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    
    # Timestamps
    received_at: datetime
    processed_at: datetime
    processing_time_ms: int


class UserModerationStats(BaseModel):
    """Statistiken für einen User"""
    user_uid: int
    total_posts: int = 0
    flagged_posts: int = 0
    blocked_posts: int = 0
    modified_posts: int = 0
    hate_speech_score: float = 0.0  # Durchschnitt
    categories_triggered: dict[str, int] = {}
    last_violation: Optional[datetime] = None
