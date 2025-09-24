from typing import List, Optional, Dict
from pydantic import BaseModel, Field, model_validator, field_validator
from config import IEP_SECTIONS

# =============================================================================
# CORE COMPONENT MODELS
# =============================================================================

class AbbreviationLegend(BaseModel):
    """Abbreviation legend entry with abbreviation and its full form"""
    abbreviation: str = Field(..., description="The abbreviation or acronym")
    full_form: str = Field(..., description="The full form of the abbreviation")


class SectionContent(BaseModel):
    """Content for a single IEP section with validation"""
    title: str = Field(
        ..., 
        description="Section name - must match one of: " + ", ".join(IEP_SECTIONS.keys())
    )
    content: str = Field(..., description="Section content in markdown format")
    page_numbers: List[int] = Field(..., description="List of page numbers where content was found, make sure to include all the pages where the section content was found.")
    
    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        if v not in IEP_SECTIONS:
            raise ValueError(f"Invalid section name: {v}. Must be one of: {', '.join(IEP_SECTIONS.keys())}")
        return v


# =============================================================================
# MULTI-LANGUAGE CONTAINER MODELS
# =============================================================================

class LanguageSummary(BaseModel):
    """Summaries in all supported languages"""
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


class LanguageSection(BaseModel):
    """IEP sections for all supported languages"""
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


class LanguageDocumentIndex(BaseModel):
    """Document indexes (Table of Contents) in all supported languages"""
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


class LanguageAbbreviations(BaseModel):
    """Abbreviation legends in all supported languages"""
    en: List[AbbreviationLegend] = Field(..., description="List of abbreviations and their full forms found in the English content")
    es: List[AbbreviationLegend] = Field(..., description="List of abbreviations and their full forms found in the Spanish content")
    vi: List[AbbreviationLegend] = Field(..., description="List of abbreviations and their full forms found in the Vietnamese content")
    zh: List[AbbreviationLegend] = Field(..., description="List of abbreviations and their full forms found in the Chinese content")


# =============================================================================
# MAIN OUTPUT MODELS
# =============================================================================

class IEPData(BaseModel):
    """Complete IEP Document Data Structure for all languages"""
    summaries: LanguageSummary
    sections: LanguageSection
    document_index: LanguageDocumentIndex
    abbreviations: LanguageAbbreviations = Field(..., description="Abbreviation legends for all languages, containing all abbreviations found in summaries and sections")

    class Config:
        validate_assignment = True
        validate_default = True
        extra = "forbid"


class SingleLanguageIEP(BaseModel):
    """Complete IEP data structure for a single language (typically English)"""
    summary: str = Field(..., description="Summary of the IEP for this language")
    sections: List[SectionContent] = Field(..., description="All IEP sections for this language")
    document_index: str = Field(..., description="Document index (Table of Contents) for this language")
    abbreviations: List[AbbreviationLegend] = Field(..., description="List of all abbreviations and their full forms found in the summary and sections")

    @model_validator(mode='after')
    @classmethod
    def validate_complete_sections(cls, model):
        """Ensure all required IEP sections are present"""
        section_titles = [section.title for section in model.sections]
        missing_titles = set(IEP_SECTIONS.keys()) - set(section_titles)
        extra_titles = set(section_titles) - set(IEP_SECTIONS.keys())
        
        if missing_titles:
            raise ValueError(f"Missing required sections: {missing_titles}")
        if extra_titles:
            raise ValueError(f"Unknown sections: {extra_titles}")
        
        return model

    class Config:
        validate_assignment = True
        extra = "forbid"


# =============================================================================
# TRANSLATION-SPECIFIC MODELS
# =============================================================================

class TranslationSummaries(BaseModel):
    """Summaries for translations (excludes English as it's already available)"""
    es: str
    vi: str
    zh: str


class TranslationSectionContent(BaseModel):
    """Section content for translations (simplified structure)"""
    title: str
    content: str
    page_numbers: List[int]


class TranslationSections(BaseModel):
    """Sections for each translated language (excludes English)"""
    es: List[TranslationSectionContent]
    vi: List[TranslationSectionContent]
    zh: List[TranslationSectionContent]


class TranslationDocumentIndex(BaseModel):
    """Document index for translations (excludes English)"""
    es: str
    vi: str
    zh: str


class TranslationAbbreviations(BaseModel):
    """Abbreviation legends for translations (excludes English)"""
    es: List[AbbreviationLegend]
    vi: List[AbbreviationLegend]
    zh: List[AbbreviationLegend]


class TranslationOutput(BaseModel):
    """Complete translation output schema for all non-English languages"""
    summaries: TranslationSummaries
    sections: TranslationSections
    document_index: TranslationDocumentIndex
    abbreviations: TranslationAbbreviations

    class Config:
        extra = "forbid"
