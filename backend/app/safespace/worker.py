"""
SafeSpace Moderation Worker

Dieser Worker:
1. Konsumiert neue Posts aus Kafka
2. Moderiert sie mit DeepSeek
3. Speichert Reports in MinIO
4. Publiziert Ergebnisse zurück nach Kafka

Starten mit:
    python -m app.safespace.worker
"""

import asyncio
import uuid
from datetime import datetime

from app.safespace.config import safespace_settings
from app.safespace.models import PostMessage, ModerationReport
from app.safespace.kafka_service import KafkaService, PostModerationQueue
from app.safespace.deepseek_moderator import DeepSeekModerator
from app.safespace.minio_service import MinIOService


class SafeSpaceWorker:
    """
    Worker-Prozess für die Moderation Pipeline.
    """
    
    def __init__(self):
        self.processed_count = 0
        self.error_count = 0
        self.start_time = None
    
    async def run(self):
        """Startet den Worker"""
        print("🛡️  SafeSpace Moderation Worker startet...")
        print(f"   Kafka: {safespace_settings.kafka_bootstrap_servers}")
        print(f"   MinIO: {safespace_settings.minio_endpoint}")
        print(f"   DeepSeek Model: {safespace_settings.deepseek_model}")
        print()
        
        self.start_time = datetime.utcnow()
        
        try:
            # Kafka Consumer starten
            await KafkaService.consume_new_posts(
                handler=self.process_post
            )
        except KeyboardInterrupt:
            print("\n👋 Worker wird beendet...")
        finally:
            await KafkaService.close_producer()
            self._print_stats()
    
    async def process_post(self, post: PostMessage):
        """Verarbeitet einen einzelnen Post"""
        received_at = datetime.utcnow()
        
        try:
            print(f"\n{'='*60}")
            print(f"📝 Moderiere Post {post.post_id}")
            print(f"   Von: {post.author_username} (UID: {post.author_uid})")
            print(f"   Content: {post.content[:100]}...")
            
            # Mit DeepSeek moderieren
            result = await DeepSeekModerator.moderate_post(post)
            
            processed_at = datetime.utcnow()
            processing_time = int((processed_at - received_at).total_seconds() * 1000)
            
            # Report erstellen
            report = ModerationReport(
                report_id=str(uuid.uuid4()),
                post=post,
                result=result,
                model_used=safespace_settings.deepseek_model,
                received_at=received_at,
                processed_at=processed_at,
                processing_time_ms=processing_time
            )
            
            # In MinIO speichern
            report_path = MinIOService.store_moderation_report(report)
            
            # Ergebnis nach Kafka publizieren
            await PostModerationQueue.publish_result(result)
            
            # Logging
            self._log_result(result, processing_time, report_path)
            self.processed_count += 1
            
        except Exception as e:
            print(f"❌ Fehler bei Post {post.post_id}: {e}")
            self.error_count += 1
    
    def _log_result(self, result, processing_time: int, report_path: str):
        """Loggt das Moderations-Ergebnis"""
        status_emoji = {
            "approved": "✅",
            "flagged": "⚠️",
            "blocked": "🚫",
            "pending": "⏳",
            "modified": "✏️"
        }
        
        emoji = status_emoji.get(result.status.value, "❓")
        
        print(f"\n   {emoji} Status: {result.status.value.upper()}")
        print(f"   📊 Confidence: {result.confidence_score:.2%}")
        
        if result.categories:
            cats = ", ".join(c.value for c in result.categories)
            print(f"   🏷️  Kategorien: {cats}")
        
        print(f"   💬 Erklärung: {result.explanation[:100]}...")
        
        if result.suggested_revision:
            print(f"   ✏️  Vorschlag: {result.suggested_revision[:100]}...")
        
        if result.requires_human_review:
            print(f"   👀 Menschliche Überprüfung erforderlich!")
        
        print(f"   ⏱️  Verarbeitung: {processing_time}ms")
        print(f"   📁 Report: {report_path}")
    
    def _print_stats(self):
        """Gibt Statistiken aus"""
        if not self.start_time:
            return
        
        runtime = datetime.utcnow() - self.start_time
        
        print(f"\n{'='*60}")
        print("📊 Worker Statistiken:")
        print(f"   Laufzeit: {runtime}")
        print(f"   Verarbeitet: {self.processed_count}")
        print(f"   Fehler: {self.error_count}")
        
        if self.processed_count > 0:
            success_rate = (self.processed_count - self.error_count) / self.processed_count
            print(f"   Erfolgsrate: {success_rate:.2%}")


async def main():
    """Entry Point"""
    worker = SafeSpaceWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
