# Metadata Handler

This document describes the Step Functions-based implementation and architecture of the Metadata Handler in the A-IEP backend, focusing on the document processing pipeline and its multi-agent system. The previous monolithic Lambda handler is deprecated and replaced by a state-machine-driven pipeline.

---

## 1. Pipeline Overview

The document processing pipeline is orchestrated by AWS Step Functions via an `OrchestratorFunction` that starts the state machine on S3 object-created events. The pipeline consists of several key stages:

- **Document Ingestion & OCR**: The document is downloaded from S3 and processed using the Mistral OCR API to extract text.
- **PII Redaction**: The extracted text is scanned for PII (personally identifiable information) using AWS Comprehend, and sensitive data is redacted.
- **S3 Cleanup**: The original file is deleted from S3 after successful OCR processing.
- **Multi-Agent Analysis & Translation**: The redacted document is analyzed and summarized using a multi-agent system built on top of OpenAI models, with translation into multiple languages.
- **Structured Data Storage**: The final structured results including summaries, sections, document index, and abbreviations are stored in DynamoDB.

---

## 2. Detailed Pipeline Flow

### A. S3 Event Handling & Start Execution
- The pipeline is triggered by an S3 event.
- The `orchestrator.py` Lambda parses the S3 key to extract `user_id`, `child_id`, and `iep_id` and starts the Step Functions state machine.

### B. OCR Processing
- The document is processed by the `MistralOCRFunction` step (`steps/mistral_ocr/mistral_ocr.py`).
- If OCR fails, the state machine logs the error and updates the document status via the central DDB service.

### C. PII Redaction
- The OCR result is passed to the `RedactOCRFunction` step (`steps/redact_ocr/comprehend_redactor.py`).
- This uses AWS Comprehend to detect and redact PII, except for names.
- Redaction statistics are added to the OCR result for tracking and stored.

### D. Multi-Agent Document Analysis & Translation

#### Agent Architecture
- The core of the multi-agent system is implemented per-step in `steps/parsing_agent` and `steps/translate_content` using a custom `Agent` and `Runner` abstraction (from the shared `agents` module).

#### Agent Hierarchy and Tools
-- **Main Agent ("IEP Document Analyzer")**
  - Model: OpenAI GPT-4.1 (default)
  - Instructions: Provided by prompts in `steps/parsing_agent/config.py`
  - Tools:
    - **OCR Tools:**
      - `get_all_ocr_text`: Returns all OCR text.
      - `get_ocr_text_for_page`: Returns OCR text for a specific page.
      - `get_ocr_text_for_pages`: Returns OCR text for multiple pages.
    - **Section Info Tool:**
      - `get_section_info`: Returns key points and descriptions for IEP sections.
    - **Translation Agent (as a tool)**

- **Translation Agent ("Translation Agent")**
  - Model: OpenAI GPT-4.1 (default)
  - Instructions: Translation-specific prompt in `steps/translate_content/config.py`.
  - Tools:
    - `get_language_context_for_translation`: Provides language context for translation (e.g., cultural/linguistic notes).

#### Agent Execution Flow
- The parsing agent extracts the English structure (summaries, sections, document index, abbreviations).
- The translation agent translates the structured English output into the required non-English languages.
- Agents support parallel tool calls via `ModelSettings` for efficiency.

#### Validation and Output
- Output is validated using the Pydantic models in each step module (e.g., `steps/parsing_agent/data_model.py`).
- The final output is written through the central DDB service.

---

## 3. Key Components

- `orchestrator.py`: Starts the Step Functions execution on S3 events.
- `state-machines/iep-processing.asl.json`: The state machine definition.
- Step Lambdas under `steps/*`: business logic for OCR, redaction, parsing, translation, finalize.
- `functions.ts`: CDK setup wiring Lambdas and the state machine.

---

## 4. Multi-Agent Architecture: In-Depth

- **Agents** are autonomous units that can:
  - Use tools (functions decorated with `@function_tool`).
  - Call other agents as tools (enabling hierarchical/recursive agent structures).
  - Run with specific model settings (e.g., parallel tool calls, temperature).
- **Tools** are Python functions that expose capabilities to agents (e.g., fetching OCR text, getting section info, translating text).
- **Runner** executes the agent, managing the conversation, tool calls, and output validation.
- **Error Handling**: If any step fails (OCR, redaction, agent analysis, validation), the pipeline logs the error, updates the document status, and halts further processing.

---

## 5. Data Flow Summary

S3 Event → OCR (Mistral) → PII Redaction (Comprehend) → S3 Cleanup → Multi-Agent Analysis & Translation (OpenAI) → Validation & Formatting → Store Structured Output in DynamoDB

