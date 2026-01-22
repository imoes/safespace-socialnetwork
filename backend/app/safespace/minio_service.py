import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import BinaryIO
import io

from minio import Minio
from minio.error import S3Error

from app.safespace.config import safespace_settings
from app.safespace.models import ModerationReport


class MinIOService:
    """
    MinIO Object Storage Service.
    
    Buckets:
    - socialnet-media: User Media (Bilder, Videos, Audio)
    - safespace-reports: Moderation Reports (JSON)
    """
    
    _client: Minio = None
    
    @classmethod
    def get_client(cls) -> Minio:
        if cls._client is None:
            cls._client = Minio(
                endpoint=safespace_settings.minio_endpoint,
                access_key=safespace_settings.minio_access_key,
                secret_key=safespace_settings.minio_secret_key,
                secure=safespace_settings.minio_use_ssl
            )
            cls._ensure_buckets()
        return cls._client
    
    @classmethod
    def _ensure_buckets(cls):
        """Erstellt Buckets falls nicht vorhanden"""
        client = cls._client
        buckets = [
            safespace_settings.minio_bucket_media,
            safespace_settings.minio_bucket_moderation
        ]
        
        for bucket in buckets:
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
                print(f"✅ Bucket erstellt: {bucket}")
    
    # === Media Operations ===
    
    @classmethod
    def upload_media(
        cls,
        user_uid: int,
        file_data: BinaryIO,
        filename: str,
        content_type: str
    ) -> str:
        """
        Lädt Media-Datei hoch.
        Returns: Object path (z.B. "users/123/images/uuid.jpg")
        """
        client = cls.get_client()
        
        # Pfad generieren
        media_type = cls._get_media_type(content_type)
        file_ext = Path(filename).suffix
        object_name = f"users/{user_uid}/{media_type}/{uuid.uuid4()}{file_ext}"
        
        # Dateigröße ermitteln
        file_data.seek(0, 2)  # Ans Ende
        file_size = file_data.tell()
        file_data.seek(0)  # Zurück zum Anfang
        
        # Upload
        client.put_object(
            bucket_name=safespace_settings.minio_bucket_media,
            object_name=object_name,
            data=file_data,
            length=file_size,
            content_type=content_type
        )
        
        return object_name
    
    @classmethod
    def get_media_url(cls, object_path: str, expires_hours: int = 24) -> str:
        """Generiert Pre-signed URL für Media-Zugriff"""
        from datetime import timedelta
        
        client = cls.get_client()
        url = client.presigned_get_object(
            bucket_name=safespace_settings.minio_bucket_media,
            object_name=object_path,
            expires=timedelta(hours=expires_hours)
        )
        return url
    
    @classmethod
    def delete_media(cls, object_path: str) -> bool:
        """Löscht Media-Datei"""
        try:
            client = cls.get_client()
            client.remove_object(
                bucket_name=safespace_settings.minio_bucket_media,
                object_name=object_path
            )
            return True
        except S3Error:
            return False
    
    @classmethod
    def _get_media_type(cls, content_type: str) -> str:
        """Mappt Content-Type zu Ordner"""
        if content_type.startswith("image/"):
            return "images"
        elif content_type.startswith("video/"):
            return "videos"
        elif content_type.startswith("audio/"):
            return "audio"
        return "other"
    
    # === Moderation Report Operations ===
    
    @classmethod
    def store_moderation_report(cls, report: ModerationReport) -> str:
        """
        Speichert Moderation Report als JSON in MinIO.
        Returns: Object path
        """
        client = cls.get_client()
        
        # Pfad: reports/YYYY/MM/DD/report_id.json
        date = report.processed_at
        object_name = f"reports/{date.year}/{date.month:02d}/{date.day:02d}/{report.report_id}.json"
        
        # JSON serialisieren
        json_data = report.model_dump_json(indent=2)
        json_bytes = json_data.encode('utf-8')
        
        # Upload
        client.put_object(
            bucket_name=safespace_settings.minio_bucket_moderation,
            object_name=object_name,
            data=io.BytesIO(json_bytes),
            length=len(json_bytes),
            content_type="application/json"
        )
        
        return object_name
    
    @classmethod
    def get_moderation_report(cls, object_path: str) -> ModerationReport | None:
        """Lädt Moderation Report aus MinIO"""
        try:
            client = cls.get_client()
            response = client.get_object(
                bucket_name=safespace_settings.minio_bucket_moderation,
                object_name=object_path
            )
            json_data = response.read().decode('utf-8')
            return ModerationReport.model_validate_json(json_data)
        except S3Error:
            return None
    
    @classmethod
    def list_reports_by_date(
        cls,
        year: int,
        month: int = None,
        day: int = None
    ) -> list[str]:
        """Listet alle Reports für einen Zeitraum"""
        client = cls.get_client()
        
        prefix = f"reports/{year}/"
        if month:
            prefix += f"{month:02d}/"
            if day:
                prefix += f"{day:02d}/"
        
        objects = client.list_objects(
            bucket_name=safespace_settings.minio_bucket_moderation,
            prefix=prefix,
            recursive=True
        )
        
        return [obj.object_name for obj in objects]
    
    @classmethod
    def list_reports_by_user(cls, user_uid: int, limit: int = 100) -> list[str]:
        """
        Listet Reports für einen User.
        Hinweis: Ineffizient bei vielen Reports - besser mit DB-Index lösen.
        """
        # TODO: Für Production sollte es einen Index in PostgreSQL geben
        # der auf MinIO-Pfade verweist
        client = cls.get_client()
        
        all_reports = client.list_objects(
            bucket_name=safespace_settings.minio_bucket_moderation,
            prefix="reports/",
            recursive=True
        )
        
        user_reports = []
        for obj in all_reports:
            if len(user_reports) >= limit:
                break
            # Report laden und User prüfen (ineffizient!)
            report = cls.get_moderation_report(obj.object_name)
            if report and report.post.author_uid == user_uid:
                user_reports.append(obj.object_name)
        
        return user_reports
