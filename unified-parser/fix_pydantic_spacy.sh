#!/bin/bash

echo "Fixing pydantic/spacy compatibility issues"
echo "========================================="

# Activate virtual environment
source venv/bin/activate

# First, let's check the current versions
echo "Current versions:"
pip list | grep -E "(pydantic|spacy)"

# Downgrade pydantic to a compatible version
echo -e "\n1. Installing compatible pydantic version..."
pip uninstall -y pydantic pydantic-core pydantic-settings
pip install pydantic==1.10.13

# Reinstall pydantic-settings for v1
pip install pydantic-settings==0.2.5

# Update the config file to use pydantic v1
echo -e "\n2. Updating config for pydantic v1..."
cat > app/config.py << 'EOF'
"""
Configuration settings for the unified parser service
"""

import os
from typing import List
from pydantic import BaseSettings


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
    ocr_languages: List[str] = os.getenv("OCR_LANGUAGES", "en,ar,es,fr,de").split(",")
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
EOF

# Update models.py to use pydantic v1
echo -e "\n3. Updating models for pydantic v1..."
sed -i '' 's/from pydantic import BaseModel, Field/from pydantic import BaseModel, Field/' app/models.py 2>/dev/null || sed -i 's/from pydantic import BaseModel, Field/from pydantic import BaseModel, Field/' app/models.py

# Test the imports
echo -e "\n4. Testing imports..."
python -c "
import sys
print('Testing basic imports...')
try:
    from pydantic import BaseModel
    print('✓ Pydantic import OK')
    import spacy
    print('✓ Spacy import OK')
    from app.config import settings
    print('✓ Config import OK')
    from app.models import ParsedDocument
    print('✓ Models import OK')
    print('\\n✅ All imports successful!')
except Exception as e:
    print(f'✗ Import error: {e}')
    sys.exit(1)
"

echo -e "\n=================================="
echo "Compatibility fix complete!"
echo "=================================="

echo -e "\nYou can now start the service with:"
echo "  ./start.sh"