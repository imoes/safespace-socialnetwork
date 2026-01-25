"""Notifications API für User-Benachrichtigungen"""

from fastapi import APIRouter, Depends
from app.services.auth_service import get_current_user
from app.db.notifications import (
    get_notifications,
    get_unread_count,
    mark_notification_as_read,
    mark_all_as_read,
    delete_notification
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def get_user_notifications(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Holt alle Benachrichtigungen des eingeloggten Users"""
    notifications = await get_notifications(
        current_user["uid"],
        limit=limit,
        offset=offset,
        unread_only=unread_only
    )
    return {"notifications": notifications}


@router.get("/unread-count")
async def get_unread_notifications_count(current_user: dict = Depends(get_current_user)):
    """Gibt die Anzahl ungelesener Benachrichtigungen zurück"""
    count = await get_unread_count(current_user["uid"])
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_as_read(notification_id: int, current_user: dict = Depends(get_current_user)):
    """Markiert eine Benachrichtigung als gelesen"""
    await mark_notification_as_read(notification_id, current_user["uid"])
    return {"success": True}


@router.post("/mark-all-read")
async def mark_all_notifications_as_read(current_user: dict = Depends(get_current_user)):
    """Markiert alle Benachrichtigungen als gelesen"""
    await mark_all_as_read(current_user["uid"])
    return {"success": True}


@router.delete("/{notification_id}")
async def delete_user_notification(notification_id: int, current_user: dict = Depends(get_current_user)):
    """Löscht eine Benachrichtigung"""
    await delete_notification(notification_id, current_user["uid"])
    return {"success": True}
