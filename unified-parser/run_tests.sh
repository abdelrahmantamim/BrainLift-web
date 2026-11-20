#!/bin/bash
# Test runner script for unified parser

echo "Running Unified Parser Tests"
echo "============================"

# Run all tests with coverage
echo "Running all tests with coverage..."
pytest --cov=app --cov-report=html --cov-report=term

# Run specific test suites
if [ "$1" == "pptx" ]; then
    echo "Running PPTX parser tests..."
    pytest tests/test_pptx_parser.py -v
elif [ "$1" == "pdf" ]; then
    echo "Running PDF parser tests..."
    pytest tests/test_pdf_parser.py -v
elif [ "$1" == "docx" ]; then
    echo "Running DOCX parser tests..."
    pytest tests/test_docx_parser.py -v
elif [ "$1" == "image" ]; then
    echo "Running Image parser tests..."
    pytest tests/test_image_parser.py -v
elif [ "$1" == "fast" ]; then
    echo "Running fast tests only..."
    pytest -m "not slow" -v
fi

echo "Test run complete!"