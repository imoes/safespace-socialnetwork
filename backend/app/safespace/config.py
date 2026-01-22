from pydantic_settings import BaseSettings


class SafeSpaceSettings(BaseSettings):
    # Kafka
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_topic_new_posts: str = "safespace.posts.new"
    kafka_topic_moderated: str = "safespace.posts.moderated"
    kafka_consumer_group: str = "safespace-moderator"
    
    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket_media: str = "socialnet-media"
    minio_bucket_moderation: str = "safespace-reports"
    minio_use_ssl: bool = False
    
    # DeepSeek API
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"
    
    # Moderation Settings
    moderation_enabled: bool = True
    auto_flag_threshold: float = 0.7  # Ab diesem Score wird geflaggt
    auto_block_threshold: float = 0.9  # Ab diesem Score wird blockiert
    
    class Config:
        env_file = ".env"
        env_prefix = "SAFESPACE_"


safespace_settings = SafeSpaceSettings()
