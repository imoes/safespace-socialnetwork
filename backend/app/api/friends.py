from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.models.schemas import FriendRequest, UserPublic
from app.services.auth_service import get_current_user
from app.db.postgres import (
    get_friends_with_info,
    send_friend_request,
    accept_friend_request,
    get_pending_requests,
    get_user_by_uid
)
from app.db.moderation import (
    set_relationship_type,
    get_relationship_type,
    get_friends_by_relationship
)
from app.cache.redis_cache import OnlineStatus, FeedCache


router = APIRouter(prefix="/friends", tags=["Friends"])


class SetRelationshipRequest(BaseModel):
    relationship: str  # family, close_friend, acquaintance


@router.get("")
async def get_friends(current_user: dict = Depends(get_current_user)):
    """Gibt alle Freunde mit Beziehungstyp zurück"""
    friends = await get_friends_by_relationship(current_user["uid"])
    return {"friends": friends}


@router.get("/family")
async def get_family(current_user: dict = Depends(get_current_user)):
    """Gibt nur Familie zurück"""
    return {"friends": await get_friends_by_relationship(current_user["uid"], "family")}


@router.get("/close")
async def get_close_friends(current_user: dict = Depends(get_current_user)):
    """Gibt enge Freunde zurück"""
    return {"friends": await get_friends_by_relationship(current_user["uid"], "close_friend")}


@router.get("/acquaintances")
async def get_acquaintances(current_user: dict = Depends(get_current_user)):
    """Gibt Bekannte zurück"""
    return {"friends": await get_friends_by_relationship(current_user["uid"], "acquaintance")}


@router.get("/online")
async def get_online_friends(current_user: dict = Depends(get_current_user)):
    """Gibt alle online Freunde zurück"""
    
    friends = await get_friends_with_info(current_user["uid"])
    friend_uids = [f["uid"] for f in friends]
    
    online_uids = await OnlineStatus.get_online_friends(friend_uids)
    
    online_friends = [f for f in friends if f["uid"] in online_uids]
    return [UserPublic(**f) for f in online_friends]


@router.get("/requests")
async def get_friend_requests(current_user: dict = Depends(get_current_user)):
    """Gibt ausstehende Freundschaftsanfragen zurück"""
    
    requests = await get_pending_requests(current_user["uid"])
    return {"requests": requests}


@router.post("/request")
async def send_request(
    request: FriendRequest,
    current_user: dict = Depends(get_current_user)
):
    """Sendet eine Freundschaftsanfrage"""
    
    if request.target_uid == current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send friend request to yourself"
        )
    
    # Prüfen ob User existiert
    target = await get_user_by_uid(request.target_uid)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    result = await send_friend_request(current_user["uid"], request.target_uid)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Friend request already exists"
        )
    
    return {"message": "Friend request sent", "status": "pending"}


@router.post("/accept/{requester_uid}")
async def accept_request(
    requester_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """Akzeptiert eine Freundschaftsanfrage"""
    
    success = await accept_friend_request(current_user["uid"], requester_uid)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending friend request from this user"
        )
    
    # Feed-Cache invalidieren damit neue Posts erscheinen
    await FeedCache.invalidate(current_user["uid"])
    await FeedCache.invalidate(requester_uid)
    
    return {"message": "Friend request accepted"}


@router.delete("/{friend_uid}")
async def remove_friend(
    friend_uid: int,
    current_user: dict = Depends(get_current_user)
):
    """Entfernt einen Freund"""
    # TODO: Implement unfriend logic
    return {"message": "Not implemented yet"}


@router.put("/{friend_uid}/relationship")
async def update_relationship(
    friend_uid: int,
    request: SetRelationshipRequest,
    current_user: dict = Depends(get_current_user)
):
    """Setzt den Beziehungstyp zu einem Freund"""
    if request.relationship not in ("family", "close_friend", "acquaintance"):
        raise HTTPException(status_code=400, detail="Invalid relationship type")
    
    # Prüfen ob Freundschaft existiert
    current_rel = await get_relationship_type(current_user["uid"], friend_uid)
    if current_rel is None:
        raise HTTPException(status_code=404, detail="Not friends with this user")
    
    await set_relationship_type(current_user["uid"], friend_uid, request.relationship)
    
    # Feed-Cache invalidieren weil sich Sichtbarkeiten ändern könnten
    await FeedCache.invalidate(current_user["uid"])
    
    return {"message": f"Relationship set to {request.relationship}"}
