#!/bin/bash

# Start the service without OCR functionality
echo "Starting Unified Parser Service (OCR disabled)..."
echo "================================================"

# Activate virtual environment
source venv/bin/activate

# Set environment variable to disable OCR
export ENABLE_OCR=false

# Create a minimal .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating minimal .env file..."
    cat > .env << EOF
# Minimal configuration for testing
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
ENABLE_OCR=false
USE_EXTERNAL_PPTX=false
LOG_LEVEL=INFO
API_KEY=your-secure-api-key-here
EOF
fi

# Start the service
echo "Starting service on port 8002..."
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload