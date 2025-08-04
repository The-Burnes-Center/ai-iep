import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, pdf, Font } from '@react-pdf/renderer';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { IEPDocument, IEPSection } from './types';

// Register fonts for multi-language support
Font.register({
  family: 'NotoSans',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosans/v27/o-0IIpQlx3QUlC5A4PNb4j5Ba_2c7A.woff2',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/notosans/v27/o-0NIpQlx3QUlC5A4PNjXhFlY9aB7Q.woff2',
      fontWeight: 'bold',
    },
  ],
});

// Register Chinese font support  
Font.register({
  family: 'NotoSansCJK',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeALhL83CxG.woff2',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3k9o84MPvpLmixcA63oeALZKKKkY.woff2', 
      fontWeight: 'bold',
    },
  ],
});

interface PDFGenerationOptions {
  document: IEPDocument;
  preferredLanguage: string;
  fileName?: string;
}

// Configure marked for better PDF rendering with table support
marked.setOptions({
  breaks: true,
  gfm: true // GitHub Flavored Markdown includes table support
});

// Helper function to get the appropriate font family based on language
const getFontFamily = (language?: string): string => {
  if (language === 'zh') {
    return 'NotoSansCJK'; // Chinese characters
  }
  if (language === 'vi') {
    return 'NotoSans'; // Vietnamese uses Latin with diacritics
  }
  return 'NotoSans'; // Default for all languages including English
};

const getFontFamilyBold = (language?: string): string => {
  if (language === 'zh') {
    return 'NotoSansCJK'; // Chinese characters
  }
  if (language === 'vi') {
    return 'NotoSans'; // Vietnamese uses Latin with diacritics  
  }
  return 'NotoSans'; // Default for all languages including English
};

// Styles for the PDF with content-aware page breaks
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'NotoSans',
    fontSize: 11,
    lineHeight: 1.5,
  },
  documentHeader: {
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'NotoSans',
  },
  documentSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666666',
    fontStyle: 'italic',
  },
  languageSection: {
    marginBottom: 25,
    breakInside: 'avoid', // Prevent sections from breaking across pages
  },
  languageHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    borderBottomStyle: 'solid',
    fontFamily: 'NotoSans',
    breakAfter: 'avoid', // Keep header with content
  },
  sectionContainer: {
    marginBottom: 20,
    breakInside: 'avoid', // Prevent sections from breaking
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    fontFamily: 'NotoSans',
    breakAfter: 'avoid',
  },
  sectionContent: {
    fontSize: 11,
    lineHeight: 1.6,
    textAlign: 'justify',
  },
  pageReference: {
    fontSize: 9,
    color: '#888888',
    fontStyle: 'italic',
    marginTop: 5,
  },
  tableContainer: {
    marginVertical: 10,
    breakInside: 'avoid', // Keep tables together
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    borderBottomStyle: 'solid',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    backgroundColor: '#F5F5F5',
    minHeight: 30,
    alignItems: 'center',
    breakAfter: 'avoid',
  },
  tableCell: {
    flex: 1,
    padding: 5,
    fontSize: 10,
    textAlign: 'left',
  },
  tableCellHeader: {
    flex: 1,
    padding: 5,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'left',
    fontFamily: 'NotoSans',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 5,
    breakInside: 'avoid',
  },
  listBullet: {
    width: 15,
    fontSize: 11,
  },
  listContent: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.4,
  },
  emptyContent: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#666666',
    textAlign: 'center',
    marginVertical: 20,
  },
});

// Helper function to get display name for language
const getLanguageDisplayName = (language: string): string => {
  const languageNames: { [key: string]: string } = {
    'en': 'English',
    'es': 'Spanish (Español)',
    'vi': 'Vietnamese (Tiếng Việt)',
    'zh': 'Chinese (中文)',
  };
  return languageNames[language] || language.toUpperCase();
};

