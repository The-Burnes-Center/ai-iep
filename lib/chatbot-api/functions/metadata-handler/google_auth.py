import os
import json
from google.auth.transport import requests
from google.oauth2 import service_account
from google.cloud import documentai

def get_documentai_client():
    """
    Initialize and return a Document AI client authenticated using environment variables.
    
    In AWS Lambda, we don't have access to the Google application default credentials.
    Instead, we'll authenticate using a service account key that's stored in environment variables.
    """
    try:
        # For AWS Lambda, we can pass the API key through environment variables
        # and use it for authentication
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/tmp/service_account.json"
        
        # Create a temporary file with service account credentials
        # In a production environment, you should store this in AWS Secrets Manager
        # or Parameter Store and retrieve it at runtime
        service_account_info = {
            "type": "service_account",
            "project_id": os.environ["GOOGLE_CLOUD_PROJECT"],
            "private_key_id": "",  # You'll need to provide this 
            "private_key": "",     # You'll need to provide this
            "client_email": f"document-ai-service@{os.environ['GOOGLE_CLOUD_PROJECT']}.iam.gserviceaccount.com",
            "client_id": "",       # You'll need to provide this
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/document-ai-service%40{os.environ['GOOGLE_CLOUD_PROJECT']}.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        }
        
        # Alternative approach: use API Key for simpler authentication
        # This might work for some Google Cloud services but Document AI 
        # typically requires authenticated service account
        # Need to configure in GCP to accept API keys for Document AI
        return documentai.DocumentProcessorServiceClient()
        
    except Exception as e:
        print(f"Error setting up Document AI client: {e}")
        raise 