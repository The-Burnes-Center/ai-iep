#!/bin/bash

# Build Lambda Layer for Python Dependencies using Docker
# This ensures compatibility with AWS Lambda's Linux x86_64 environment

set -e

echo "Building Python dependencies layer for metadata-handler using Docker..."

# Clean up any existing layer files
rm -rf python-deps-layer python-deps-layer.zip

# Create Dockerfile for building the layer
cat > Dockerfile.layer << 'EOF'
FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies that might be needed
RUN dnf update -y && dnf install -y gcc

# Set working directory
WORKDIR /var/task

# Copy requirements file
COPY requirements.txt .

# Create layer directory structure
RUN mkdir -p /opt/python

# Install dependencies to the layer directory
RUN pip install -r requirements.txt -t /opt/python --no-cache-dir

# Clean up unnecessary files to reduce layer size
RUN find /opt/python -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
RUN find /opt/python -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
RUN find /opt/python -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
RUN find /opt/python -name "*.pyc" -delete 2>/dev/null || true
RUN find /opt/python -name "*.pyo" -delete 2>/dev/null || true

# Create the final layer structure
RUN mkdir -p /tmp/layer/python
RUN cp -r /opt/python/* /tmp/layer/python/

# Set the working directory to the layer
WORKDIR /tmp/layer
EOF

echo "Building Docker image for layer creation..."
docker build -f Dockerfile.layer -t lambda-layer-builder .

echo "Extracting layer from Docker container..."
# Create container and copy the layer out
CONTAINER_ID=$(docker create lambda-layer-builder)
docker cp $CONTAINER_ID:/tmp/layer ./python-deps-layer
docker rm $CONTAINER_ID

echo "Creating layer zip file..."
cd python-deps-layer
zip -r ../python-deps-layer.zip . -q

cd ..
rm -rf python-deps-layer
rm -f Dockerfile.layer

echo "Layer created successfully: python-deps-layer.zip"
echo "Layer size: $(du -h python-deps-layer.zip | cut -f1)" 