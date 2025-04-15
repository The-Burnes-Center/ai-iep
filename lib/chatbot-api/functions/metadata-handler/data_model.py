from typing import List, Literal
from pydantic import BaseModel, Field, validator
from config import IEP_SECTIONS

# Create a literal type for section names
SectionName = Literal[tuple(IEP_SECTIONS.keys())]  # type: ignore

class SectionContent(BaseModel):
    """Content for a single IEP section"""
    title: str = Field(
        ..., 
        description="Section name - should be one of the following: " + ", ".join(IEP_SECTIONS.keys())
    )
    content: str = Field(..., description="Section content in markdown format")
    page_numbers: List[int] = Field(..., description="List of Page numbers where content was found")

class LanguageSection(BaseModel):
    """Sections for a specific language"""
    en: List[SectionContent] = Field(..., description="All English sections, should include all sections: " + ", ".join(IEP_SECTIONS.keys()))
    es: List[SectionContent] = Field(..., description="All Spanish sections, should include all sections: " + ", ".join(IEP_SECTIONS.keys()))
    vi: List[SectionContent] = Field(..., description="All Vietnamese sections, should include all sections: " + ", ".join(IEP_SECTIONS.keys()))
    zh: List[SectionContent] = Field(..., description="All Chinese sections, should include all sections: " + ", ".join(IEP_SECTIONS.keys()))

    @validator('*')
    def validate_section_titles(cls, sections: List[SectionContent]):
        """Validate that section titles match the predefined names"""
        for section in sections:
            if section.title not in IEP_SECTIONS:
                raise ValueError(
                    f"Invalid section title: {section.title}. Section titles must be one of: {', '.join(IEP_SECTIONS.keys())}"
                )
        return sections

    @validator('*')
    def validate_required_sections(cls, sections: List[SectionContent], values, **kwargs):
        """Validate that all sections have the required number of items"""
        # Only validate count, not titles (except for English which is validated separately)
        if len(sections) != len(IEP_SECTIONS):
            raise ValueError(
                f"Expected {len(IEP_SECTIONS)} sections, got {len(sections)}. Each language must have the same number of sections."
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
        extra = "forbid" 
        validate_default = True  # Validate default values during model initialization 