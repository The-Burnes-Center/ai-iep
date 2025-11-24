"""
Minimal translation handler for both parsing results and missing info
"""
import json
import os
import boto3
import traceback
from translation_agent import OptimizedTranslationAgent

def lambda_handler(event, context):
    """
    Unified translation handler that can translate both parsing results and missing info.
    
    Expected event parameters:
    - content_type: 'parsing_result' or 'missing_info'
    - target_languages: list of language codes
    - Other standard parameters (iep_id, user_id, child_id)
    """
    print(f"TranslateContent handler received: {json.dumps(event)}")
    
    try:
        iep_id = event['iep_id']
        user_id = event['user_id'] 
        child_id = event['child_id']
        target_languages = event['target_languages']
        content_type = event.get('content_type', 'parsing_result')
        
        if not target_languages:
            print("No target languages provided, skipping translation")
            event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
            return {
                **event_copy,
                f'{content_type}_translations': {},
                'translation_skipped': True
            }
        
        print(f"Translating {content_type} to languages: {target_languages}")
        
        # Get source data from DynamoDB - now from API fields instead of old result format
        lambda_client = boto3.client('lambda')
        ddb_service_name = os.environ.get('DDB_SERVICE_FUNCTION_NAME', 'DDBService')
        
        # Get the document which contains the new API field structure
        source_payload = {
            'operation': 'get_document',
            'params': {
                'iep_id': iep_id,
                'user_id': user_id,
                'child_id': child_id
            }
        }
        
        source_response = lambda_client.invoke(
            FunctionName=ddb_service_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(source_payload)
        )
        
        source_payload_response = source_response['Payload'].read()
        
        if not source_payload_response:
            if content_type == 'meeting_notes':
                print("Document not found, skipping translation")
                event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
                return {
                    **event_copy,
                    'meeting_notes_translations': {},
                    f'{content_type}_translation_skipped': True
                }
            else:
                raise Exception("Empty response from DDB service")
        
        try:
            source_ddb_result = json.loads(source_payload_response)
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse DDB service response as JSON: {e}")
        
        if source_ddb_result.get('statusCode') != 200:
            if content_type == 'meeting_notes':
                print("Document not found, skipping translation")
                event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
                return {
                    **event_copy,
                    'meeting_notes_translations': {},
                    f'{content_type}_translation_skipped': True
                }
            else:
                raise Exception(f"Failed to get document from DDB: {source_ddb_result}")
        
        document = json.loads(source_ddb_result['body'])
        print(f"Retrieved document for {content_type} translation")
        
        # Extract English content based on content type from new API field structure
        if content_type == 'parsing_result':
            # Get English content from API fields: summaries.en, sections.en, etc.
            summaries = document.get('summaries', {})
            sections = document.get('sections', {})
            document_index = document.get('document_index', {})
            abbreviations = document.get('abbreviations', {})
            
            if 'en' not in summaries or 'en' not in sections:
                raise Exception("English parsing data not found - summaries.en or sections.en missing")
            
            # Reconstruct the format expected by translation agent
            source_result = {
                'summary': summaries.get('en', ''),
                'sections': sections.get('en', []),
                'document_index': document_index.get('en', ''),
                'abbreviations': abbreviations.get('en', [])
            }
            
        elif content_type == 'meeting_notes':
            # Get English meeting notes from API fields: meetingNotes.en
            meeting_notes = document.get('meetingNotes', {})
            
            if 'en' not in meeting_notes or not meeting_notes.get('en'):
                print("English meeting notes not found, skipping translation")
                event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
                return {
                    **event_copy,
                    'meeting_notes_translations': {},
                    f'{content_type}_translation_skipped': True
                }
            
            # Reconstruct the format expected by translation agent (simple string)
            source_result = {
                'meeting_notes': meeting_notes.get('en', '')
            }
        else:
            raise ValueError(f"Unsupported content_type: {content_type}")
        
        print(f"Extracted {content_type} English data for translation")
        
        # Create optimized agent for translation with SSM fallback
        api_key = os.environ.get('OPENAI_API_KEY')
        
        # If encrypted or missing, fetch from SSM
        if not api_key or api_key.startswith('AQICA'):
            param_name = os.environ.get('OPENAI_API_KEY_PARAMETER_NAME')
            if param_name:
                try:
                    ssm = boto3.client('ssm')
                    response = ssm.get_parameter(Name=param_name, WithDecryption=True)
                    api_key = response['Parameter']['Value']
                    # Cache in environment for future use
                    os.environ['OPENAI_API_KEY'] = api_key
                    print("Successfully retrieved OPENAI_API_KEY from SSM")
                except Exception as e:
                    print(f"Error retrieving OPENAI_API_KEY from SSM: {str(e)}")
                    raise Exception("Failed to retrieve OPENAI_API_KEY from SSM")
        
        if not api_key:
            raise Exception("OPENAI_API_KEY not available from environment or SSM")
        
        optimized_agent = OptimizedTranslationAgent()
        
        # Translate content to target languages using agent framework
        translations = {}
        
        for lang in target_languages:
            print(f"Translating {content_type} to {lang} using optimized agent framework")
            
            # Use optimized agent-based translation for better quality and tool usage
            translated_content = optimized_agent.translate_content_with_agent(
                source_result, 
                lang, 
                content_type=content_type
            )
            
            if "error" in translated_content:
                print(f"Translation to {lang} failed: {translated_content['error']}")
                continue
            
            translations[lang] = translated_content
            print(f"Translation to {lang} completed successfully using optimized agent framework")
        
        print(f"{content_type} translation completed for {len(translations)} languages")
        
        # Save translations directly to API-compatible fields 
        # Save each field separately to avoid DynamoDB item size limit (400KB)
        saved_fields = []
        failed_fields = []
        
        if content_type == 'parsing_result':
            # Save parsing translations to summaries, sections, document_index, abbreviations
            # Save each field separately to avoid size limit issues
            for lang, translated_content in translations.items():
                field_mappings = [
                    (f'summaries.{lang}', translated_content.get('summary', '')),
                    (f'sections.{lang}', translated_content.get('sections', [])),
                    (f'document_index.{lang}', translated_content.get('document_index', '')),
                    (f'abbreviations.{lang}', translated_content.get('abbreviations', []))
                ]
                
                for field_path, field_value in field_mappings:
                    try:
                        save_payload = {
                            'operation': 'save_api_fields',
                            'params': {
                                'iep_id': iep_id,
                                'user_id': user_id,
                                'child_id': child_id,
                                'field_updates': {field_path: field_value}
                            }
                        }
                        
                        save_response = lambda_client.invoke(
                            FunctionName=ddb_service_name,
                            InvocationType='RequestResponse',
                            Payload=json.dumps(save_payload)
                        )
                        
                        save_payload_response = save_response['Payload'].read()
                        
                        if not save_payload_response:
                            print(f"Warning: Empty response when saving {field_path}")
                            failed_fields.append(field_path)
                            continue
                        
                        try:
                            save_result = json.loads(save_payload_response)
                        except json.JSONDecodeError as e:
                            print(f"Warning: Failed to parse response for {field_path}: {e}")
                            failed_fields.append(field_path)
                            continue
                        
                        if not save_result or save_result.get('statusCode') != 200:
                            print(f"Warning: Failed to save {field_path}: {save_result}")
                            failed_fields.append(field_path)
                        else:
                            saved_fields.append(field_path)
                            print(f"Successfully saved {field_path}")
                    except Exception as e:
                        print(f"Error saving {field_path}: {str(e)}")
                        failed_fields.append(field_path)
                        
        elif content_type == 'meeting_notes':
            # Save meeting notes translations to meetingNotes fields
            for lang, translated_content in translations.items():
                # Handle meeting notes structure (should be simple string)
                if isinstance(translated_content, dict) and 'meeting_notes' in translated_content:
                    field_value = translated_content['meeting_notes']
                elif isinstance(translated_content, str):
                    field_value = translated_content
                else:
                    field_value = ''
                
                field_path = f'meetingNotes.{lang}'
                
                try:
                    save_payload = {
                        'operation': 'save_api_fields',
                        'params': {
                            'iep_id': iep_id,
                            'user_id': user_id,
                            'child_id': child_id,
                            'field_updates': {field_path: field_value}
                        }
                    }
                    
                    save_response = lambda_client.invoke(
                        FunctionName=ddb_service_name,
                        InvocationType='RequestResponse',
                        Payload=json.dumps(save_payload)
                    )
                    
                    save_payload_response = save_response['Payload'].read()
                    
                    if not save_payload_response:
                        print(f"Warning: Empty response when saving {field_path}")
                        failed_fields.append(field_path)
                        continue
                    
                    try:
                        save_result = json.loads(save_payload_response)
                    except json.JSONDecodeError as e:
                        print(f"Warning: Failed to parse response for {field_path}: {e}")
                        failed_fields.append(field_path)
                        continue
                    
                    if not save_result or save_result.get('statusCode') != 200:
                        print(f"Warning: Failed to save {field_path}: {save_result}")
                        failed_fields.append(field_path)
                    else:
                        saved_fields.append(field_path)
                        print(f"Successfully saved {field_path}")
                except Exception as e:
                    print(f"Error saving {field_path}: {str(e)}")
                    failed_fields.append(field_path)
        
        # Report results
        if failed_fields:
            print(f"Warning: Some fields failed to save: {failed_fields}")
            # Only raise exception if ALL fields failed
            if not saved_fields:
                raise Exception(f"Failed to save all {content_type} translation fields: {failed_fields}")
        else:
            print(f"{content_type} translations saved successfully: {saved_fields}")
        
        # Set the result key based on content type
        if content_type == 'parsing_result':
            result_key = 'parsing_translations'
        elif content_type == 'meeting_notes':
            result_key = 'meeting_notes_translations'
        else:
            result_key = f'{content_type}_translations'
        
        # Return result
        event_copy = {k: v for k, v in event.items() if k not in ['progress', 'current_step']}
        return {
            **event_copy,
            result_key: translations,
            f'{content_type}_translation_completed': True,
            'languages_processed': list(translations.keys())
        }
        
    except Exception as e:
        print(f"TranslateContent error: {str(e)}")
        print(traceback.format_exc())
        raise
