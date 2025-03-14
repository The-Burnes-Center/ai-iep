import os
# Add Lambda layer path to Python path
import sys
# Ensure the Lambda layer path is at the front of the path list
if '/opt/python' not in sys.path:
    sys.path.insert(0, '/opt/python')

import json
import base64
import boto3
import traceback
import requests
import time
import io

# Disable SSL warnings - only use this in development/testing environments
# This is necessary since we're disabling SSL verification due to Lambda SSL issues
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Import PyPDF2 for PDF fallback processing
try:
    import PyPDF2
    PYPDF_AVAILABLE = True
    print("PyPDF2 successfully imported for fallback processing")
except ImportError:
    print("PyPDF2 not available. PDF fallback will be disabled.")
    PYPDF_AVAILABLE = False

def extract_text_from_pdf(pdf_content):
    """
    Extract text from a PDF using PyPDF2 as a fallback method.
    
    Args:
        pdf_content: Binary content of the PDF file
        
    Returns:
        Extracted text as a string, or None if extraction failed
    """
    if not PYPDF_AVAILABLE:
        print("PyPDF2 not available for fallback processing")
        return None
        
    try:
        print("Using PyPDF2 fallback to extract text from PDF")
        pdf_file = io.BytesIO(pdf_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        # Extract text from all pages
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text += page.extract_text() + "\n\n"
            
        if not text.strip():
            print("Warning: PyPDF2 extracted empty text from PDF")
            
        return text
    except Exception as e:
        print(f"Error extracting text with PyPDF2: {e}")
        traceback.print_exc()
        return None

def get_service_account_from_secretsmanager():
    """Retrieve the Google service account credentials from AWS Secrets Manager."""
    try:
        secret_name = os.environ.get('GOOGLE_SERVICE_ACCOUNT_SECRET', 'GoogleDocumentAICredentials')
        print(f"Retrieving Google service account credentials from secret: {secret_name}")
        
        # Create a Secrets Manager client
        secretsmanager = boto3.client('secretsmanager')
        
        # Get the secret value
        response = secretsmanager.get_secret_value(SecretId=secret_name)
        
        # Return the secret as a JSON object
        if 'SecretString' in response:
            secret = response['SecretString']
            creds = json.loads(secret)
            print(f"✅ Successfully retrieved credentials with project_id: {creds.get('project_id')}")
            print(f"✅ Service account email: {creds.get('client_email')}")
            
            # Compare with environment variable
            env_project_id = os.environ.get('DOCUMENT_AI_PROJECT_ID')
            if env_project_id and env_project_id != creds.get('project_id'):
                print(f"⚠️ WARNING: Environment project ID ({env_project_id}) does not match credentials project ID ({creds.get('project_id')})")
            
            return creds
        else:
            print("Secret value is not a string, attempting to decode binary")
            decoded_binary = base64.b64decode(response['SecretBinary'])
            creds = json.loads(decoded_binary)
            print(f"✅ Successfully retrieved binary credentials with project_id: {creds.get('project_id')}")
            return creds
            
    except Exception as e:
        print(f"❌ Error retrieving secret: {e}")
        traceback.print_exc()
        return None

def process_document(project_id, location, processor_id, file_content, mime_type="application/pdf"):
    """
    Process a document using Document AI API directly without using the client library.
    Simplified for Lambda environment to avoid dependency issues.
    Will fallback to PyPDF2 for PDF files if Document AI fails.
    
    Args:
        project_id: Google Cloud project ID
        location: Document AI location (e.g., us-central1)
        processor_id: Document AI processor ID
        file_content: Binary content of the file to process
        mime_type: MIME type of the document (default: application/pdf)
        
    Returns:
        Extracted text from the document, or None if processing failed
    """
    # Log environment variables for debugging
    env_project_id = os.environ.get('DOCUMENT_AI_PROJECT_ID')
    env_location = os.environ.get('DOCUMENT_AI_LOCATION', 'us-central1')
    env_processor_id = os.environ.get('DOCUMENT_AI_PROCESSOR_ID')
    
    print(f"📝 Document AI Environment Configuration:")
    print(f"  - Environment Project ID: {env_project_id}")
    print(f"  - Environment Location: {env_location}")
    print(f"  - Environment Processor ID: {env_processor_id}")
    print(f"  - Function Argument Project ID: {project_id}")
    print(f"  - Function Argument Location: {location}")
    print(f"  - Function Argument Processor ID: {processor_id}")
    
    # Check if the project_id matches the one from secrets
    try:
        service_account = get_service_account_from_secretsmanager()
        if service_account:
            sa_project_id = service_account.get('project_id')
            print(f"📝 Service Account Project ID: {sa_project_id}")
            
            if project_id != sa_project_id:
                print(f"⚠️ WARNING: Function arg project_id ({project_id}) doesn't match service account project_id ({sa_project_id})")
                print(f"⚠️ Attempting to use correct project_id from service account")
                project_id = sa_project_id
    except Exception as sa_error:
        print(f"❌ Error checking service account project ID: {sa_error}")
    
    # Check if we should immediately use PDF fallback for PDFs
    if mime_type.lower() == "application/pdf":
        print("PDF detected, attempting to process with both Document AI and PDF fallback")
    else:
        print(f"Non-PDF file detected ({mime_type}), will only try Document AI")
    
    # First try with Document AI if possible
    try:
        # Try to use Document AI first if we have API key
        api_key = os.environ.get('GOOGLE_API_KEY')
        if api_key:
            print("Using API key authentication for Document AI")
            
            # Base64 encode the file content
            encoded_content = base64.b64encode(file_content).decode('utf-8')
            
            # Construct the request payload
            payload = {
                "rawDocument": {
                    "content": encoded_content,
                    "mimeType": mime_type
                }
            }
            
            # Construct the API URL with API key
            api_url = f"https://{location}-documentai.googleapis.com/v1/projects/{project_id}/locations/{location}/processors/{processor_id}:process?key={api_key}"
            headers = {"Content-Type": "application/json"}
            
            # Make the API request
            print(f"Making Document AI API request with API key to URL: {api_url}")
            response = requests.post(
                api_url, 
                headers=headers, 
                json=payload,
                verify=False  # This is risky, but helps with Lambda environment issues
            )
            
            # Check if the request was successful
            if response.status_code == 200:
                # Extract and return the document text
                result = response.json()
                document_text = result.get("document", {}).get("text", "")
                if document_text:
                    print("✅ Successfully processed document with Document AI")
                    return document_text
                else:
                    print("⚠️ Document AI returned empty text, will try fallback")
            else:
                print(f"❌ Document AI API error: {response.status_code}")
                print(f"❌ Error response: {response.text[:1000]}")  # Print first 1000 chars of response
        else:
            # Try to use service account-based authentication
            service_account = get_service_account_from_secretsmanager()
            if service_account:
                print("💡 No API key found, attempting service account authentication")
                
                try:
                    import google.auth
                    from google.auth.transport.requests import Request
                    from google.oauth2 import service_account
                    
                    # Check if we have the required Google auth libraries
                    print("✅ Required Google auth libraries are available")
                    
                    # Create service account credentials
                    credentials = service_account.Credentials.from_service_account_info(
                        service_account, 
                        scopes=['https://www.googleapis.com/auth/cloud-platform']
                    )
                    
                    # Get an access token
                    credentials.refresh(Request())
                    access_token = credentials.token
                    print(f"✅ Successfully obtained access token: {access_token[:10]}...")
                    
                    # Encode file content as base64
                    encoded_content = base64.b64encode(file_content).decode('utf-8')
                    
                    # Construct the request payload
                    payload = {
                        "rawDocument": {
                            "content": encoded_content,
                            "mimeType": mime_type
                        }
                    }
                    
                    # Use the service account project ID from credentials if available
                    project_id_to_use = service_account.get('project_id', project_id)
                    
                    # Construct the API URL
                    api_url = f"https://{location}-documentai.googleapis.com/v1/projects/{project_id_to_use}/locations/{location}/processors/{processor_id}:process"
                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {access_token}"
                    }
                    
                    # Make the API request
                    print(f"Making Document AI API request with service account to URL: {api_url}")
                    response = requests.post(
                        api_url, 
                        headers=headers, 
                        json=payload,
                        verify=False  # For Lambda environment issues
                    )
                    
                    # Check if the request was successful
                    if response.status_code == 200:
                        # Extract and return the document text
                        result = response.json()
                        document_text = result.get("document", {}).get("text", "")
                        if document_text:
                            print("✅ Successfully processed document with Document AI using service account")
                            return document_text
                        else:
                            print("⚠️ Document AI returned empty text with service account, will try fallback")
                    else:
                        print(f"❌ Document AI API error with service account: {response.status_code}")
                        print(f"❌ Error response: {response.text[:1000]}")
                
                except ImportError as imp_err:
                    print(f"❌ Required Google auth libraries not available: {imp_err}")
                except Exception as auth_err:
                    print(f"❌ Error using service account authentication: {auth_err}")
                    traceback.print_exc()
            else:
                print("❌ No API key available for Document AI and service account retrieval failed")
                        
    except Exception as e:
        print(f"❌ Error using Document AI: {e}")
        traceback.print_exc()
        
    # If we reach here, either Document AI failed or we don't have credentials
    # Try PDF fallback for PDFs
    if mime_type.lower() == "application/pdf":
        print("⚠️ Document AI failed or unavailable, using PDF fallback extraction")
        pdf_text = extract_text_from_pdf(file_content)
        if pdf_text:
            print("✅ Successfully extracted text with PyPDF2 fallback")
            return pdf_text
        else:
            print("❌ PyPDF2 fallback also failed")
    
    # If all methods failed
    return None

