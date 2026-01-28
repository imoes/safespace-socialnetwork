"""Admin und Moderator API Endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import psutil
import time
import httpx
from datetime import datetime, timedelta
from urllib.parse import urlparse
import re

from app.services.auth_service import get_current_user
from app.db.moderation import (
    is_moderator_or_admin, is_admin, get_all_moderators, set_user_role,
    get_pending_reports, get_report, assign_report, resolve_report,
    suspend_user, unsuspend_user, get_user_report_count,
    log_moderator_action, get_moderator_actions, get_moderation_dashboard_stats
)
from app.db.sqlite_posts import UserPostsDB
from app.db.welcome_message import (
    get_active_welcome_message, set_welcome_message, delete_welcome_message,
    get_welcome_stats
)
from app.db.broadcast_posts import create_broadcast_post, get_broadcast_posts, delete_broadcast_post
from app.db.postgres import PostgresDB
from app.db.site_settings import get_site_setting, set_site_setting, get_all_site_settings

router = APIRouter(prefix="/admin", tags=["Admin & Moderation"])

# Track server start time
SERVER_START_TIME = time.time()


class ResolveReportRequest(BaseModel):
    resolution_note: str
    dismiss: bool = False
    action: Optional[str] = None


class SuspendUserRequest(BaseModel):
    reason: str
    duration_days: Optional[int] = None


class SetRoleRequest(BaseModel):
    role: str


class ModeratorActionRequest(BaseModel):
    action_type: str
    target_post_id: Optional[int] = None
    target_user_uid: Optional[int] = None
    post_author_uid: Optional[int] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class WelcomeMessageRequest(BaseModel):
    title: str
    content: str


class BroadcastPostRequest(BaseModel):
    content: str
    visibility: str = "public"


class SiteSettingsRequest(BaseModel):
    site_url: str


async def require_moderator(current_user: dict = Depends(get_current_user)) -> dict:
    if not await is_moderator_or_admin(current_user["uid"]):
        raise HTTPException(status_code=403, detail="Moderator access required")
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not await is_admin(current_user["uid"]):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/dashboard")
async def get_dashboard(moderator: dict = Depends(require_moderator)):
    return await get_moderation_dashboard_stats()


@router.get("/moderators")
async def list_moderators(admin: dict = Depends(require_admin)):
    return await get_all_moderators()


@router.get("/reports")
async def list_reports(limit: int = 50, offset: int = 0, moderator: dict = Depends(require_moderator)):
    reports = await get_pending_reports(limit, offset)
    return {"reports": reports}


@router.get("/reports/{report_id}")
async def get_report_detail(report_id: int, moderator: dict = Depends(require_moderator)):
    report = await get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    posts_db = UserPostsDB(report["post_author_uid"])
    post = await posts_db.get_post(report["post_id"])
    return {"report": report, "post": post}


@router.post("/reports/{report_id}/assign")
async def assign_report_to_me(report_id: int, moderator: dict = Depends(require_moderator)):
    if not await assign_report(report_id, moderator["uid"]):
        raise HTTPException(status_code=400, detail="Report already assigned")
    return {"message": "Report assigned"}


@router.post("/reports/{report_id}/resolve")
async def resolve_report_endpoint(report_id: int, request: ResolveReportRequest, moderator: dict = Depends(require_moderator)):
    report = await get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if request.action == "delete_post":
        posts_db = UserPostsDB(report["post_author_uid"])
        await posts_db.delete_post(report["post_id"])
        await log_moderator_action(moderator["uid"], "delete", target_post_id=report["post_id"],
                                   target_user_uid=report["post_author_uid"], report_id=report_id)
    elif request.action == "suspend":
        await suspend_user(report["post_author_uid"], request.resolution_note, 7, moderator["uid"])
    
    await resolve_report(report_id, moderator["uid"], request.resolution_note, request.dismiss)
    return {"message": "Report resolved"}


@router.post("/users/{user_uid}/suspend")
async def suspend_user_endpoint(user_uid: int, request: SuspendUserRequest, moderator: dict = Depends(require_moderator)):
    await suspend_user(user_uid, request.reason, request.duration_days, moderator["uid"])
    return {"message": f"User {user_uid} suspended"}


@router.post("/users/{user_uid}/unsuspend")
async def unsuspend_user_endpoint(user_uid: int, moderator: dict = Depends(require_moderator)):
    await unsuspend_user(user_uid)
    return {"message": f"User {user_uid} unsuspended"}


@router.post("/users/{user_uid}/role")
async def set_user_role_endpoint(user_uid: int, request: SetRoleRequest, admin: dict = Depends(require_admin)):
    if request.role not in ("user", "moderator", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await set_user_role(user_uid, request.role)
    return {"message": f"Role set to {request.role}"}


@router.post("/posts/action")
async def moderate_post(request: ModeratorActionRequest, moderator: dict = Depends(require_moderator)):
    if request.action_type == "delete" and request.target_post_id and request.post_author_uid:
        posts_db = UserPostsDB(request.post_author_uid)
        await posts_db.delete_post(request.target_post_id)
    
    await log_moderator_action(moderator["uid"], request.action_type, target_post_id=request.target_post_id,
                               target_user_uid=request.target_user_uid, reason=request.reason, notes=request.notes)
    return {"message": f"Action {request.action_type} executed"}


@router.get("/actions")
async def list_actions(limit: int = 100, moderator: dict = Depends(require_moderator)):
    return {"actions": await get_moderator_actions(limit=limit)}


# === Welcome Message Endpoints ===

@router.get("/welcome-message")
async def get_welcome_message_admin(admin: dict = Depends(require_admin)):
    """Holt die aktive Willkommensnachricht (Admin)"""
    message = await get_active_welcome_message()
    stats = await get_welcome_stats()
    return {"message": message, "stats": stats}


@router.put("/welcome-message")
async def update_welcome_message(request: WelcomeMessageRequest, admin: dict = Depends(require_admin)):
    """Setzt/Aktualisiert die Willkommensnachricht"""
    message = await set_welcome_message(request.title, request.content)
    return {"message": message}


@router.delete("/welcome-message")
async def remove_welcome_message(admin: dict = Depends(require_admin)):
    """Löscht die aktive Willkommensnachricht"""
    await delete_welcome_message()
    return {"message": "Welcome message deleted"}


# === Broadcast Posts Endpoints ===

@router.post("/broadcast-post")
async def create_broadcast_post_endpoint(request: BroadcastPostRequest, admin: dict = Depends(require_admin)):
    """Erstellt einen Broadcast-Post der an alle User geht"""
    post = await create_broadcast_post(admin["uid"], request.content, request.visibility)
    return {"post": post}


@router.get("/broadcast-posts")
async def list_broadcast_posts(limit: int = 50, offset: int = 0, admin: dict = Depends(require_admin)):
    """Listet alle Broadcast-Posts (Admin)"""
    posts = await get_broadcast_posts(limit, offset, admin["uid"])
    return {"posts": posts}


@router.delete("/broadcast-post/{post_id}")
async def delete_broadcast_post_endpoint(post_id: int, admin: dict = Depends(require_admin)):
    """Löscht einen Broadcast-Post"""
    await delete_broadcast_post(post_id)
    return {"message": "Broadcast post deleted"}


# === System Status Endpoint ===

@router.get("/system-status")
async def get_system_status(moderator: dict = Depends(require_moderator)):
    """Gibt System-Performance und Benutzerstatistiken zurück"""

    # System Performance Metriken
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    # Uptime berechnen
    uptime_seconds = time.time() - SERVER_START_TIME
    uptime_timedelta = timedelta(seconds=int(uptime_seconds))
    uptime_str = str(uptime_timedelta)

    # Datenbank-Statistiken
    async with PostgresDB.connection() as conn:
        # Anzahl registrierter Benutzer
        result = await conn.execute("SELECT COUNT(*) as count FROM users")
        row = await result.fetchone()
        total_users = row["count"] if row else 0

        # Anzahl aktiver Benutzer (letzte 15 Minuten)
        fifteen_minutes_ago = datetime.utcnow() - timedelta(minutes=15)
        result = await conn.execute(
            "SELECT COUNT(*) as count FROM users WHERE last_login > %s",
            (fifteen_minutes_ago,)
        )
        row = await result.fetchone()
        active_users = row["count"] if row else 0

        # Anzahl online Benutzer (letzte 5 Minuten)
        five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
        result = await conn.execute(
            "SELECT COUNT(*) as count FROM users WHERE last_login > %s",
            (five_minutes_ago,)
        )
        row = await result.fetchone()
        online_users = row["count"] if row else 0

        # Benutzer pro Rolle
        result = await conn.execute(
            "SELECT role, COUNT(*) as count FROM users GROUP BY role"
        )
        role_stats = await result.fetchall()

        # Freundschaften
        result = await conn.execute("SELECT COUNT(*) as count FROM friendships WHERE status = 'accepted'")
        row = await result.fetchone()
        total_friendships = row["count"] if row else 0

        result = await conn.execute("SELECT COUNT(*) as count FROM friendships WHERE status = 'pending'")
        row = await result.fetchone()
        pending_requests = row["count"] if row else 0

        # Reports - use user_reports table
        result = await conn.execute("SELECT COUNT(*) as count FROM user_reports WHERE status = 'pending'")
        row = await result.fetchone()
        open_reports = row["count"] if row else 0

        result = await conn.execute("SELECT COUNT(*) as count FROM user_reports")
        row = await result.fetchone()
        total_reports = row["count"] if row else 0

        # Neue Benutzer heute
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        result = await conn.execute(
            "SELECT COUNT(*) as count FROM users WHERE created_at >= %s",
            (today_start,)
        )
        row = await result.fetchone()
        new_users_today = row["count"] if row else 0

        # Neue Benutzer letzte 7 Tage
        week_ago = datetime.utcnow() - timedelta(days=7)
        result = await conn.execute(
            "SELECT COUNT(*) as count FROM users WHERE created_at >= %s",
            (week_ago,)
        )
        row = await result.fetchone()
        new_users_week = row["count"] if row else 0

    # Posts zählen (aus allen User-SQLite-DBs)
    # Vereinfachte Version - nur schätzen basierend auf Dateien
    import os
    from pathlib import Path
    data_dir = Path("/data/users")
    total_posts_estimate = 0
    if data_dir.exists():
        # Zähle .db Dateien als Proxy
        db_files = list(data_dir.rglob("posts.db"))
        # Schätze durchschnittlich 10 Posts pro Benutzer-DB
        total_posts_estimate = len(db_files) * 10

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "system": {
            "uptime": uptime_str,
            "uptime_seconds": int(uptime_seconds),
            "cpu_percent": round(cpu_percent, 2),
            "memory": {
                "total": memory.total,
                "used": memory.used,
                "available": memory.available,
                "percent": round(memory.percent, 2),
                "total_gb": round(memory.total / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2)
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": round(disk.percent, 2),
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2)
            }
        },
        "users": {
            "total": total_users,
            "active_15min": active_users,
            "online_5min": online_users,
            "new_today": new_users_today,
            "new_week": new_users_week,
            "roles": {row["role"]: row["count"] for row in role_stats}
        },
        "social": {
            "friendships": total_friendships,
            "pending_friend_requests": pending_requests,
            "posts_estimate": total_posts_estimate
        },
        "moderation": {
            "open_reports": open_reports,
            "total_reports": total_reports
        }
    }


# === Site Settings Endpoints ===

@router.get("/site-settings")
async def get_site_settings(admin: dict = Depends(require_admin)):
    """Holt alle Site-Einstellungen"""
    all_settings = await get_all_site_settings()
    return {
        "site_url": all_settings.get("site_url", "http://localhost:4200"),
        "site_title": all_settings.get("site_title", "SocialNet")
    }


@router.put("/site-settings")
async def update_site_settings(request: SiteSettingsRequest, admin: dict = Depends(require_admin)):
    """Aktualisiert die Site-Einstellungen"""
    # Site URL bereinigen (trailing slash entfernen)
    site_url = request.site_url.rstrip("/")
    await set_site_setting("site_url", site_url)
    return {"message": "Einstellungen gespeichert", "site_url": site_url}


class SiteTitleRequest(BaseModel):
    site_title: str


@router.put("/site-settings/title")
async def update_site_title(request: SiteTitleRequest, admin: dict = Depends(require_admin)):
    """Aktualisiert den Site-Titel"""
    site_title = request.site_title.strip()
    if not site_title:
        raise HTTPException(status_code=400, detail="Titel darf nicht leer sein")
    await set_site_setting("site_title", site_title)
    return {"message": "Titel gespeichert", "site_title": site_title}


# === Link Preview Endpoint ===

@router.get("/link-preview", dependencies=[])
async def get_link_preview(url: str, current_user: dict = Depends(get_current_user)):
    """Holt OpenGraph-Metadaten fuer eine URL (Link-Vorschau)"""
    # URL validieren
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(status_code=400, detail="Nur HTTP/HTTPS URLs erlaubt")
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="Ungueltige URL")
    except Exception:
        raise HTTPException(status_code=400, detail="Ungueltige URL")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; SafeSpaceBot/1.0)"
            })
            response.raise_for_status()
            html = response.text[:50000]  # Max 50KB parsen

        # OpenGraph Tags extrahieren
        og_data = _extract_og_tags(html, url)
        return og_data

    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Timeout beim Laden der URL")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Fehler beim Laden: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail="Fehler beim Laden der URL")


def _extract_og_tags(html: str, url: str) -> dict:
    """Extrahiert OpenGraph-Tags aus HTML"""
    import html as html_module

    def get_meta(property_name: str) -> str:
        # Suche nach og: und twitter: meta tags
        patterns = [
            rf'<meta[^>]*property=["\']og:{property_name}["\'][^>]*content=["\']([^"\']*)["\']',
            rf'<meta[^>]*content=["\']([^"\']*)["\'][^>]*property=["\']og:{property_name}["\']',
            rf'<meta[^>]*name=["\']twitter:{property_name}["\'][^>]*content=["\']([^"\']*)["\']',
            rf'<meta[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']twitter:{property_name}["\']',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return html_module.unescape(match.group(1))
        return ""

    # Fallback: <title> Tag
    title = get_meta("title")
    if not title:
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
        if title_match:
            title = html_module.unescape(title_match.group(1).strip())

    description = get_meta("description")
    if not description:
        # Fallback: meta description
        desc_match = re.search(
            r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']',
            html, re.IGNORECASE
        )
        if desc_match:
            description = html_module.unescape(desc_match.group(1))

    image = get_meta("image")
    site_name = get_meta("site_name")

    parsed = urlparse(url)
    domain = parsed.netloc

    # Bild-URL zu absoluter URL machen
    if image and not image.startswith("http"):
        if image.startswith("//"):
            image = f"{parsed.scheme}:{image}"
        elif image.startswith("/"):
            image = f"{parsed.scheme}://{parsed.netloc}{image}"

    return {
        "url": url,
        "title": title or domain,
        "description": description[:300] if description else "",
        "image": image,
        "site_name": site_name or domain,
        "domain": domain
    }
