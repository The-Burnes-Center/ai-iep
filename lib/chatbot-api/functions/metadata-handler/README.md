# IEP Document Processing System

This system helps process and understand Individualized Education Program (IEP) documents. Think of it as a smart assistant that reads IEP documents and helps organize their information in a way that's easy to understand and access.

## What This System Does

- **Document Reading**: Automatically reads and extracts text from IEP documents
- **Smart Analysis**: 
  - Understands the content of the IEP
  - Identifies different sections (like Goals, Services, etc.)
  - Creates summaries in multiple languages
- **Information Storage**: Safely stores all the information in a database
- **Easy Access**: Makes the information available through a simple interface

## How It Works

### 1. Main Parts of the System

#### A. Storage and Security
- **Document Storage**: Safely stores IEP documents in S3
- **Information Database**: Keeps track of all processed information
- **Knowledge Base**: Stores helpful information about IEPs
- **Secure Key Storage**: Safely manages access keys

#### B. Smart Tools
- **Document Reader**: Reads and extracts text from IEP documents
- **AI Agent's Smart Tools**:
  - **Full Document Understanding Tool**:
    * Reads and understands the entire IEP document
    * Creates a smart index of all pages and sections
    * Helps find where important information lives
    * Makes connections between different parts of the document

  - **Page-Specific Tool**:
    * Can look at any specific page in detail
    * Helps find exact information when needed
    * Makes sure we don't miss important details
    * Useful for understanding specific sections

  - **Smart Search Tool**:
    * Finds related information across the document
    * Understands the context of what it's looking for
    * Can find similar topics or related sections
    * Helps connect information from different parts

### 2. The Process

1. **Document Upload and Initial Processing**:
   - The IEP document is first uploaded to an S3 bucket
   - An S3 event triggers the Lambda function that starts the processing workflow
   - Document metadata extracted and initial status set to "PROCESSING"
   - Document URL and basic information stored in DynamoDB

2. **OCR Processing Pipeline**:
   - Document sent to Mistral OCR API
   - OCR results processed into structured format:
     - Page-by-page markdown content
     - Document dimensions and DPI information
     - Processing metadata (model used, pages processed)
   - OCR data stored in DynamoDB for future reference
   - Status updated to reflect OCR completion

3. **Smart Document Analysis**:
   - **Full Content Understanding**:
     - OpenAI agent receives complete OCR output with page numbers
     - Builds an index mapping pages to content
     - Creates a guide to where each section lives in the document
   
   - **Initial Summary Creation**:
     - Agent reads the entire document
     - Creates an overall summary
     - Identifies key points and main sections
   
   - **Section-by-Section Processing**:
     - Looks at each important section: (defined in config.py)
       * Present Levels (student's current performance)
       * Eligibility (why they need special education)
       * Placement (where they'll learn)
       * Goals (what they'll achieve)
       * Services (what help they'll get)
       * Informed Consent (parent's agreement)
       * Accommodations (special help they need)
     
     - For each section:
       * Gets specific instructions from our guide (config.py)
       * Uses smart tools to find relevant information
       * Creates clear summaries
       * Organizes information neatly

4. **Smart Tools for Understanding**:
   - **Content Finding Tool**:
     - Helps find related information across the document
     - Uses smart search to understand context
     - Finds specific pages when needed
   
   - **Page-Specific Tool**:
     - Gets exact content from specific pages
     - Helps understand detailed sections
     - Makes sure we don't miss anything

5. **Translation Process**:
   - **Getting Ready**:
     - Organizes content for translation
     - Gets language-specific rules from our guide (config.py)
     - Makes sure it's easy to understand
   
   - **Translation**:
     - Translates to different languages:
       * Spanish (Latin American style)
       * Vietnamese
       * Chinese
     - Makes sure it's easy to read (8th-grade level)
     - Explains technical terms simply
     - Considers cultural differences
   
   - **Quality Checks**:
     - Makes sure translations are accurate
     - Checks that everything makes sense
     - Ensures it's easy to understand
     - Verifies cultural appropriateness

6. **Saving Everything**:
   - **Storing Information**:
     - Saves all summaries and sections
     - Stores translations in different languages
     - Keeps track of document status
     - Makes sure everything is organized
   
   - **Connecting to User**:
     - Links document to the right user
     - Sets up proper access
     - Tracks usage

### 3. How We Guide the Process

All the instructions and rules for how the system should work are stored in `config.py`. This includes:

1. **Section Definitions**:
   - Clear descriptions of each IEP section
   - What information to look for
   - How to organize the information

2. **Key Points to Find**:
   - Important details for each section
   - What questions to answer
   - What information to include

3. **Language Rules**:
   - How to write in each language
   - Reading level requirements
   - Cultural considerations
   - How to explain technical terms

4. **Processing Instructions**:
   - How to analyze documents
   - How to create summaries
   - How to format information
   - How to handle special cases

## Important Settings

The system needs these important settings to work:
- Where to store documents
- Where to keep user information
- Where to store documents
- How to access important keys

## Keeping Things Safe and Working Well

- Careful error checking
- Tracking document status
- Safe key management
- Regular maintenance
- Keeping things running smoothly

## Making Things Fast and Efficient

- Quick processing
- Handling many documents
- Efficient storage
- Fast retrieval

## Getting Started

The system is set up through our main project setup, which includes all the necessary permissions and settings to make everything work together smoothly. 