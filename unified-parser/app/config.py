"""
Configuration settings for the unified parser service
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, computed_field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore'  # Ignore extra fields in .env
    )
    
    # Service Configuration
    service_name: str = Field(default="unified-parser-service")
    environment: str = Field(default="development")
    debug: bool = Field(default=True)
    port: int = Field(default=8002)
    
    # File Processing
    max_file_size_mb: int = Field(default=50)
    allowed_extensions: List[str] = Field(default=[
        "pdf", "docx", "doc", "pptx", "ppt", 
        "txt", "jpg", "jpeg", "png", "xlsx", "xls"
    ])
    
    # Database
    supabase_url: str = Field(default="")
    supabase_anon_key: str = Field(default="")
    supabase_service_key: str = Field(default="")
    
    # Redis Cache
    redis_url: Optional[str] = Field(default="redis://localhost:6379")
    cache_ttl: int = Field(default=3600)
    
    # OCR Configuration
    enable_ocr: bool = Field(default=True)
    ocr_gpu: bool = Field(default=False)
    ocr_languages_str: str = Field(default="en,ar", alias="ocr_languages")
    
    @computed_field
    @property
    def ocr_languages(self) -> List[str]:
        """Get OCR languages as a list"""
        return [lang.strip() for lang in self.ocr_languages_str.split(",") if lang.strip()]
    
    @computed_field
    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024
    
    # NLP Configuration
    spacy_model: str = Field(default="en_core_web_sm")
    chunk_overlap: int = Field(default=100)
    
    # API Security
    api_key: str = Field(default="your-secure-api-key-here")
    
    # Logging
    log_level: str = Field(default="INFO")
    
    # Chunking
    chunk_size: int = Field(default=1000)
    
    # CORS
    cors_origins: List[str] = Field(default=["http://localhost:3000", "http://localhost:3001"])
    
    # API Keys (optional)
    openai_api_key: Optional[str] = Field(default="")
    
    # Existing PPTX Service
    pptx_service_url: str = Field(default="http://localhost:8001")
    use_external_pptx: bool = Field(default=False)


# Create settings instance
settings = Settings()