from typing import List, Literal
from pydantic import BaseModel, Field, validator
from config import IEP_SECTIONS

# Create a literal type for section names
SectionName = Literal[tuple(IEP_SECTIONS.keys())]  # type: ignore

class SectionContent(BaseModel):
    """Content for a single IEP section"""
    title: str = Field(
        ..., 
        description=f"Section name - must be one of: {', '.join(IEP_SECTIONS.keys())}"
    )
    content: str = Field(..., description="Section content in markdown format")
    ocr_text_used: str = Field(..., description="Original text from IEP document used to extract content")
    page_numbers: str = Field(..., description="Page numbers where content was found")

    @validator('title')
    def validate_section_title(cls, v):
        """Validate that section title is one of the allowed IEP sections"""
        if v not in IEP_SECTIONS:
            raise ValueError(
                f"Invalid section title: {v}. Must be one of: {', '.join(IEP_SECTIONS.keys())}"
            )
        return v

class LanguageSection(BaseModel):
    """Sections for a specific language"""
    en: List[SectionContent] = Field(..., description="English sections")
    es: List[SectionContent] = Field(..., description="Spanish sections")
    vi: List[SectionContent] = Field(..., description="Vietnamese sections")
    zh: List[SectionContent] = Field(..., description="Chinese sections")

    @validator('*')
    def validate_required_sections(cls, sections: List[SectionContent]):
        """Validate that all required IEP sections are present"""
        found_sections = {section.title for section in sections}
        missing_sections = set(IEP_SECTIONS.keys()) - found_sections
        if missing_sections:
            raise ValueError(
                f"Missing required sections: {', '.join(missing_sections)}"
            )
        return sections

class LanguageSummary(BaseModel):
    """Summaries in all supported languages"""
    en: str = Field(..., description="English summary text")
    es: str = Field(..., description="Spanish summary text")
    vi: str = Field(..., description="Vietnamese summary text")
    zh: str = Field(..., description="Chinese summary text")

    @validator('*')
    def validate_summary_not_empty(cls, v):
        """Validate that summaries are not empty"""
        if not v.strip():
            raise ValueError("Summary cannot be empty")
        return v

class LanguageDocumentIndex(BaseModel):
    """Document index in all supported languages"""
    en: str = Field(..., description="English document index with page numbers and content")
    es: str = Field(..., description="Spanish document index with page numbers and content")
    vi: str = Field(..., description="Vietnamese document index with page numbers and content")
    zh: str = Field(..., description="Chinese document index with page numbers and content")

    @validator('*')
    def validate_index_not_empty(cls, v):
        """Validate that document indices are not empty"""
        if not v.strip():
            raise ValueError("Document index cannot be empty")
        return v

class IEPData(BaseModel):
    """Complete IEP document data structure"""
    summaries: LanguageSummary = Field(..., description="Document summaries in all languages")
    sections: LanguageSection = Field(..., description="Document sections in all languages")
    document_index: LanguageDocumentIndex = Field(..., description="Document index in all languages")

    class Config:
        """Pydantic model configuration"""
        validate_assignment = True  # Validate data on assignment, not just on model creation
        extra = "forbid"  # Forbid extra attributes not defined in the model
    
    