import uuid
import aiofiles
import subprocess
import json
from pathlib import Path
from PIL import Image
import io

from fastapi import UploadFile, HTTPException

from app.config import settings


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/ogg"}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_VIDEO_DURATION = 300  # 5 Minuten in Sekunden
THUMBNAIL_SIZE = (300, 300)


class MediaService:
    """Service für Media-Upload und -Verwaltung"""

    @classmethod
    def get_user_media_dir(cls, uid: int) -> Path:
        """Gibt das Media-Verzeichnis eines Users zurück"""
        return settings.user_data_base / str(uid) / "media"

    @classmethod
    def get_folder_media_dir(cls, folder: str) -> Path:
        """Gibt das Media-Verzeichnis für einen beliebigen Ordner zurück (z.B. group_1)"""
        return settings.user_data_base / folder / "media"
    
    @classmethod
    def get_media_type(cls, content_type: str) -> str | None:
        """Bestimmt den Media-Typ basierend auf Content-Type"""
        if content_type in ALLOWED_IMAGE_TYPES:
            return "image"
        elif content_type in ALLOWED_VIDEO_TYPES:
            return "video"
        elif content_type in ALLOWED_AUDIO_TYPES:
            return "audio"
        return None
    
    @classmethod
    async def upload_file(cls, uid: int, file: UploadFile) -> dict:
        """
        Lädt eine Datei hoch und speichert sie im User-Verzeichnis.
        Generiert Thumbnail für Bilder.
        
        Returns: {"media_id": str, "path": str, "media_type": str, "thumbnail_path": str|None}
        """
        # Validierung
        media_type = cls.get_media_type(file.content_type)
        if not media_type:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file.content_type} not allowed"
            )
        
        # Dateigröße prüfen
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)} MB"
            )
        
        # Unique ID generieren
        media_id = str(uuid.uuid4())
        extension = Path(file.filename).suffix.lower() or cls._get_extension(file.content_type)
        
        # Verzeichnis erstellen
        media_dir = cls.get_user_media_dir(uid) / f"{media_type}s"
        media_dir.mkdir(parents=True, exist_ok=True)
        
        # Datei speichern
        filename = f"{media_id}{extension}"
        filepath = media_dir / filename

        async with aiofiles.open(filepath, "wb") as f:
            await f.write(contents)

        # Video-Validierung: Maximale Dauer prüfen
        if media_type == "video":
            duration = await cls._get_video_duration(filepath)
            if duration and duration > MAX_VIDEO_DURATION:
                # Lösche Datei und werfe Fehler
                filepath.unlink()
                raise HTTPException(
                    status_code=400,
                    detail=f"Video zu lang. Maximale Dauer: {MAX_VIDEO_DURATION // 60} Minuten. Deine Dauer: {int(duration // 60)} Minuten."
                )

        # Thumbnail für Bilder generieren
        thumbnail_path = None
        if media_type == "image":
            thumbnail_path = await cls._create_thumbnail(uid, contents, media_id)
        
        # Relativer Pfad für DB
        relative_path = f"{media_type}s/{filename}"
        relative_thumb = f"thumbnails/{media_id}_thumb.jpg" if thumbnail_path else None
        
        return {
            "media_id": media_id,
            "path": relative_path,
            "media_type": media_type,
            "thumbnail_path": relative_thumb
        }

    @classmethod
    async def upload_file_to_folder(cls, folder: str, file: UploadFile) -> dict:
        """
        Lädt eine Datei in einen beliebigen Ordner hoch (z.B. group_1).
        """
        # Validierung
        media_type = cls.get_media_type(file.content_type)
        if not media_type:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file.content_type} not allowed"
            )

        # Dateigröße prüfen
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)} MB"
            )

        # Unique ID generieren
        media_id = str(uuid.uuid4())
        extension = Path(file.filename).suffix.lower() or cls._get_extension(file.content_type)

        # Verzeichnis erstellen
        media_dir = cls.get_folder_media_dir(folder) / f"{media_type}s"
        media_dir.mkdir(parents=True, exist_ok=True)

        # Datei speichern
        filename = f"{media_id}{extension}"
        filepath = media_dir / filename

        async with aiofiles.open(filepath, "wb") as f:
            await f.write(contents)

        # Relativer Pfad für DB
        relative_path = f"{media_type}s/{filename}"

        return {
            "media_id": media_id,
            "path": relative_path,
            "media_type": media_type,
            "thumbnail_path": None
        }

    @classmethod
    async def _get_video_duration(cls, filepath: Path) -> float | None:
        """Ermittelt die Dauer eines Videos in Sekunden mit ffprobe"""
        try:
            result = subprocess.run(
                [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'json',
                    str(filepath)
                ],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)
                duration_str = data.get('format', {}).get('duration')
                if duration_str:
                    return float(duration_str)
        except Exception as e:
            print(f"Error getting video duration: {e}")

        return None

    @classmethod
    async def _create_thumbnail(cls, uid: int, image_data: bytes, media_id: str) -> Path:
        """Erstellt Thumbnail für ein Bild"""
        thumb_dir = cls.get_user_media_dir(uid) / "thumbnails"
        thumb_dir.mkdir(parents=True, exist_ok=True)
        
        thumb_path = thumb_dir / f"{media_id}_thumb.jpg"
        
        # PIL für Thumbnail
        img = Image.open(io.BytesIO(image_data))
        img.thumbnail(THUMBNAIL_SIZE)
        
        # In RGB konvertieren falls nötig (für JPEG)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # Speichern
        img.save(thumb_path, "JPEG", quality=85)
        
        return thumb_path
    
    @classmethod
    def _get_extension(cls, content_type: str) -> str:
        """Gibt Dateiendung für Content-Type zurück"""
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
            "video/mp4": ".mp4",
            "video/webm": ".webm",
            "video/quicktime": ".mov",
            "audio/mpeg": ".mp3",
            "audio/wav": ".wav",
            "audio/ogg": ".ogg",
        }
        return mapping.get(content_type, "")
    
    @classmethod
    async def delete_file(cls, uid: int, relative_path: str) -> bool:
        """Löscht eine Media-Datei"""
        filepath = cls.get_user_media_dir(uid) / relative_path

        if filepath.exists():
            filepath.unlink()

            # Thumbnail auch löschen falls vorhanden
            media_id = filepath.stem
            thumb_path = cls.get_user_media_dir(uid) / "thumbnails" / f"{media_id}_thumb.jpg"
            if thumb_path.exists():
                thumb_path.unlink()

            return True
        return False

    @classmethod
    async def delete_file_from_folder(cls, folder: str, relative_path: str) -> bool:
        """Löscht eine Media-Datei aus einem beliebigen Ordner"""
        filepath = cls.get_folder_media_dir(folder) / relative_path

        if filepath.exists():
            filepath.unlink()
            return True
        return False
    
    @classmethod
    def get_file_path(cls, uid: int, relative_path: str) -> Path | None:
        """Gibt den absoluten Pfad einer Media-Datei zurück"""
        filepath = cls.get_user_media_dir(uid) / relative_path
        if filepath.exists():
            return filepath
        return None

    @classmethod
    def get_file_path_by_folder(cls, folder: str, relative_path: str) -> Path | None:
        """Gibt den absoluten Pfad einer Media-Datei für einen beliebigen Ordner zurück"""
        filepath = cls.get_folder_media_dir(folder) / relative_path
        if filepath.exists():
            return filepath
        return None
