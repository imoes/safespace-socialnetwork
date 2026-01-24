"""Broadcast Posts API für normale User - Likes, Comments etc."""

from fastapi import APIRouter, Depends

from app.services.auth_service import get_current_user
from app.db.broadcast_posts import (
    toggle_broadcast_like, add_broadcast_comment, get_broadcast_comments
)

router = APIRouter(prefix="/broadcast", tags=["Broadcast Posts"])


@router.post("/posts/{post_id}/like")
async def like_broadcast_post(post_id: int, current_user: dict = Depends(get_current_user)):
    """Liked/Unlikes einen Broadcast-Post"""
    is_liked = await toggle_broadcast_like(post_id, current_user["uid"])
    return {"liked": is_liked}


@router.post("/posts/{post_id}/comment")
async def comment_on_broadcast_post(post_id: int, content: str, current_user: dict = Depends(get_current_user)):
    """Kommentiert einen Broadcast-Post"""
    comment = await add_broadcast_comment(post_id, current_user["uid"], content)
    return comment


@router.get("/posts/{post_id}/comments")
async def get_broadcast_post_comments(post_id: int, current_user: dict = Depends(get_current_user)):
    """Lädt Kommentare eines Broadcast-Posts"""
    comments = await get_broadcast_comments(post_id, current_user["uid"])
    return {"comments": comments}
