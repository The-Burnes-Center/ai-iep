#!/bin/bash

# Build Lambda Layer for Python Dependencies
# This script creates a Lambda layer with all the Python dependencies from requirements.txt

set -e

echo "Building Python dependencies layer for metadata-handler..."

# Create temporary directory for layer build
LAYER_DIR="python-deps-layer"
PYTHON_DIR="$LAYER_DIR/python"

# Clean up any existing layer directory
rm -rf $LAYER_DIR

# Create layer directory structure
mkdir -p $PYTHON_DIR

# Install minimal dependencies first (just the ones causing import errors)
echo "Installing minimal Python dependencies..."
pip3 install -r requirements-minimal.txt -t $PYTHON_DIR

# Install all dependencies locally (this will work on macOS and include everything)
echo "Installing all dependencies..."
pip3 install -r requirements.txt -t $PYTHON_DIR --upgrade

# Remove unnecessary files to reduce layer size
echo "Cleaning up unnecessary files..."
find $PYTHON_DIR -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find $PYTHON_DIR -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
find $PYTHON_DIR -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find $PYTHON_DIR -name "*.pyc" -delete 2>/dev/null || true
find $PYTHON_DIR -name "*.pyo" -delete 2>/dev/null || true

# Create zip file for the layer
echo "Creating layer zip file..."
cd $LAYER_DIR
zip -r ../python-deps-layer.zip . -q

cd ..
rm -rf $LAYER_DIR

echo "Layer created successfully: python-deps-layer.zip"
echo "Layer size: $(du -h python-deps-layer.zip | cut -f1)" 