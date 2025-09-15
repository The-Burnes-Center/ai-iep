import os
import boto3
import logging
import requests
import json
import urllib.parse
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_mistral_api_key():
    """
    Retrieves the Mistral API key from the environment variable.
    The Lambda function should have already set this from SSM Parameter Store.
    Returns:
        str: The Mistral API key.
    """
    # Get from environment - Lambda should have already set this
    mistral_api_key = os.environ.get('MISTRAL_API_KEY')
    
    if mistral_api_key:
        logger.info(f"MISTRAL_API_KEY found (length: {len(mistral_api_key)})")
        logger.info(f"MISTRAL_API_KEY starts with: {mistral_api_key[:10]}...")
    else:
        logger.error("MISTRAL_API_KEY not found in environment variables - CDK should pass this directly")
        logger.error(f"Available environment variables: {list(os.environ.keys())}")
        
    return mistral_api_key

def process_document_with_mistral_ocr(bucket, key):
    """
    Process a document from S3 using Mistral's OCR API.
    
    Args:
        bucket (str): S3 bucket name
        key (str): S3 object key for the document
        
    Returns:
        dict: OCR processing results from Mistral
    """
    api_key = get_mistral_api_key()
    if not api_key:
        logger.error("Mistral API key not available, cannot process document")
        return {"error": "Mistral API key not available"}
    
    # Ensure the key is properly URL decoded
    try:
        # The key might already be decoded from the lambda_function.py
        # Let's make sure it's encoded properly for S3 access
        decoded_key = urllib.parse.unquote_plus(key)
        
        # Check if the key and decoded key are different
        if key != decoded_key:
            logger.info(f"Key was URL encoded. Original: {key}, Decoded: {decoded_key}")
            key = decoded_key
            
        logger.info(f"Downloading document from S3: s3://{bucket}/{key}")
        s3_client = boto3.client('s3')
        
        # Try with the key as is
        try:
            response = s3_client.get_object(Bucket=bucket, Key=key)
            file_content = response['Body'].read()
        except s3_client.exceptions.NoSuchKey:
            # If original key fails, try with the encoded version
            logger.info(f"Key not found, trying with URL encoded version")
            encoded_key = urllib.parse.quote_plus(key)
            logger.info(f"Trying encoded key: {encoded_key}")
            try:
                response = s3_client.get_object(Bucket=bucket, Key=encoded_key)
                file_content = response['Body'].read()
                # If this works, update the key for later use
                key = encoded_key
            except s3_client.exceptions.NoSuchKey:
                # If that fails too, try with just the filename
                logger.info(f"Encoded key not found, trying just with filename")
                filename = key.split('/')[-1]
                try:
                    response = s3_client.get_object(Bucket=bucket, Key=filename)
                    file_content = response['Body'].read()
                    # If this works, update the key for later use
                    key = filename
                except:
                    # If all attempts fail, raise the original error
                    raise
        
        # Get the file name from the key
        filename = key.split('/')[-1]
        logger.info(f"Successfully downloaded file: {filename} ({len(file_content)} bytes)")
    except Exception as e:
        logger.error(f"Error downloading file from S3: {str(e)}")
        return {"error": f"Error downloading file from S3: {str(e)}"}
    
    # Set up headers for Mistral API requests
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    # Step 1: Upload the file to Mistral
    try:
        logger.info(f"Uploading file to Mistral: {filename}")
        
        upload_url = "https://api.mistral.ai/v1/files"
        files = {
            'file': (filename, file_content, 'application/pdf')
        }
        data = {
            'purpose': 'ocr'
        }
        
        upload_response = requests.post(
            upload_url,
            headers=headers,
            files=files,
            data=data
        )
        upload_response.raise_for_status()
        upload_result = upload_response.json()
        
        file_id = upload_result.get('id')
        if not file_id:
            logger.error(f"File upload failed: {upload_result}")
            return {"error": "Failed to get file ID from upload response"}
        
        logger.info(f"File successfully uploaded to Mistral with ID: {file_id}")
    except Exception as e:
        logger.error(f"Error uploading file to Mistral: {str(e)}")
        return {"error": f"Error uploading file to Mistral: {str(e)}"}
    
    # Step 2: Get a signed URL for the uploaded file
    try:
        logger.info(f"Getting signed URL for file ID: {file_id}")
        
        signed_url_endpoint = f"https://api.mistral.ai/v1/files/{file_id}/url"
        params = {
            'expiry': 24  # URL expiry in hours
        }
        
        signed_url_response = requests.get(
            signed_url_endpoint,
            headers=headers,
            params=params
        )
        signed_url_response.raise_for_status()
        signed_url_result = signed_url_response.json()
        
        signed_url = signed_url_result.get('url')
        if not signed_url:
            logger.error(f"Failed to get signed URL: {signed_url_result}")
            return {"error": "Failed to get signed URL from response"}
        
        logger.info(f"Successfully obtained signed URL for file ID: {file_id}")
    except Exception as e:
        logger.error(f"Error getting signed URL from Mistral: {str(e)}")
        return {"error": f"Error getting signed URL from Mistral: {str(e)}"}
    
    # Step 3: Process the document with Mistral OCR API using the signed URL
    try:
        logger.info(f"Processing document with Mistral OCR API using signed URL")
        
        ocr_endpoint = "https://api.mistral.ai/v1/ocr"
        ocr_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        # Create request payload for Mistral OCR API
        ocr_payload = {
            "model": "mistral-ocr-latest",
            "document": {
                "type": "document_url",
                "document_url": signed_url
            },
            "include_image_base64": False  # Set to true if you need images
        }
        
        ocr_response = requests.post(
            ocr_endpoint,
            headers=ocr_headers,
            json=ocr_payload
        )
        
        ocr_response.raise_for_status()
        ocr_result = ocr_response.json()
        
        logger.info(f"Successfully processed document with Mistral OCR API")
        return ocr_result
    except Exception as e:
        logger.error(f"Error calling Mistral OCR API: {str(e)}")
        return {"error": str(e)}

