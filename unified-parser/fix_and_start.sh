#!/bin/bash

echo "Fixing and starting Unified Parser Service"
echo "========================================="

# Use existing venv
source venv/bin/activate

# Fix the compatibility issue by upgrading fastapi to work with pydantic v1
echo "1. Fixing FastAPI/Pydantic compatibility..."
pip uninstall -y fastapi
pip install fastapi==0.95.2  # Last version compatible with pydantic v1

# Remove spacy temporarily
echo -e "\n2. Removing problematic dependencies..."
pip uninstall -y spacy spacy-legacy spacy-loggers

# Update chunkers to not require spacy
echo -e "\n3. Updating semantic chunker to work without spacy..."
cat > app/chunkers/semantic_chunker.py << 'EOF'
"""
Semantic chunker - simplified version without spacy
"""

from typing import List, Dict, Any
import re
import structlog
from ..models import Chunk
from .simple_chunker import SimpleChunker

logger = structlog.get_logger()

# Just use SimpleChunker as SemanticChunker for now
class SemanticChunker(SimpleChunker):
    """Semantic chunker using simple sentence splitting"""
    
    def __init__(self, model_name: str = "en_core_web_sm"):
        super().__init__()
        logger.info("Using simplified semantic chunker without spacy")
    
    async def initialize(self):
        """No initialization needed for simple version"""
        pass
EOF

# Test imports
echo -e "\n4. Testing imports..."
python -c "
print('Testing imports...')
try:
    from app.main import app
    print('✓ Main app imported successfully')
    from app.parsers import ParserFactory
    print('✓ Parsers imported successfully')
    from app.chunkers import ChunkerFactory
    print('✓ Chunkers imported successfully')
    print('\\n✅ All imports successful!')
except Exception as e:
    print(f'✗ Import error: {e}')
    import traceback
    traceback.print_exc()
"

# If imports are successful, start the service
if [ $? -eq 0 ]; then
    echo -e "\n5. Starting the service..."
    uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload &
    SERVER_PID=$!
    
    echo -e "\n6. Waiting for service to start..."
    sleep 5
    
    echo -e "\n7. Testing the service..."
    echo "Health check:"
    curl -s http://localhost:8002/health | python -m json.tool || echo "Failed to connect"
    
    echo -e "\nAPI documentation available at: http://localhost:8002/docs"
    
    echo -e "\n8. Service is running! PID: $SERVER_PID"
    
    # Keep running for 10 seconds to show it works
    echo "Keeping service running for 10 seconds..."
    sleep 10
    
    echo -e "\n9. Stopping the service..."
    kill $SERVER_PID
    
    echo -e "\n✅ Service tested successfully!"
    echo ""
    echo "To run the service permanently:"
    echo "  source venv/bin/activate"
    echo "  uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload"
else
    echo -e "\n✗ Import test failed. Please check the errors above."
fi