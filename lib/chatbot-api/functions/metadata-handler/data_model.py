from typing import List, Optional
from pydantic import BaseModel, Field, model_validator, field_validator
from config import IEP_SECTIONS

class SectionContent(BaseModel):
    """Content for a single IEP section"""
    title: str = Field(
        ..., 
        description="Section name - must match one of: " + ", ".join(IEP_SECTIONS.keys())
    )
    content: str = Field(..., description="Section content in markdown format")
    page_numbers: List[int] = Field(..., description="List of page numbers where content was found")
    
    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        if v not in IEP_SECTIONS:
            raise ValueError(f"Invalid section name: {v}. Must be one of: {', '.join(IEP_SECTIONS.keys())}")
        return v

class LanguageSection(BaseModel):
    """Sections for each language"""
    en: List[SectionContent]
    es: List[SectionContent]
    vi: List[SectionContent]
    zh: List[SectionContent]

    @model_validator(mode='before')
    @classmethod
    def validate_sections(cls, values):
        for lang, sections in values.items():
            if not isinstance(sections, list):
                raise ValueError(f"{lang} sections must be a list")
            titles = [section['title'] if isinstance(section, dict) else section.title for section in sections]
            missing_titles = set(IEP_SECTIONS.keys()) - set(titles)
            extra_titles = set(titles) - set(IEP_SECTIONS.keys())
            if missing_titles:
                raise ValueError(f"Missing sections in {lang}: {missing_titles}")
            if extra_titles:
                raise ValueError(f"Unknown sections in {lang}: {extra_titles}")
        return values

class LanguageSummary(BaseModel):
    """Summaries in all languages"""
    en: str = Field(..., description="Detailed English summary of the IEP, this will be read by the parent whose child's IEP is being summarized. Explain the IEP to the parent.")
    es: str = Field(..., description="Translated Spanish summary of the IEP, this will be read by the parent whose child's IEP is being summarized. Explain the IEP to the parent.")
    vi: str = Field(..., description="Translated Vietnamese summary of the IEP, this will be read by the parent whose child's IEP is being summarized. Explain the IEP to the parent.")
    zh: str = Field(..., description="Translated Chinese summary of the IEP, this will be read by the parent whose child's IEP is being summarized. Explain the IEP to the parent.")

    @model_validator(mode='after')
    @classmethod
    def check_not_empty(cls, model):
        for lang, summary in model.__dict__.items():
            if not summary or not summary.strip():
                raise ValueError(f"Summary for {lang} cannot be empty")
        return model

class LanguageDocumentIndex(BaseModel):
    """Document indexes in all languages"""
    en: str = Field(..., description="Detailed English document index (Table of Contents) of the IEP, eg: Page 1: Title 1, Page 2-5: Title 2, etc.")
    es: str = Field(..., description="Translated Spanish document index (Table of Contents) of the IEP")
    vi: str = Field(..., description="Translated Vietnamese document index (Table of Contents) of the IEP")
    zh: str = Field(..., description="Translated Chinese document index (Table of Contents) of the IEP")

    @model_validator(mode='after')
    @classmethod
    def check_not_empty(cls, model):
        for lang, index in model.__dict__.items():
            if not index or not index.strip():
                raise ValueError(f"Document index for {lang} cannot be empty")
        return model

class IEPData(BaseModel):
    """Complete IEP Document Data Structure"""
    summaries: LanguageSummary
    sections: LanguageSection
    document_index: LanguageDocumentIndex

    class Config:
        validate_assignment = True
        validate_default = True
        extra = "forbid"

# --- Translation-only models ---
class TranslationSummaries(BaseModel):
    """Summaries for translations (no English)"""
    es: str
    vi: str
    zh: str

class TranslationSectionContent(BaseModel):
    """Section content for translations"""
    title: str
    content: str
    page_numbers: List[int]

class TranslationSections(BaseModel):
    """Sections for each translated language"""
    es: List[TranslationSectionContent]
    vi: List[TranslationSectionContent]
    zh: List[TranslationSectionContent]

class TranslationDocumentIndex(BaseModel):
    """Document index for translations"""
    es: str
    vi: str
    zh: str

class TranslationOutput(BaseModel):
    """Batched translation output schema"""
    summaries: TranslationSummaries
    sections: TranslationSections
    document_index: TranslationDocumentIndex

    class Config:
        extra = "forbid"
