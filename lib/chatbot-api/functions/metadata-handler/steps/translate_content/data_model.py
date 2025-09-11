from typing import List
from pydantic import BaseModel, Field

# =============================================================================
# CORE COMPONENT MODELS
# =============================================================================

class AbbreviationLegend(BaseModel):
    """Abbreviation legend entry with abbreviation and its full form"""
    abbreviation: str = Field(..., description="The abbreviation or acronym")
    full_form: str = Field(..., description="The full form of the abbreviation")


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


# =============================================================================
# MISSING INFO TRANSLATION MODELS
# =============================================================================

class MissingInfoItem(BaseModel):
    """Single missing information item for translation"""
    description: str = Field(..., description="Description of what information is missing")
    category: str = Field(..., description="Category of the missing information")


class MissingInfoTranslation(BaseModel):
    """Complete missing information translation structure"""
    iepId: str = Field(..., description="IEP ID, should remain unchanged")
    items: List[MissingInfoItem] = Field(..., description="List of missing information items")
