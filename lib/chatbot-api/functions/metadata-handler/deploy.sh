#!/bin/bash
# Deploy script for Google Cloud Document AI dependencies

# Create a temp directory for building
mkdir -p /tmp/docai_build
cd /tmp/docai_build

# Install required packages into a local directory
python3 -m pip install -r requirements.txt -t ./package

# Create zip file with dependencies
cd package
zip -r9 ../docai-layer.zip .

echo "Created Lambda layer zip file at /tmp/docai_build/docai-layer.zip"
echo "You can upload this file as a Lambda layer in the AWS console"
echo "Then attach the layer to your Lambda function"

# Note for CDK deployment:
# In your CDK code, you can add the layer to your Lambda function like this:
# const googleCloudLayer = new lambda.LayerVersion(this, 'GoogleCloudLayer', {
#   code: lambda.Code.fromAsset('/path/to/docai-layer.zip'),
#   compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
#   description: 'Google Cloud Document AI dependencies',
# });
# 
# metadataHandlerFunction.addLayers(googleCloudLayer); 