from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.services.auth_service import get_current_user
from app.safespace.models import ModerationResult, ModerationStatus, UserModerationStats
from app.safespace.deepseek_moderator import DeepSeekModerator
from app.safespace.minio_service import MinIOService
from app.safespace.config import safespace_settings


router = APIRouter(prefix="/safespace", tags=["SafeSpace Moderation"])


class DisputeRequest(BaseModel):
    content: str
    reason: str


@router.get("/status")
async def get_moderation_status():
    """Gibt den Status des SafeSpace Moderation Systems zurück"""
    return {
        "enabled": safespace_settings.moderation_enabled,
        "auto_flag_threshold": safespace_settings.auto_flag_threshold,
        "auto_block_threshold": safespace_settings.auto_block_threshold,
        "kafka_topic": safespace_settings.kafka_topic_new_posts,
        "deepseek_model": safespace_settings.deepseek_model
    }


@router.post("/check")
async def check_content(
    content: str,
    language: str = "de",
    current_user: dict = Depends(get_current_user)
):
    """
    Prüft Content auf Hassrede OHNE zu speichern.
    Kann vom Frontend genutzt werden um Content VOR dem Posten zu prüfen.

    Args:
        content: Der zu prüfende Inhalt
        language: Sprache für die Moderation (de, en, es, fr, it, ar)
    """
    from app.safespace.models import PostMessage

    # Temporäre PostMessage erstellen
    temp_post = PostMessage(
        post_id=0,  # Temporär
        author_uid=current_user["uid"],
        author_username=current_user["username"],
        content=content,
        visibility="public",  # Temporär, für Content-Check nicht relevant
        created_at=datetime.utcnow()
    )

    # Moderieren mit Sprache
    result = await DeepSeekModerator.moderate_post(temp_post, language)
    
    return {
        "is_hate_speech": result.is_hate_speech,
        "confidence_score": result.confidence_score,
        "categories": [c.value for c in result.categories],
        "explanation": result.explanation,
        "suggested_revision": result.suggested_revision,
        "alternative_suggestions": result.alternative_suggestions or [],
        "revision_explanation": result.revision_explanation,
        "would_be_status": result.status.value
    }


@router.post("/suggest-revision")
async def suggest_revision(
    content: str,
    language: str = "de",
    current_user: dict = Depends(get_current_user)
):
    """
    Generiert einen Verbesserungsvorschlag für problematischen Content.

    Args:
        content: Der zu verbessernde Inhalt
        language: Sprache für den Vorschlag (de, en, es, fr, it, ar)
    """
    suggestion = await DeepSeekModerator.suggest_improvement(content, language)

    return {
        "original": content,
        "suggestion": suggestion
    }


@router.post("/dispute")
async def dispute_moderation(
    request: DisputeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Erstellt einen Widerspruch gegen die Moderation.
    Der Post wird zur menschlichen Überprüfung markiert.
    """
    from app.db.postgres import PostgresDB

    # Speichere den Widerspruch in der Datenbank
    async with PostgresDB.connection() as conn:
        await conn.execute(
            """
            INSERT INTO moderation_disputes (user_uid, content, reason, created_at, status)
            VALUES (%s, %s, %s, %s, 'pending')
            """,
            (current_user["uid"], request.content, request.reason, datetime.utcnow())
        )
        await conn.commit()

    return {
        "message": "Widerspruch wurde zur Prüfung durch einen Moderator weitergeleitet",
        "status": "pending_review"
    }


@router.get("/reports/post/{post_id}")
async def get_post_moderation_report(
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Gibt den Moderation Report für einen spezifischen Post zurück.
    User kann nur eigene Reports sehen (außer Admins).
    """
    # TODO: Implementierung mit DB-Index für post_id -> MinIO path
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Requires database index for efficient lookup"
    )


@router.get("/reports/user/{user_uid}")
async def get_user_moderation_reports(
    user_uid: int,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Gibt Moderation Reports für einen User zurück.
    User kann nur eigene Reports sehen.
    """
    # Nur eigene Reports erlauben (außer für Admins)
    if current_user["uid"] != user_uid:
        # TODO: Admin-Check
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view own reports"
        )
    
    report_paths = MinIOService.list_reports_by_user(user_uid, limit=limit)
    
    reports = []
    for path in report_paths:
        report = MinIOService.get_moderation_report(path)
        if report:
            reports.append({
                "report_id": report.report_id,
                "post_id": report.post.post_id,
                "status": report.result.status.value,
                "is_hate_speech": report.result.is_hate_speech,
                "confidence_score": report.result.confidence_score,
                "categories": [c.value for c in report.result.categories],
                "processed_at": report.processed_at.isoformat()
            })
    
    return {"reports": reports}


@router.get("/stats/user/{user_uid}")
async def get_user_moderation_stats(
    user_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Gibt Moderations-Statistiken für einen User zurück.
    """
    if current_user["uid"] != user_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view own stats"
        )
    
    # Reports laden und Statistiken berechnen
    report_paths = MinIOService.list_reports_by_user(user_uid, limit=1000)
    
    stats = UserModerationStats(user_uid=user_uid)
    category_counts: dict[str, int] = {}
    total_score = 0.0
    
    for path in report_paths:
        report = MinIOService.get_moderation_report(path)
        if not report:
            continue
        
        stats.total_posts += 1
        result = report.result
        
        if result.status == ModerationStatus.FLAGGED:
            stats.flagged_posts += 1
        elif result.status == ModerationStatus.BLOCKED:
            stats.blocked_posts += 1
        elif result.status == ModerationStatus.MODIFIED:
            stats.modified_posts += 1
        
        if result.is_hate_speech:
            total_score += result.confidence_score
            
            for cat in result.categories:
                category_counts[cat.value] = category_counts.get(cat.value, 0) + 1
            
            if stats.last_violation is None or report.processed_at > stats.last_violation:
                stats.last_violation = report.processed_at
    
    if stats.total_posts > 0:
        stats.hate_speech_score = total_score / stats.total_posts
    
    stats.categories_triggered = category_counts
    
    return stats


@router.get("/reports/recent")
async def get_recent_reports(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """
    Gibt aktuelle Moderation Reports zurück (Admin only).
    """
    # TODO: Admin-Check
    
    from datetime import timedelta
    
    today = datetime.utcnow()
    reports = []
    
    for i in range(days):
        date = today - timedelta(days=i)
        paths = MinIOService.list_reports_by_date(
            year=date.year,
            month=date.month,
            day=date.day
        )
        
        for path in paths[:50]:  # Max 50 pro Tag
            report = MinIOService.get_moderation_report(path)
            if report and report.result.is_hate_speech:
                reports.append({
                    "report_id": report.report_id,
                    "post_id": report.post.post_id,
                    "author_uid": report.post.author_uid,
                    "author_username": report.post.author_username,
                    "content_preview": report.post.content[:100],
                    "status": report.result.status.value,
                    "confidence_score": report.result.confidence_score,
                    "categories": [c.value for c in report.result.categories],
                    "processed_at": report.processed_at.isoformat()
                })
    
    return {"reports": reports[:100]}  # Max 100 insgesamt