// Convert markdown to React-PDF components
const parseMarkdownContent = (markdown: string, language: string = 'en'): React.ReactElement[] => {
  if (!markdown || typeof markdown !== 'string') return [];

  const elements: React.ReactElement[] = [];
  const lines = markdown.split('\n');
  let currentList: string[] = [];
  let currentTable: string[][] = [];
  let inTable = false;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <View key={`list-${elements.length}`} style={{ marginVertical: 10 }}>
          {currentList.map((item, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={[styles.listBullet, { fontFamily: getFontFamily(language) }]}>•</Text>
              <Text style={[styles.listContent, { fontFamily: getFontFamily(language) }]}>{item.replace(/^[-*+]\s*/, '')}</Text>
            </View>
          ))}
        </View>
      );
      currentList = [];
    }
  };

  const flushTable = () => {
    if (currentTable.length > 0) {
      // Normalize table to ensure all rows have the same number of columns
      // Use reduce instead of spread operator to avoid "Invalid array length" for large tables
      // Also limit max columns to prevent extremely wide tables
      const maxColumns = Math.min(
        currentTable.reduce((max, row) => Math.max(max, row.length), 0),
        20 // Reasonable limit for PDF table width
      );
      const normalizedTable = currentTable.map(row => {
        // Trim row to maxColumns limit, then pad if needed
        const normalizedRow = [...row.slice(0, maxColumns)];
        // Pad shorter rows with empty cells
        while (normalizedRow.length < maxColumns) {
          normalizedRow.push('');
        }
        return normalizedRow;
      });

      elements.push(
        <View key={`table-${elements.length}`} style={styles.tableContainer}>
          {normalizedTable.map((row, rowIndex) => (
            <View 
              key={rowIndex} 
              style={rowIndex === 0 ? styles.tableHeaderRow : styles.tableRow}
            >
              {row.map((cell, cellIndex) => (
                <Text 
                  key={cellIndex} 
                  style={[
                    rowIndex === 0 ? styles.tableCellHeader : styles.tableCell,
                    { fontFamily: rowIndex === 0 ? getFontFamilyBold(language) : getFontFamily(language) }
                  ]}
                >
                  {cell.trim()}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
      currentTable = [];
      inTable = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Handle tables
    if (trimmedLine.includes('|')) {
      if (!inTable) {
        flushList();
        inTable = true;
      }
      const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell);
      // Skip table separator lines (e.g., | --- | --- |)
      const isTableSeparator = cells.every(cell => /^-+$/.test(cell));
      if (cells.length > 0 && !isTableSeparator) {
        currentTable.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable();
    }

    // Handle lists
    if (/^[-*+]\s/.test(trimmedLine)) {
      currentList.push(trimmedLine);
      return;
    } else if (currentList.length > 0) {
      flushList();
    }

    // Handle headers
    if (trimmedLine.startsWith('#')) {
      const level = trimmedLine.match(/^#+/)?.[0].length || 1;
      const text = trimmedLine.replace(/^#+\s*/, '');
      const fontSize = Math.max(16 - level, 11);
      
      elements.push(
        <Text 
          key={index} 
          style={[
            styles.sectionHeader, 
            { 
              fontSize, 
              marginTop: level === 1 ? 20 : 15,
              fontFamily: getFontFamilyBold(language)
            }
          ]}
        >
          {text}
        </Text>
      );
      return;
    }

    // Handle regular paragraphs
    if (trimmedLine) {
      // Simple markdown parsing for bold and italic
      let content = trimmedLine
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markers (React-PDF doesn't support inline styles easily)
        .replace(/\*(.*?)\*/g, '$1');   // Remove italic markers
      
      elements.push(
        <Text key={index} style={[styles.sectionContent, { marginBottom: 8, fontFamily: getFontFamily(language) }]}>
          {content}
        </Text>
      );
    }
  });

  // Flush any remaining lists or tables
  flushList();
  flushTable();

  return elements;
};

// Generate content for a specific language
const generateLanguageContent = (
  document: IEPDocument, 
  language: string, 
  isTranslation: boolean = false
): React.ReactElement[] => {
  const elements: React.ReactElement[] = [];
  
  // Language header
  elements.push(
    <Text key={`lang-header-${language}`} style={[styles.languageHeader, { fontFamily: getFontFamilyBold(language) }]}>
      {isTranslation ? 'Translation - ' : ''}{getLanguageDisplayName(language)}
    </Text>
  );

  // Add summary if available
  const summary = document.summaries[language as keyof typeof document.summaries];
  if (summary && summary.trim()) {
    elements.push(
      <View key={`summary-${language}`} style={styles.sectionContainer}>
        <Text style={[styles.sectionHeader, { fontFamily: getFontFamilyBold(language) }]}>IEP Summary</Text>
        {parseMarkdownContent(summary, language)}
      </View>
    );
  }

  // Get sections for this language
  const languageSections = document.sections[language as keyof typeof document.sections];

  if (!languageSections || languageSections.length === 0) {
    if (!summary || !summary.trim()) {
      elements.push(
        <Text key={`no-content-${language}`} style={[styles.emptyContent, { fontFamily: getFontFamily(language) }]}>
          No content available in {getLanguageDisplayName(language)}
        </Text>
      );
    }
    return elements;
  }

  // Add sections header if we have sections
  if (languageSections.length > 0) {
    elements.push(
      <Text key={`sections-header-${language}`} style={[styles.sectionHeader, { fontFamily: getFontFamilyBold(language) }]}>
        Key Insights
      </Text>
    );
  }

  // Process each section
  languageSections.forEach((section, index) => {
    if (!section.content || !section.content.trim()) return;

    elements.push(
      <View key={`section-${language}-${index}`} style={styles.sectionContainer}>
        <Text style={[styles.sectionHeader, { fontFamily: getFontFamilyBold(language) }]}>
          {section.displayName || section.name || `Section ${index + 1}`}
        </Text>
        
        {parseMarkdownContent(section.content, language)}
        
        {section.pageNumbers && section.pageNumbers.length > 0 && (
          <Text style={[styles.pageReference, { fontFamily: getFontFamily(language) }]}>
            Reference: Pages {section.pageNumbers.join(', ')} of original IEP document
          </Text>
        )}
      </View>
    );
  });

  return elements;
};

// Main PDF Document Component
const PDFDocumentComponent: React.FC<{ options: PDFGenerationOptions }> = ({ options }) => {
  const { document, preferredLanguage } = options;
  
  const allElements: React.ReactElement[] = [];
  
  // Document header
  allElements.push(
    <View key="header" style={styles.documentHeader}>
      <Text style={[styles.documentTitle, { fontFamily: getFontFamilyBold(preferredLanguage) }]}>
        IEP Document Summary and Translations
      </Text>
      <Text style={[styles.documentSubtitle, { fontFamily: getFontFamily(preferredLanguage) }]}>
        Generated on {new Date().toLocaleDateString()}
      </Text>
    </View>
  );

  // Collect available languages
  const availableLanguages = new Set<string>();
  
  // Check for summaries
  Object.keys(document.summaries).forEach(lang => {
    const summary = document.summaries[lang as keyof typeof document.summaries];
    if (summary && summary.trim()) {
      availableLanguages.add(lang);
    }
  });
  
  // Check for sections
  Object.keys(document.sections).forEach(lang => {
    const sections = document.sections[lang as keyof typeof document.sections];
    if (sections && sections.length > 0) {
      availableLanguages.add(lang);
    }
  });

  // New simplified logic: max 2 languages, other language first, then English
  const orderedLanguages: string[] = [];
  
  // If preferred language is not English and has content, add it first
  if (preferredLanguage !== 'en' && availableLanguages.has(preferredLanguage)) {
    orderedLanguages.push(preferredLanguage);
  }
  
  // Always add English if it has content (unless we're at max 2 languages)
  if (availableLanguages.has('en') && orderedLanguages.length < 2) {
    orderedLanguages.push('en');
  }

  // Generate content for each language
  orderedLanguages.forEach((language, index) => {
    const isTranslation = language !== 'en';
    
    allElements.push(
      <View key={`language-${language}`} style={styles.languageSection}>
        {generateLanguageContent(document, language, isTranslation)}
      </View>
    );
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {allElements}
      </Page>
    </Document>
  );
};

// Validation function
export const canGeneratePDF = (document: IEPDocument | null): boolean => {
  if (!document || !document.sections) return false;
  
  // Check if we have summaries
  const hasSummaries = document.summaries && 
    Object.values(document.summaries).some(summary => 
      summary && typeof summary === 'string' && summary.trim().length > 0
    );

  // Check if we have sections content
  const hasSections = Object.values(document.sections).some(languageSections =>
    languageSections && languageSections.length > 0 && 
    languageSections.some(section => 
      section.content && section.content.trim().length > 0
    )
  );

  return hasSummaries || hasSections;
};

// Main PDF generation function
export const generatePDF = async (options: PDFGenerationOptions): Promise<void> => {
  const { document, fileName } = options;
  
  if (!canGeneratePDF(document)) {
    throw new Error('Document does not contain sufficient content for PDF generation');
  }

  try {
    // Generate the PDF blob
    const blob = await pdf(<PDFDocumentComponent options={options} />).toBlob();
    
    // Generate filename
    const sanitizedFileName = (fileName || 'IEP_Summary_and_Translations')
      .replace(/\.pdf$/i, '') // Remove existing .pdf extension
      .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid characters
      + '.pdf';
    
    // Create download link and trigger download using global document object
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = sanitizedFileName;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};