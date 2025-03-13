"""
Pass-through file for backward compatibility.
This file imports and re-exports functions from the new module structure
to maintain compatibility with existing code that imports from lambda_function.py.
"""

# Import from new modules
from lambda_handler import lambda_handler
from document_processor import summarize_and_analyze_document
from database import update_iep_document_status, get_user_profile, get_document_metadata_by_id
from translation import translate_content
from utils import get_document_metadata, get_all_documents_metadata, retrieve_knowledge_base_documents

# Define what's available for import
__all__ = [
    'lambda_handler',
    'summarize_and_analyze_document',
    'update_iep_document_status',
    'get_user_profile',
    'get_document_metadata_by_id',
    'translate_content',
    'get_document_metadata',
    'get_all_documents_metadata',
    'retrieve_knowledge_base_documents'
]
