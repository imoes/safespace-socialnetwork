from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse

from app.models.schemas import MediaUploadResponse
from app.services.auth_service import get_current_user
from app.services.media_service import MediaService


router = APIRouter(prefix="/media", tags=["Media"])


@router.post("/upload", response_model=MediaUploadResponse)
async def upload_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Lädt eine Media-Datei hoch.
    Unterstützt: Bilder (jpg, png, gif, webp), Videos (mp4, webm, mov), Audio (mp3, wav, ogg)
    Max. Größe: 100 MB
    """
    
    result = await MediaService.upload_file(current_user["uid"], file)
    
    return MediaUploadResponse(
        media_id=result["media_id"],
        url=f"/api/media/{current_user['uid']}/{result['path']}",
        media_type=result["media_type"],
        thumbnail_url=f"/api/media/{current_user['uid']}/{result['thumbnail_path']}" if result["thumbnail_path"] else None
    )


@router.get("/{uid}/{media_type}/{filename}")
async def get_media(
    uid: int,
    media_type: str,
    filename: str
):
    """
    Gibt eine Media-Datei zurück.
    Öffentlicher Endpoint - Zugriffskontrolle über Post-Visibility.
    """
    
    # Pfad zusammenbauen
    relative_path = f"{media_type}/{filename}"
    filepath = MediaService.get_file_path(uid, relative_path)
    
    if not filepath:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found"
        )
    
    # Content-Type bestimmen
    suffix = filepath.suffix.lower()
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
    }
    
    return FileResponse(
        path=filepath,
        media_type=content_types.get(suffix, "application/octet-stream")
    )


@router.delete("/{media_path:path}")
async def delete_media(
    media_path: str,
    current_user: dict = Depends(get_current_user)
):
    """Löscht eine eigene Media-Datei"""
    
    success = await MediaService.delete_file(current_user["uid"], media_path)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found"
        )
    
    return {"message": "Media deleted"}
