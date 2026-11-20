"""
Configuration settings for the unified parser service
"""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Service Configuration
    service_name: str = "unified-parser-service"
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = environment == "development"
    port: int = int(os.getenv("PORT", "8002"))
    
    # File Processing
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    max_file_size_bytes: int = max_file_size_mb * 1024 * 1024
    allowed_extensions: List[str] = [
        "pdf", "docx", "doc", "pptx", "ppt", 
        "txt", "jpg", "jpeg", "png", "xlsx", "xls"
    ]
    
    # Database
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    
    # Redis Cache
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    cache_ttl: int = int(os.getenv("CACHE_TTL", "3600"))  # 1 hour
    
    # OCR Configuration
    enable_ocr: bool = os.getenv("ENABLE_OCR", "true").lower() == "true"
    ocr_languages: List[str] = os.getenv("OCR_LANGUAGES", "en").split(",") if os.getenv("OCR_LANGUAGES") else ["en"]
    ocr_gpu: bool = os.getenv("OCR_GPU", "false").lower() == "true"
    
    # NLP Configuration
    spacy_model: str = os.getenv("SPACY_MODEL", "en_core_web_sm")
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "100"))
    
    # API Security
    api_key: str = os.getenv("API_KEY", "your-secure-api-key-here")
    
    # CORS
    cors_origins: List[str] = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:3000,http://localhost:3001"
    ).split(",")
    
    # API Keys (optional)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    
    # Existing PPTX Service (deprecated - now using internal parser)
    pptx_service_url: str = os.getenv("PPTX_SERVICE_URL", "http://localhost:8001")
    use_external_pptx: bool = os.getenv("USE_EXTERNAL_PPTX", "false").lower() == "true"
    
    class Config:
        case_sensitive = False
        env_file = ".env"


settings = Settings()
