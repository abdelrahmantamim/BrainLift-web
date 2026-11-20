#!/bin/bash
set -e

# Start the FastAPI application
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8002 \
    --reload \
    --access-log