def get_documentai_client():
    """
    Returns a simple wrapper to maintain compatibility with existing code.
    This doesn't actually create a client library object, but provides the same interface.
    """
    print("Initializing Document AI REST client...")
    print(f"Python version: {sys.version}")
    
    # Try to get the service account credentials directly
    try:
        service_account = get_service_account_from_secretsmanager()
        if service_account:
            print(f"✅ Successfully retrieved service account credentials for get_documentai_client")
            print(f"  - Service Account Project ID: {service_account.get('project_id')}")
            print(f"  - Service Account Email: {service_account.get('client_email')}")
        else:
            print("⚠️ No service account credentials available for get_documentai_client")
    except Exception as e:
        print(f"❌ Error retrieving service account in get_documentai_client: {e}")
    
    class SimpleDocumentAIClient:
        def __init__(self):
            self.project_id = os.environ.get('DOCUMENT_AI_PROJECT_ID')
            self.location = os.environ.get('DOCUMENT_AI_LOCATION', 'us-central1')
            self.processor_id = os.environ.get('DOCUMENT_AI_PROCESSOR_ID')
            print(f"✅ SimpleDocumentAIClient initialized with:")
            print(f"  - Project ID: {self.project_id}")
            print(f"  - Location: {self.location}")
            print(f"  - Processor ID: {self.processor_id}")
            
        def processor_path(self, project_id, location, processor_id):
            """Just returns the processor path string for compatibility."""
            return f"projects/{project_id}/locations/{location}/processors/{processor_id}"
            
        def process_document(self, request):
            """
            Simplified process_document that calls our direct API function.
            
            Args:
                request: A dictionary containing 'name' and 'raw_document' keys.
                
            Returns:
                An object with a structure matching the expected return value.
            """
            try:
                # Extract parameters from the request
                processor_parts = request.get('name', '').split('/')
                if len(processor_parts) < 6:
                    raise ValueError(f"Invalid processor name format: {request.get('name')}")
                    
                project_id = processor_parts[1]
                location = processor_parts[3]
                processor_id = processor_parts[5]
                
                # Get the document content and mime type
                raw_document = request.get('raw_document', {})
                content_base64 = raw_document.get('content')
                mime_type = raw_document.get('mime_type', 'application/pdf')
                
                # Decode base64 content to bytes
                try:
                    import base64
                    content = base64.b64decode(content_base64)
                    print(f"Successfully decoded base64 content, size: {len(content)} bytes")
                except Exception as e:
                    print(f"Error decoding base64 content: {e}")
                    content = content_base64
                
                # Process the document using our simplified function
                text = process_document(
                    project_id=project_id,
                    location=location,
                    processor_id=processor_id,
                    file_content=content,
                    mime_type=mime_type
                )
                
                if text is None:
                    # If both Document AI and fallback failed
                    raise ValueError("Document processing failed with all methods")
                
                # Create a response object that matches the expected structure
                # and include a new attribute to indicate if text came from fallback
                class DocumentResult:
                    def __init__(self, text, from_fallback=True):
                        self.document = type('Document', (), {'text': text})
                        # Add an extra attribute to indicate text source for the parent function to check
                        self.from_fallback = from_fallback
                        
                # Return result with a flag indicating it came from fallback
                # (All results go through this path since we use REST API with fallback)
                return DocumentResult(text, True)
                
            except Exception as e:
                print(f"Error in process_document wrapper: {e}")
                traceback.print_exc()
                raise
    
    # Return our simplified client
    return SimpleDocumentAIClient() 