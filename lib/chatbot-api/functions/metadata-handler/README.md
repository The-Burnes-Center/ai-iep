# Metadata Handler 

This document describes the actual implementation and architecture of the Metadata Handler in the A-IEP backend, focusing on the document processing pipeline and its multi-agent system.

---

## 1. Pipeline Overview

The document processing pipeline is orchestrated primarily by the `iep_processing_pipeline` function in `lambda_function.py`. This function is triggered by an S3 event (e.g., when a new document is uploaded). The pipeline consists of several key stages:

- **Document Ingestion & OCR**: The document is downloaded from S3 and processed using the Mistral OCR API to extract text.
- **PII Redaction**: The extracted text is scanned for PII (personally identifiable information) using AWS Comprehend, and sensitive data is redacted.
- **Data Storage**: The redacted OCR results are stored in DynamoDB, and the original file is deleted from S3.
- **Multi-Agent Analysis & Translation**: The redacted document is analyzed and summarized using a multi-agent system built on top of OpenAI models, with translation into multiple languages.
- **Final Storage**: The structured, validated, and translated results are stored back in DynamoDB.

---

## 2. Detailed Pipeline Flow

### A. S3 Event Handling & Metadata Extraction
- The pipeline is triggered by an S3 event.
- The S3 key is parsed to extract `user_id`, `child_id`, and `iep_id`.

### B. OCR Processing
- The document is processed using `process_document_with_mistral_ocr` (from `mistral_ocr.py`).
- If OCR fails, the pipeline logs the error, updates the document status in DynamoDB, and deletes the file if appropriate.

### C. PII Redaction
- The OCR result (a list of pages with text) is passed to `redact_pii_from_texts` (from `comprehend_redactor.py`).
- This uses AWS Comprehend to detect and redact PII, except for names.
- Redaction statistics are added to the OCR result for tracking.

### D. Storing Redacted OCR Data
- The redacted OCR data is converted to a DynamoDB-compatible format and stored using `update_iep_document_status`.

### E. Multi-Agent Document Analysis & Translation

#### Agent Architecture
- The core of the multi-agent system is implemented in `open_ai_agent.py` via the `OpenAIAgent` class.
- The agent system is built on top of a custom `Agent` and `Runner` abstraction (imported from an `agents` module, likely a local or shared library).

#### Agent Hierarchy and Tools
- **Main Agent ("IEP Document Analyzer")**
  - Model: OpenAI GPT-4.1 (or similar)
  - Instructions: Provided by a prompt from `config.py`
  - Tools:
    - **OCR Tools:**
      - `get_all_ocr_text`: Returns all OCR text.
      - `get_ocr_text_for_page`: Returns OCR text for a specific page.
      - `get_ocr_text_for_pages`: Returns OCR text for multiple pages.
    - **Section Info Tool:**
      - `get_section_info`: Returns key points and descriptions for IEP sections.
    - **Translation Agent (as a tool)**

- **Translation Agent ("Translation Agent")**
  - Model: OpenAI GPT-4.1 (or similar)
  - Instructions: Translation-specific prompt.
  - Tools:
    - `get_language_context_for_translation`: Provides language context for translation (e.g., cultural/linguistic notes).

#### Agent Execution Flow
- The main agent is responsible for:
  - Analyzing the IEP document (using OCR tools and section info).
  - Structuring the content into summaries, sections, and document indices.
  - Calling the translation agent as a tool to translate the structured English output into Spanish, Vietnamese, and Chinese.
- The translation agent, when invoked, uses its own tool to fetch language context and performs the translation.
- The agent system supports **parallel tool calls** (as specified in `ModelSettings`), allowing for efficient multi-step reasoning and tool use.

#### Validation and Output
- The output from the agent is validated against the `IEPData` schema (from `data_model.py`).
- If validation fails, errors are logged and the document status is updated accordingly.
- The final, validated, and translated output is formatted for DynamoDB and stored.

---

## 3. Key Classes and Functions

- `iep_processing_pipeline` (`lambda_function.py`): Orchestrates the entire pipeline.
- `OpenAIAgent` (`open_ai_agent.py`): Encapsulates the multi-agent system, tool creation, and document analysis logic.
- `Agent`, `Runner`, `function_tool`, `ModelSettings` (agents module): Provide the abstractions for agent behavior, tool registration, and execution.
- `process_document_with_mistral_ocr` (`mistral_ocr.py`): Handles OCR.
- `redact_pii_from_texts` (`comprehend_redactor.py`): Handles PII redaction.
- `update_iep_document_status` (`lambda_function.py`): Updates DynamoDB with processing status and results.

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

S3 Event → OCR (Mistral) → PII Redaction (Comprehend) → Store Redacted OCR in DynamoDB → Multi-Agent Analysis & Translation (OpenAI) → Validation & Formatting → Store Final Output in DynamoDB

---

## 6. Extensibility

- The agent-tool abstraction allows for easy addition of new tools (e.g., new language translation, new section analyzers).
- The multi-agent setup (agents calling agents as tools) supports complex workflows and modularity. 