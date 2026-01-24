"""Welcome Message API für normale User"""

from fastapi import APIRouter, Depends

from app.services.auth_service import get_current_user
from app.db.welcome_message import (
    get_active_welcome_message, has_user_seen_welcome, mark_welcome_seen
)

router = APIRouter(prefix="/welcome", tags=["Welcome"])


@router.get("/message")
async def get_welcome_message(current_user: dict = Depends(get_current_user)):
    """
    Holt die Willkommensnachricht für den User.
    Gibt nur eine Nachricht zurück, wenn:
    1. Eine aktive Nachricht existiert
    2. Der User sie noch nicht gesehen hat
    """
    # Prüfe ob User die Nachricht schon gesehen hat
    has_seen = await has_user_seen_welcome(current_user["uid"])
    if has_seen:
        return {"message": None, "should_show": False}

    # Hole aktive Nachricht
    message = await get_active_welcome_message()
    return {"message": message, "should_show": message is not None}


@router.post("/message/seen")
async def mark_welcome_message_seen(current_user: dict = Depends(get_current_user)):
    """Markiert die Willkommensnachricht als gesehen"""
    await mark_welcome_seen(current_user["uid"])
    return {"success": True}