### Key Output Components
- **Summaries**: Parent-friendly explanations in all supported languages (en, es, vi, zh)
- **Sections**: Detailed IEP sections in Markdown format for all languages
- **Document Index**: Table of contents with page references for all languages  
- **Abbreviations**: Centralized legend of all abbreviations and their full forms for all languages

---

## 6. Abbreviations Feature

The system automatically extracts and organizes abbreviations found throughout IEP documents:

### Key Benefits
- **Centralized**: All abbreviations collected in one place instead of scattered across sections
- **Multi-language**: Abbreviations translated and available in all supported languages
- **Comprehensive**: Extracts from both summaries and all sections
- **Parent-friendly**: Helps parents understand educational terminology and acronyms

### Technical Implementation
- Abbreviations are extracted during document analysis using structured prompts
- Each abbreviation includes the acronym and its full form (e.g., "IEP" → "Individualized Education Program")
- Data is stored in JSON format in DynamoDB for easy frontend consumption
- API responses include the abbreviations field alongside summaries, sections, and document index

---

## 7. IEP Processing Status Transitions

The IEP processing workflow uses a comprehensive status tracking system with real-time progress updates. Here's the complete breakdown of all status transitions:

### Status Values
- `PROCESSING` - Document is being processed
- `PROCESSED` - Document processing completed successfully  
- `FAILED` - Document processing failed

### Complete Workflow with Progress & Current Steps

| **Step** | **Progress** | **Current Step** | **Status** | **Description** |
|----------|-------------|------------------|------------|-----------------|
| **InitializeProcessing** | 5% | `"start"` | `PROCESSING` | Initialize processing status and progress tracking |
| **MistralOCR** | 15% | `"ocr_complete"` | `PROCESSING` | Extract text using Mistral OCR API |
| **RedactOCR** | 20% | `"pii_redaction_complete"` | `PROCESSING` | Remove PII using AWS Comprehend |
| **DeleteOriginal** | 22% | `"cleanup_complete"` | `PROCESSING` | Delete uploaded S3 file |
| **ParallelWork** | 65% | `"analysis_complete"` | `PROCESSING` | Run parsing and missing info concurrently |
| ├─ **ParsingAgent** | - | - | `PROCESSING` | Generate English summary/sections using OpenAI |
| └─ **MissingInfoAgent** | - | - | `PROCESSING` | Extract missing info insights using OpenAI |
| **CheckLanguagePrefs** | - | - | `PROCESSING` | Check user language preferences |
| **TranslationChoice** | - | - | `PROCESSING` | Decide if translations are needed |
| **ParallelTranslations** | 85% | `"translation_complete"` | `PROCESSING` | Translate content (if needed) |
| ├─ **TranslateParsingResult** | - | - | `PROCESSING` | Translate parsing results |
| └─ **TranslateMissingInfo** | - | - | `PROCESSING` | Translate missing info results |
| **FinalizeResults** | 100% | `"completed"` | `PROCESSED` | Mark document as completed |
| **RecordFailure** | 0% | `"error"` | `FAILED` | Record failure state and error details |

### Key Transition Points

1. **Start (5%)**: Document processing begins
2. **OCR Complete (15%)**: Text extraction finished
3. **PII Redaction Complete (20%)**: Sensitive data removed
4. **Cleanup Complete (22%)**: Original file deleted
5. **Analysis Complete (65%)**: English analysis and missing info extraction done
6. **Translation Complete (85%)**: Multi-language translations finished (if needed)
7. **Completed (100%)**: All processing finished successfully

### Error Handling
- Any step failure routes to `RecordFailure`
- Sets `status="FAILED"`, `current_step="error"`, `progress=0`
- Records `error_message`, `last_error`, and `failed_step`

### Parallel Processing
- **ParsingAgent** and **MissingInfoAgent** run concurrently (both at 65% progress)
- **TranslateParsingResult** and **TranslateMissingInfo** run concurrently (both at 85% progress)

### Translation Logic
- If user has language preferences beyond English → translations run
- If user only wants English → skips to finalization
- Progress jumps from 65% to 100% if no translations needed

### Frontend Integration
- Frontend polls status updates every 5 seconds via `GET /profile/children/{childId}/documents`
- Displays real-time progress percentage and current step to users
- Stops polling when `status="PROCESSED"` or `status="FAILED"`

---

## 8. Extensibility

- The agent-tool abstraction allows for easy addition of new tools (e.g., new language translation, new section analyzers).
- The multi-agent setup (agents calling agents as tools) supports complex workflows and modularity.
- The modular data model supports easy addition of new output components alongside existing summaries, sections, document index, and abbreviations. 