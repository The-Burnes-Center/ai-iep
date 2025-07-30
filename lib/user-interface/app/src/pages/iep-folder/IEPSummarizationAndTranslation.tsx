import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Button, Badge, Accordion, Tabs, Tab, Offcanvas, Dropdown} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { faFileAlt, faClock, faCheckCircle, faExclamationTriangle, faLanguage, faDownload, faArrowsRotate, faForward } from '@fortawesome/free-solid-svg-icons';
import './IEPSummarizationAndTranslation.css';
import { IEPDocument, IEPSection, Language } from '../../common/types';
import { useLanguage, SupportedLanguage } from '../../common/language-context';
import { useDocumentFetch, processContentWithJargon } from '../utils';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
import { generatePDF, canGeneratePDF } from '../../common/pdf-generator.tsx';
import ParentRightsCarousel from '../../components/ParentRightsCarousel';
import AppTutorialCarousel from '../../components/AppTutorialCarousel';
import { ApiClient } from '../../common/api-client/api-client';
import { AppContext } from '../../common/app-context';
import { useNotifications } from '../../components/notif-manager';

const IEPSummarizationAndTranslation: React.FC = () => {
  const { t, language, setLanguage, translationsLoaded } = useLanguage();
  const appContext = useContext(AppContext);
  const { addNotification } = useNotifications();
  const apiClient = new ApiClient(appContext);
  
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showJargonDrawer, setShowJargonDrawer] = useState(false);
  const [selectedJargon, setSelectedJargon] = useState<{term: string, definition: string} | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  // Profile-related state
  const [profile, setProfile] = useState<Language | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  
  // Tutorial flow state management
  const [tutorialPhase, setTutorialPhase] = useState<'app-tutorial' | 'parent-rights' | 'completed'>('app-tutorial');

  const [document, setDocument] = useState<IEPDocument>({
    documentId: undefined,
    documentUrl: undefined,
    status: undefined,
    summaries: {
      en: '',
      es: '',
      vi: '',
      zh: ''
    },
    document_index: {
      en: '',
      es: '',
      vi: '',
      zh: ''
    },
    sections: {
      en: [],
      es: [],
      vi: [],
      zh: []
    }
  });
  
  const [activeTab, setActiveTab] = useState<string>('en');
  // Add state for dropdown language selection (separate from global language preference)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const navigate = useNavigate();
  
  // Get preferred language from profile API, fallback to context language, then to 'en'
  const preferredLanguage = profile?.secondaryLanguage || language || 'en';

  // Load profile data on component mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const profileData = await apiClient.profile.getProfile();
        setProfile(profileData);
        
        // Sync the language context if profile has a different secondary language
        if (profileData?.secondaryLanguage && profileData.secondaryLanguage !== language) {
          setLanguage(profileData.secondaryLanguage as SupportedLanguage);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        // Profile loading failure is not critical, continue with context language
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Initialize selectedLanguage and activeTab after document loads
  useEffect(() => {
    // Don't initialize until initial loading is complete
    if (initialLoading) return;
    
    if (preferredLanguage !== 'en' && hasContent(preferredLanguage)) {
      setSelectedLanguage(preferredLanguage);
      setActiveTab(preferredLanguage);
    } else {
      setSelectedLanguage('en');
      setActiveTab('en');
    }
  }, [preferredLanguage, initialLoading, document.summaries, document.sections]);

  // Dynamic language options - only show English and preferred language
  const allLanguageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'zh', label: '中文' },
    { value: 'vi', label: 'Tiếng Việt' }
  ];

  const languageOptions = preferredLanguage === 'en' 
    ? [{ value: 'en', label: 'English' }] 
    : [
        { value: 'en', label: 'English' },
        allLanguageOptions.find(option => option.value === preferredLanguage)!
      ].filter(Boolean);

  // Don't show dropdown if preferred language is English
  const shouldShowLanguageDropdown = preferredLanguage !== 'en';

  // Handle language change - now just controls tab content, no API calls
  const handleLanguageChange = (lang: SupportedLanguage) => {
    // Update dropdown selection and active tab immediately
    setSelectedLanguage(lang);
    setActiveTab(lang);
  };



  // Tutorial flow functions
  const handleSkipToRights = () => {
    setTutorialPhase('parent-rights');
  };

  const handleSkipRights = () => {
    setTutorialPhase('completed');
  };

  // Parent Rights carousel data - internationalized using useLanguage hook
  const parentRightsSlideData = useMemo(() => {
    if (!translationsLoaded) return [];
    
    return [
      {
        id: 'slide-1',
        title: t('rights.slide1.title'),
        content: t('rights.slide1.content'),
        image: '/images/carousel/surprised.png'
      },
      {
        id: 'slide-2',
        title: t('rights.slide2.title'),
        content: t('rights.slide2.content'),
        image: '/images/carousel/blissful.png'
      },
      {
        id: 'slide-3',
        title: t('rights.slide3.title'),
        content: t('rights.slide3.content'),
        image: '/images/carousel/joyful.png'
      },
      {
        id: 'slide-4',
        title: t('rights.slide4.title'),
        content: t('rights.slide4.content'),
        image: '/images/carousel/surprised.png'
      },
      {
        id: 'slide-5',
        title: t('rights.slide5.title'),
        content: t('rights.slide5.content'),
        image: '/images/carousel/blissful.png'
      },
      {
        id: 'slide-6',
        title: t('rights.slide6.title'),
        content: t('rights.slide6.content'),
        image: '/images/carousel/confident.png'
      }
    ];
  }, [t, translationsLoaded]);

      // AppTutorial carousel data - internationalized using useLanguage hook
  const appTutorialSlideData = useMemo(() => {
    if (!translationsLoaded) return [];
    
    return [
      {
        id: 'slide-1',
        title: t('appTutorial.slide1.title'),
        content: t('appTutorial.slide1.content'),
        image: '/images/carousel/surprised.png'
      },
      {
        id: 'slide-2',
        title: t('appTutorial.slide2.title'),
        content: t('appTutorial.slide2.content'),
        image: '/images/carousel/blissful.png'
      },
      {
        id: 'slide-3',
        title: t('appTutorial.slide3.title'),
        content: t('appTutorial.slide3.content'),
        image: '/images/carousel/joyful.png'
      },
      {
        id: 'slide-4',
        title: t('appTutorial.slide4.title'),
        content: t('appTutorial.slide4.content'),
        image: '/images/carousel/surprised.png'
      },
      {
        id: 'slide-5',
        title: t('appTutorial.slide5.title'),
        content: t('appTutorial.slide5.content'),
        image: '/images/carousel/blissful.png'
      },
      {
        id: 'slide-6',
        title: t('appTutorial.slide6.title'),
        content: t('appTutorial.slide6.content'),
        image: '/images/carousel/confident.png'
      }
    ];
  }, [t, translationsLoaded]);

  // Handle jargon click
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('jargon-term')) {
      e.preventDefault();
      const term = target.textContent || '';
      const definition = target.getAttribute('data-tooltip') || '';
      setSelectedJargon({ term, definition });
      setShowJargonDrawer(true);
    }
  };
  
  const sectionConfig = useMemo(() => {
  if (!translationsLoaded) return [];
  
  return [
        { apiName: "Strengths", englishName: "Strengths", displayName: t('sections.strengths') },
        { apiName: "Eligibility", englishName: "Eligibility", displayName: t('sections.eligibility') },
        { apiName: "Present Levels", englishName: "Present Levels of Performance", displayName: t('sections.presentLevels') },
        { apiName: "Goals", englishName: "Goals", displayName: t('sections.goals') },
        { apiName: "Services", englishName: "Services", displayName: t('sections.services') },
        { apiName: "Accommodations", englishName: "Accommodations", displayName: t('sections.accommodations') },
        { apiName: "Placement", englishName: "Placement", displayName: t('sections.placement') },
        { apiName: "Key People", englishName: "Key People", displayName: t('sections.keyPeople') },
        { apiName: "Informed Consent", englishName: "Consent", displayName: t('sections.informedConsent') },
  ];
}, [t, translationsLoaded]);

  const getDisplayName = (apiName: string, useTranslation: boolean = false): string => {
    const config = sectionConfig.find(s => 
      s.apiName === apiName || 
      s.englishName === apiName || 
      apiName.toLowerCase().includes(s.apiName.toLowerCase())
    );
    
    if (!config) return apiName;
    return useTranslation ? config.displayName : config.englishName;
  };

  // Function to sort sections by predefined order
  const sortSections = (sections: IEPSection[]) => {
    return [...sections].sort((a, b) => {
      const indexA = sectionConfig.findIndex(s => 
        s.apiName === a.name || 
        s.englishName === a.name ||
        a.name.toLowerCase().includes(s.apiName.toLowerCase())
      );
      const indexB = sectionConfig.findIndex(s => 
        s.apiName === b.name || 
        s.englishName === b.name ||
        b.name.toLowerCase().includes(s.apiName.toLowerCase())
      );
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  };

  // Process document sections for a specific language
  const processLanguageSections = (doc: any, lang: string) => {
    // Only process sections when document is fully PROCESSED
    if (!doc || doc.status !== "PROCESSED") return;
    
    if (doc.sections && doc.sections[lang]) {
      try {
        const extractedSections = [];
        
        if (Array.isArray(doc.sections[lang])) {
          doc.sections[lang].forEach(section => {
            if (section.title && section.content) {
              extractedSections.push({
                name: section.title,
                displayName: getDisplayName(section.title, lang !== 'en'),
                content: section.content,
                pageNumbers: section.page_numbers || []
              });
            }
          });
        }
        
        const orderedSections = sortSections(extractedSections);
        
        setDocument(prev => ({
          ...prev, 
          sections: { 
            ...prev.sections,
            [lang]: orderedSections
          }
        }));
      } catch (e) {
        console.error(`Error processing ${lang} sections:`, e);
        setDocument(prev => ({
          ...prev, 
          sections: { 
            ...prev.sections,
            [lang]: []
          }
        }));
      }
    } else {
      console.log(`No ${lang} sections found`);
      setDocument(prev => ({
        ...prev, 
        sections: { 
          ...prev.sections,
          [lang]: []
        }
      }));
    }
  };

  // Process all document sections
  const processDocumentSections = (doc: any) => {
    // Process English sections first
    processLanguageSections(doc, 'en');
    
    // Process preferred language if it's not English
    if (preferredLanguage !== 'en') {
      processLanguageSections(doc, preferredLanguage);
    }
  };

    useDocumentFetch({
    translationsLoaded,
    document,
    initialLoading,
    setDocument,
    setError,
    setInitialLoading,
    processDocumentSections
  });


  // Safe check for content availability
  const hasContent = (lang: string) => {
    const hasSummary = Boolean(document.summaries && document.summaries[lang]);
    const hasDocumentIndex = Boolean(document.document_index && document.document_index[lang]);
    const hasSections = Boolean(
      document.sections && 
      document.sections[lang] && 
      document.sections[lang].length > 0
    );
    
    return hasSummary || hasSections || hasDocumentIndex;
  };

  // Check if document is processing (includes both initial processing and translations)
  const isProcessing = document && (document.status === "PROCESSING" || document.status === "PROCESSING_TRANSLATIONS");
  
  // Remove the separate isTranslating check since we're treating translation as part of processing

  // Reset tutorial phase when document status changes from processing
  useEffect(() => {
    if (!isProcessing) {
      setTutorialPhase('completed');
    } else {
      // Reset to app-tutorial when processing starts
      setTutorialPhase('app-tutorial');
    }
  }, [isProcessing]);



  // Set active tab based on selected language and content availability
  useEffect(() => {
    // Don't set active tab during any processing phase
    if (isProcessing) {
      return;
    }
    
    // Set active tab to selected language if content exists, otherwise fall back to English
    if (hasContent(selectedLanguage)) {
      setActiveTab(selectedLanguage);
    } else {
      setActiveTab('en');
      setSelectedLanguage('en');
    }
  }, [selectedLanguage, document.summaries, document.sections, isProcessing]);


  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!canGeneratePDF(document)) {
      setPdfError('No content available for PDF generation');
      return;
    }

    setIsGeneratingPDF(true);
    setPdfError(null);

    try {
      await generatePDF({
        document,
        preferredLanguage
        // Let the PDF generator handle the filename automatically
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Extract filename from document URL
  const getFileName = (documentUrl: string) => {
    if (!documentUrl) return 'Document';
    return documentUrl.split('/').pop() || 'Document';
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch(status) {
      case "PROCESSING":
        return <Badge bg="warning" text="dark"><FontAwesomeIcon icon={faClock} className="me-1" /> Processing</Badge>;
      case "PROCESSING_TRANSLATIONS":
        return <Badge bg="info" text="light"><FontAwesomeIcon icon={faClock} className="me-1" /> Translating</Badge>;
      case "PROCESSED":
        return <Badge bg="success"><FontAwesomeIcon icon={faCheckCircle} className="me-1" /> Processed</Badge>;
      case "FAILED":
        return <Badge bg="danger"><FontAwesomeIcon icon={faExclamationTriangle} className="me-1" /> Failed</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // Render tab content for a specific language
  const renderTabContent = (lang: string) => {
    const hasSummary = document.summaries && document.summaries[lang];
    const hasSections = (
      document.sections && 
      document.sections[lang] && 
      document.sections[lang].length > 0
    );
    
    const isEnglishTab = lang === 'en';

    return (
      <>        
        {/* Summary Section */}
        {hasSummary ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'IEP Summary' : t('summary.iepSummary')}
            </h4>
            <Card className="summary-content mb-3">
              <Card.Body className="py-3">
                <div 
                  className="markdown-content"
                  onClick={handleContentClick}
                  dangerouslySetInnerHTML={{ 
                    __html: processContentWithJargon(document.summaries[lang], lang)
                  }}
                />
              </Card.Body>
            </Card>
          </>
        ) : (
          <Alert variant="info">
            <h5>
              {isEnglishTab 
                ? t('summary.noSummary.title')
                : t('summary.noTranslatedSummary.title')}
            </h5>
            <p>
              {isEnglishTab
                ? t('summary.noSummary.message')
                : t('summary.noTranslatedSummary.message')}
            </p>
            {!isEnglishTab && (
              <div className="mt-3">
                <p className="mb-2">{t('summary.reuploadSuggestion')}</p>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => navigate('/iep-documents')}
                >
                  {t('summary.reuploadButton')}
                </Button>
              </div>
            )}
          </Alert>
        )}
        
        {/* Sections Accordion */}
        {hasSections ? (
          <>
            <h4 className="mt-4 mb-3">
              {isEnglishTab ? 'Key Insights' : t('summary.keyInsights')}
            </h4>
            <Accordion className="mb-3 summary-accordion">
              {document.sections[lang].map((section, index) => (
                <Accordion.Item key={index} eventKey={index.toString()}>
                  <Accordion.Header>
                    {section.displayName}
                  </Accordion.Header>
                  <Accordion.Body>
                    {section.pageNumbers && section.pageNumbers.length > 0 && (
                      <p className="text-muted mb-2">
                        <small>
                          {isEnglishTab ? 'The original content for this section can be found in your IEP document on Pages: ' : 'Páginas: '}
                          {Array.isArray(section.pageNumbers) 
                            ? section.pageNumbers.join(', ') 
                            : section.pageNumbers}
                        </small>
                      </p>
                    )}
                    <div 
                      className="markdown-content"
                      onClick={handleContentClick}
                      dangerouslySetInnerHTML={{ 
                        __html: processContentWithJargon(
                          section.content || t('summary.noContent'), 
                          lang
                        )
                      }}
                    />
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          </>
        ) : (
          <Alert variant="info">
            <h5>
              {isEnglishTab
                ? t('summary.noSections.title')
                : t('summary.noTranslatedSections.title')}
            </h5>
            <p>
              {isEnglishTab
                ? t('summary.noSections.message')
                : t('summary.noTranslatedSections.message')}
            </p>
            {!isEnglishTab && (
              <div className="mt-3">
                <p className="mb-2">{t('summary.reuploadSuggestion')}</p>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => navigate('/iep-documents')}
                >
                  {t('summary.reuploadButton')}
                </Button>
              </div>
            )}
          </Alert>
        )}
      </>
    );
  };

  // Get tab title based on language code
  const getTabTitle = (languageCode: string) => {
    switch(languageCode) {
      case 'en': return t('summary.english');
      case 'es': return 'Español';
      case 'vi': return 'Tiếng Việt';
      case 'zh': return '中文';
      default: return languageCode.toUpperCase();
    }
  };

  // Loading state while translations and profile are being loaded
  if (!translationsLoaded || profileLoading) {
    return (
      <Container className="summary-container mt-4 mb-5">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3">
            {!translationsLoaded && profileLoading ? 'Loading translations and profile...' :
             !translationsLoaded ? 'Loading translations...' : 
             'Loading profile...'}
          </p>
        </div>
      </Container>
    );
  }

  return (
    <>
    <Container className="summary-container mt-3 mb-3">
      <div className="mt-2 text-start button-container d-flex justify-content-between align-items-center">
        <div className="d-flex gap-2 align-items-center">
          {canGeneratePDF(document) && (
            <Button 
              variant="primary" 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF || isProcessing}
            >
              {isGeneratingPDF ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faDownload} className="me-2" />
                  {t('common.save')}
                </>
              )}
            </Button>
          )}
        </div>
        

        
        {/* Language Dropdown - Only show if preferred language is not English and not processing */}
        {shouldShowLanguageDropdown && !isProcessing && (
          <Dropdown>
            <Dropdown.Toggle variant="outline-primary" id="language-dropdown" size="sm">
              {languageOptions.find(option => option.value === selectedLanguage)?.label || 'English'}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {languageOptions.map(option => (
                <Dropdown.Item 
                  key={option.value} 
                  onClick={() => handleLanguageChange(option.value as SupportedLanguage)}
                  active={selectedLanguage === option.value}
                >
                  {option.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        )}
      </div>
      {pdfError && (
        <Alert variant="danger" className="mt-2" dismissible onClose={() => setPdfError(null)}>
          <strong>PDF Generation Failed:</strong> {pdfError}
        </Alert>
      )}
      <Row className="mt-2">
        <Col>
          {error && <Alert variant="danger">{error}</Alert>}
          
          {initialLoading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">{t('summary.loading')}</span>
              </Spinner>
              <p className="mt-3">{t('summary.loading')}</p>
            </div>
          ) : !document ? (
            <Alert variant="info">
              {t('summary.noDocuments')}
            </Alert>
          ) : isProcessing ? (
            <Card className="summary-card summary-card-processing">
              <Card.Body className="summary-card-body pt-2 pb-0">
                <Row>
                  <Col md={12}>
                    {tutorialPhase === 'app-tutorial' ? (
                      <div className="carousel-with-button">
                        <AppTutorialCarousel slides={appTutorialSlideData} />
                        <div className="text-center mt-3">
                          <Button 
                            variant="none"
                            className="custom-carousel-button"
                            onClick={handleSkipToRights}
                          >
                            Skip to Rights
                          </Button>
                        </div>
                      </div>
                    ) : tutorialPhase === 'parent-rights' ? (
                      <div className="carousel-with-button">
                        <ParentRightsCarousel slides={parentRightsSlideData} />
                        <div className="text-center mt-3">
                          <Button 
                            variant="none"
                            className="custom-carousel-button"
                            onClick={handleSkipRights}
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center my-5">
                        <Spinner animation="border" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </Spinner>
                        <p className="mt-3">Processing your document and translations...</p>
                      </div>
                    )}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ) : (
            <Card className="summary-card">
              <Card.Body className="summary-card-body pt-2 pb-0">
                <Row>
                  <Col md={12}>
                    {document.status === "FAILED" ? (
                      <Alert variant="danger">
                        <h5>{t('summary.failed.title')}</h5>
                        <p>{t('summary.failed.message')}</p>
                      </Alert>
                    ) : document.status === "PROCESSED" ? (
                      <>
                        {/* Only show content when document is fully processed */}
                        
                        <Tabs
                          activeKey={activeTab}
                          onSelect={(k) => k && setActiveTab(k)}
                          className="mb-2 mt-2 summary-tabs hidden-tab-nav"
                        >
                          {/* Always show English tab */}
                          <Tab 
                            eventKey="en" 
                            title={t('summary.english')}
                          >
                            {renderTabContent('en')}
                          </Tab>
                          
                          {/* Show preferred language tab if content exists */}
                          {preferredLanguage !== 'en' && hasContent(preferredLanguage) && (
                            <Tab 
                              eventKey={preferredLanguage} 
                              title={
                                <span>
                                  <FontAwesomeIcon icon={faLanguage} className="me-1" />
                                  {getTabTitle(preferredLanguage)}
                                </span>
                              }
                            >
                              {renderTabContent(preferredLanguage)}
                            </Tab>
                          )}
                        </Tabs>
                        
                        {/* Show prominent alert when preferred language content is missing */}
                        {preferredLanguage !== 'en' && !hasContent(preferredLanguage) && hasContent('en') && (
                          <Alert variant="warning" className="mb-3">
                            <div className="d-flex align-items-start">
                              <FontAwesomeIcon icon={faLanguage} className="me-2 mt-1" />
                              <div className="flex-grow-1">
                                <h6 className="mb-2">{t('summary.noPreferredLanguageContent.title')}</h6>
                                <p className="mb-2">{t('summary.noPreferredLanguageContent.message')}</p>
                                <Button 
                                  variant="primary" 
                                  size="sm"
                                  onClick={() => navigate('/iep-documents')}
                                >
                                  {t('summary.reuploadButton')}
                                </Button>
                              </div>
                            </div>
                          </Alert>
                        )}
                        
                        {!hasContent('en') && !hasContent(preferredLanguage) && (
                          <Alert variant="info">
                            <h5>{t('summary.noContentAvailable.title')}</h5>
                            <p>{t('summary.noContentAvailable.message')}</p>
                          </Alert>
                        )}
                      </>
                    ) : (
                      <div className="text-center my-5">
                        <Spinner animation="border" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </Spinner>
                        <p className="mt-3">Processing your document and translations...</p>
                      </div>
                    )}
                  </Col>
                </Row>
              </Card.Body>
            
              {/* Replace Document Button - only shown for processed documents */}
              {document.status === "PROCESSED" && (
                <Card.Header 
                  className="summary-card-header d-flex justify-content-center align-items-center" 
                  onClick={() => navigate('/iep-documents')}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <FontAwesomeIcon icon={faArrowsRotate} className="me-2" />
                    {t('upload.replaceDocument')}
                  </div>
                </Card.Header>
              )}
            </Card>
          )}
        </Col>
      </Row>
      
      {/* Jargon Drawer */}
      <Offcanvas 
        show={showJargonDrawer} 
        onHide={() => setShowJargonDrawer(false)}
        placement="end"
        className="jargon-drawer"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{selectedJargon?.term}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <p>{selectedJargon?.definition}</p>
        </Offcanvas.Body>
      </Offcanvas>
    </Container>
      <MobileBottomNavigation />
        </>
  );
};

export default IEPSummarizationAndTranslation;