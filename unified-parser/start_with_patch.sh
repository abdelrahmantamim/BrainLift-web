#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Apply Pillow compatibility patch if needed
export PYTHONPATH="${PYTHONPATH}:."
python -c "
import PIL.Image
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS
"

# Start the service
echo "Starting Unified Parser Service..."
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
