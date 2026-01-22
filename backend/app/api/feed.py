from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import Optional

from app.models.schemas import PostCreate, PostResponse, FeedResponse, PostVisibilityUpdate
from app.services.auth_service import get_current_user
from app.services.feed_service import FeedService, PostService
from app.services.media_service import MediaService
from app.db.sqlite_posts import UserPostsDB
from app.db.postgres import get_username_map


router = APIRouter(prefix="/feed", tags=["Feed & Posts"])


@router.get("", response_model=FeedResponse)
async def get_feed(
    limit: int = 50,
    offset: int = 0,
    refresh: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Lädt den Feed des aktuellen Users.
    
    - **limit**: Anzahl Posts (default 50)
    - **offset**: Pagination offset
    - **refresh**: Force refresh, ignoriert Cache
    
    Der Feed wird für 30 Sekunden gecached.
    """
    result = await FeedService.get_feed(
        uid=current_user["uid"],
        limit=limit,
        offset=offset,
        force_refresh=refresh
    )
    
    return FeedResponse(
        posts=[PostResponse(**p) for p in result["posts"]],
        has_more=result["has_more"],
        cached_at=result["cached_at"]
    )


@router.post("", response_model=PostResponse)
async def create_post(
    post_data: PostCreate,
    current_user: dict = Depends(get_current_user)
):
    """Erstellt einen neuen Post"""
    
    post = await PostService.create_post(
        uid=current_user["uid"],
        content=post_data.content,
        visibility=post_data.visibility
    )
    
    return PostResponse(
        post_id=post["post_id"],
        author_uid=current_user["uid"],
        author_username=current_user["username"],
        content=post["content"],
        media_urls=[],
        visibility=post["visibility"],
        created_at=post["created_at"],
        likes_count=0,
        comments_count=0
    )


@router.post("/with-media", response_model=PostResponse)
async def create_post_with_media(
    content: str,
    visibility: str = "friends",
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Erstellt einen Post mit Media-Uploads"""
    
    # Dateien hochladen
    media_paths = []
    for file in files:
        result = await MediaService.upload_file(current_user["uid"], file)
        media_paths.append(result["path"])
    
    # Post erstellen
    post = await PostService.create_post(
        uid=current_user["uid"],
        content=content,
        media_paths=media_paths,
        visibility=visibility
    )
    
    return PostResponse(
        post_id=post["post_id"],
        author_uid=current_user["uid"],
        author_username=current_user["username"],
        content=post["content"],
        media_urls=[f"/api/media/{current_user['uid']}/{p}" for p in media_paths],
        visibility=post["visibility"],
        created_at=post["created_at"],
        likes_count=0,
        comments_count=0
    )


@router.delete("/{post_id}")
async def delete_post(
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Löscht einen eigenen Post"""

    success = await PostService.delete_post(current_user["uid"], post_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )

    return {"message": "Post deleted"}


@router.patch("/{post_id}/visibility", response_model=PostResponse)
async def update_post_visibility(
    post_id: int,
    visibility_update: PostVisibilityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Aktualisiert die Sichtbarkeit eines eigenen Posts"""

    updated_post = await PostService.update_visibility(
        uid=current_user["uid"],
        post_id=post_id,
        visibility=visibility_update.visibility
    )

    if not updated_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )

    # Post für Response anreichern
    posts_db = UserPostsDB(current_user["uid"])
    likes_count = await posts_db.get_likes_count(post_id)
    comments_count = await posts_db.get_comments_count(post_id)

    media_urls = []
    if updated_post.get("media_paths"):
        media_urls = [f"/api/media/{current_user['uid']}/{p}" for p in updated_post["media_paths"]]

    return PostResponse(
        post_id=updated_post["post_id"],
        author_uid=current_user["uid"],
        author_username=current_user["username"],
        content=updated_post["content"],
        media_urls=media_urls,
        visibility=updated_post["visibility"],
        created_at=updated_post["created_at"],
        likes_count=likes_count,
        comments_count=comments_count
    )


@router.post("/{author_uid}/{post_id}/like")
async def like_post(
    author_uid: int,
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Liked einen Post"""
    
    success = await PostService.like_post(author_uid, post_id, current_user["uid"])
    return {"liked": success}


@router.delete("/{author_uid}/{post_id}/like")
async def unlike_post(
    author_uid: int,
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Entfernt Like von einem Post"""
    
    success = await PostService.unlike_post(author_uid, post_id, current_user["uid"])
    return {"unliked": success}


@router.post("/{author_uid}/{post_id}/comment")
async def add_comment(
    author_uid: int,
    post_id: int,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    """Fügt Kommentar zu einem Post hinzu"""
    
    comment = await PostService.add_comment(
        author_uid=author_uid,
        post_id=post_id,
        commenter_uid=current_user["uid"],
        content=content
    )
    
    return {
        **comment,
        "author_username": current_user["username"]
    }


@router.get("/{author_uid}/{post_id}/comments")
async def get_comments(
    author_uid: int,
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Lädt Kommentare eines Posts"""
    
    comments = await PostService.get_comments(author_uid, post_id)
    
    # Usernamen laden
    commenter_uids = list(set(c["user_uid"] for c in comments))
    username_map = await get_username_map(commenter_uids)
    
    # Usernamen hinzufügen
    for comment in comments:
        comment["author_username"] = username_map.get(comment["user_uid"], "Unknown")
    
    return {"comments": comments}
