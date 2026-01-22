import json
import asyncio
from datetime import datetime
from typing import Callable, Awaitable

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from aiokafka.errors import KafkaError

from app.safespace.config import safespace_settings
from app.safespace.models import PostMessage, ModerationResult


class KafkaService:
    """
    Kafka Service für Post-Moderation Pipeline.
    
    Topics:
    - safespace.posts.new: Neue Posts zur Moderation
    - safespace.posts.moderated: Moderierte Posts mit Ergebnis
    """
    
    _producer: AIOKafkaProducer = None
    _consumer: AIOKafkaConsumer = None
    
    # === Producer ===
    
    @classmethod
    async def init_producer(cls):
        """Initialisiert Kafka Producer"""
        if cls._producer is None:
            cls._producer = AIOKafkaProducer(
                bootstrap_servers=safespace_settings.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
                key_serializer=lambda k: str(k).encode('utf-8') if k else None
            )
            await cls._producer.start()
            print("✅ Kafka Producer gestartet")
    
    @classmethod
    async def close_producer(cls):
        """Schließt Kafka Producer"""
        if cls._producer:
            await cls._producer.stop()
            cls._producer = None
    
    @classmethod
    async def publish_new_post(cls, post: PostMessage) -> bool:
        """
        Publiziert neuen Post zur Moderation.
        Key = post_id für Partitionierung
        """
        try:
            await cls.init_producer()
            
            await cls._producer.send_and_wait(
                topic=safespace_settings.kafka_topic_new_posts,
                key=post.post_id,
                value=post.model_dump()
            )
            
            print(f"📤 Post {post.post_id} zur Moderation gesendet")
            return True
            
        except KafkaError as e:
            print(f"❌ Kafka Error: {e}")
            return False
    
    @classmethod
    async def publish_moderation_result(cls, result: ModerationResult) -> bool:
        """Publiziert Moderations-Ergebnis"""
        try:
            await cls.init_producer()
            
            await cls._producer.send_and_wait(
                topic=safespace_settings.kafka_topic_moderated,
                key=result.post_id,
                value=result.model_dump()
            )
            
            print(f"📤 Moderation für Post {result.post_id} publiziert: {result.status}")
            return True
            
        except KafkaError as e:
            print(f"❌ Kafka Error: {e}")
            return False
    
    # === Consumer ===
    
    @classmethod
    async def consume_new_posts(
        cls,
        handler: Callable[[PostMessage], Awaitable[None]],
        max_messages: int = None
    ):
        """
        Konsumiert neue Posts und ruft Handler auf.
        
        Args:
            handler: Async Funktion die PostMessage verarbeitet
            max_messages: Optional - stoppt nach N Messages (für Tests)
        """
        consumer = AIOKafkaConsumer(
            safespace_settings.kafka_topic_new_posts,
            bootstrap_servers=safespace_settings.kafka_bootstrap_servers,
            group_id=safespace_settings.kafka_consumer_group,
            value_deserializer=lambda v: json.loads(v.decode('utf-8')),
            auto_offset_reset='earliest',
            enable_auto_commit=True
        )
        
        await consumer.start()
        print(f"✅ Consumer gestartet für Topic: {safespace_settings.kafka_topic_new_posts}")
        
        try:
            message_count = 0
            async for message in consumer:
                try:
                    post = PostMessage.model_validate(message.value)
                    print(f"📥 Post {post.post_id} empfangen von User {post.author_username}")
                    
                    await handler(post)
                    
                    message_count += 1
                    if max_messages and message_count >= max_messages:
                        break
                        
                except Exception as e:
                    print(f"❌ Error processing message: {e}")
                    
        finally:
            await consumer.stop()
    
    @classmethod
    async def consume_moderated_posts(
        cls,
        handler: Callable[[ModerationResult], Awaitable[None]]
    ):
        """
        Konsumiert moderierte Posts.
        Kann z.B. für Notifications oder DB-Updates genutzt werden.
        """
        consumer = AIOKafkaConsumer(
            safespace_settings.kafka_topic_moderated,
            bootstrap_servers=safespace_settings.kafka_bootstrap_servers,
            group_id=f"{safespace_settings.kafka_consumer_group}-results",
            value_deserializer=lambda v: json.loads(v.decode('utf-8')),
            auto_offset_reset='earliest'
        )
        
        await consumer.start()
        print(f"✅ Consumer gestartet für Topic: {safespace_settings.kafka_topic_moderated}")
        
        try:
            async for message in consumer:
                try:
                    result = ModerationResult.model_validate(message.value)
                    await handler(result)
                except Exception as e:
                    print(f"❌ Error processing result: {e}")
        finally:
            await consumer.stop()


class PostModerationQueue:
    """
    High-Level Interface für die Post-Moderation Queue.
    Wird vom Feed-Service aufgerufen.
    """
    
    @classmethod
    async def enqueue_post(
        cls,
        post_id: int,
        author_uid: int,
        author_username: str,
        content: str,
        media_paths: list[str] = None,
        visibility: str = "friends"
    ) -> bool:
        """
        Fügt Post zur Moderation-Queue hinzu.
        Wird nach dem Erstellen eines Posts aufgerufen.
        """
        post = PostMessage(
            post_id=post_id,
            author_uid=author_uid,
            author_username=author_username,
            content=content,
            media_paths=media_paths or [],
            visibility=visibility,
            created_at=datetime.utcnow()
        )
        
        return await KafkaService.publish_new_post(post)
    
    @classmethod
    async def publish_result(cls, result: ModerationResult) -> bool:
        """Publiziert Moderations-Ergebnis"""
        return await KafkaService.publish_moderation_result(result)
