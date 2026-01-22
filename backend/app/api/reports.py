"""API für User-Meldungen von Posts"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.services.auth_service import get_current_user
from app.db.moderation import create_report
from app.db.sqlite_posts import UserPostsDB

router = APIRouter(prefix="/reports", tags=["Reports"])


class CreateReportRequest(BaseModel):
    post_id: int
    post_author_uid: int
    reason: str
    category: str = "other"  # hate_speech, harassment, spam, inappropriate, other
    description: str = None


@router.post("")
async def report_post(request: CreateReportRequest, current_user: dict = Depends(get_current_user)):
    """Meldet einen Post"""
    
    # Prüfen ob Post existiert
    posts_db = UserPostsDB(request.post_author_uid)
    post = await posts_db.get_post(request.post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Eigene Posts kann man nicht melden
    if request.post_author_uid == current_user["uid"]:
        raise HTTPException(status_code=400, detail="Cannot report own posts")
    
    report = await create_report(
        post_id=request.post_id,
        post_author_uid=request.post_author_uid,
        reporter_uid=current_user["uid"],
        reason=request.reason,
        category=request.category,
        description=request.description
    )
    
    return {"message": "Report submitted", "report_id": report["report_id"]}
