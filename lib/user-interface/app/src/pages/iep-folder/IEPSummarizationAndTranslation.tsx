import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Button, Badge, Accordion, Tabs, Tab, Offcanvas, Dropdown} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { faFileAlt, faClock, faCheckCircle, faExclamationTriangle, faLanguage, faDownload, faArrowsRotate, faForward } from '@fortawesome/free-solid-svg-icons';
import './IEPSummarizationAndTranslation.css';
import { IEPDocument, IEPSection, Language, UserProfile } from '../../common/types';
import { useLanguage, SupportedLanguage } from '../../common/language-context';
import { useDocumentFetch, processContentWithJargon } from '../utils';
import MobileBottomNavigation from '../../components/MobileBottomNavigation';
// PDF generation now handled by API client
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  
  // Tutorial flow state management
  const [tutorialPhase, setTutorialPhase] = useState<'app-tutorial' | 'parent-rights' | 'completed'>('app-tutorial');

  const [document, setDocument] = useState<IEPDocument>({
    documentId: undefined,
    documentUrl: undefined,
    status: undefined,
    message: '',
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
  const shouldShowLanguageDropdown = preferredLanguage !== 'en' && document.status && document.status === "PROCESSED" && Object.keys(document.summaries).length > 1;

  // Handle language change - now just controls tab content, no API calls
  const handleLanguageChange = (lang: SupportedLanguage) => {
    // Update dropdown selection and active tab immediately
    setSelectedLanguage(lang);
    setActiveTab(lang);
  };


  // Unified skip handler for the external button
  const handleSkip = () => {
    if (tutorialPhase === 'app-tutorial') {
      setTutorialPhase('parent-rights');
    } else if (tutorialPhase === 'parent-rights') {
      setTutorialPhase('completed');
    }
  };

  // Back button handler
  const handleBack = () => {
    if (tutorialPhase === 'parent-rights') {
      setTutorialPhase('app-tutorial');
    }
  };

  // Handle when user reaches the last slide in app tutorial
  const handleLastSlideReached = () => {
    if (tutorialPhase === 'app-tutorial') {
      setTutorialPhase('parent-rights');
    }
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
        image: '/images/Opening_Section_Accordion.gif'
      },
      {
        id: 'slide-2',
        title: t('appTutorial.slide2.title'),
        content: t('appTutorial.slide2.content'),
        image: '/images/Highlighting_Page_Numbers.gif'
      },
      {
        id: 'slide-3',
        title: t('appTutorial.slide3.title'),
        content: t('appTutorial.slide3.content'),
        image: '/images/Language_Switch.gif'
      },
      {
        id: 'slide-4',
        title: t('appTutorial.slide4.title'),
        content: t('appTutorial.slide4.content'),
        image: '/images/Opening_Section_Accordion.gif'
      },
      {
        id: 'slide-5',
        title: t('appTutorial.slide5.title'),
        content: t('appTutorial.slide5.content'),
        image: '/images/Opening_Section_Accordion.gif'
      },
      {
        id: 'slide-6',
        title: t('appTutorial.slide6.title'),
        content: t('appTutorial.slide6.content'),
        image: '/images/Jargon_Drawer.gif'
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
    if (!apiClient.pdf.canGeneratePDF(document)) {
      setPdfError('No content available for PDF generation');
      return;
    }

    setIsGeneratingPDF(true);
    setPdfError(null);

    try {
      await apiClient.pdf.generatePDF({
        document,
        preferredLanguage,
        fileName: 'IEP_Summary_and_Translations'
      });
      
      // Show success notification
      addNotification('success', 'PDF generated successfully!');
    } catch (error) {
      console.error('PDF generation failed:', error);
      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF');
      
      // Show error notification
      addNotification('error', `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingPDF(false);
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
            <h4 className="summary-header mt-4 mb-3">
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
            <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => navigate('/iep-documents')}
                >
                  {t('summary.reuploadButton')}
            </Button>
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
                      <p className="text-muted mb-2 page-numbers-text">
                        <small>
                          <span className="page-numbers-label">
                            {isEnglishTab ? 'Found in ' : t('sections.foundIn') + ' '}
                          </span>
                          <span className="page-numbers-value">
                            {isEnglishTab ? 'pages ' : t('sections.pages') + ' '}
                            {Array.isArray(section.pageNumbers) 
                              ? section.pageNumbers.join(', ') 
                              : section.pageNumbers}
                          </span>
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
            <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => navigate('/iep-documents')}
                >
                  {t('summary.reuploadButton')}
            </Button>
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

  // Handle initial loading and no document states first
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

  if (initialLoading) {
    return (
      <>
        <Container className="summary-container mt-3 mb-3">
          <Row className="mt-2">
            <Col>
              <div className="text-center my-5">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">{t('summary.loading')}</span>
                </Spinner>
                <p className="mt-3">{t('summary.loading')}</p>
              </div>
            </Col>
          </Row>
        </Container>
        <MobileBottomNavigation />
      </>
    );
  }


  if (!document) {
    return (
      <>
        <Container className="summary-container mt-3 mb-3">
          <Row className="mt-2">
            <Col>
              <Alert variant="info">
                {t('summary.noDocuments')}
              </Alert>
            </Col>
          </Row>
        </Container>
        <MobileBottomNavigation />
      </>
    );
  }


if(profile.showOnboarding){
  navigate('/');
  return null;
}



if(document && document.message === "No document found for this child") {
    navigate('/iep-documents');
}

  // Processing Container - when document is being processed
  if (isProcessing) {
    return (
      <>
        <Container className="processing-summary-container">

              {error && <Alert variant="danger">{error}</Alert>}
              
              {/* Button container - only shown during tutorial phases */}
              {(tutorialPhase === 'app-tutorial' || tutorialPhase === 'parent-rights') && (
                <div className="d-flex justify-content-between align-items-center mb-3 px-3 py-4 tutorial-button-container">
                  {/* Back button - only shown during parent-rights phase */}
                  {tutorialPhase === 'parent-rights' ? (
                    <Button 
                      variant="outline-secondary" 
                      onClick={handleBack}
                    >
                      {t('common.back')}
                    </Button>
                  ) : (
                    <div></div>
                  )}
                  
                  {/* Skip button */}
                  <Button 
                    variant="outline-secondary" 
                    onClick={handleSkip}
                  >
                    {t('common.skip')}
                  </Button>
                </div>
              )}
              
              {/* Title div - only shown during tutorial phases */}
              {(tutorialPhase === 'app-tutorial' || tutorialPhase === 'parent-rights') && (
                <div className="text-center py-2 tutorial-title-container">


                  <h3>
                    {tutorialPhase === 'app-tutorial' 
                      ? t('tutorial.appTutorial.title')
                      : t('tutorial.parentRights.title')
                    }
                  </h3>
                  {
                    tutorialPhase === 'app-tutorial' && (
                      <p className="text-muted text-center example-video-text">{t('tutorial.exampleVideo')}</p>
                    )
                  }             
                </div>
              )}
              
              {tutorialPhase === 'app-tutorial' ? (
                <Card className="processing-summary-app-tutorial-card">
                  <Card.Body className="processing-summary-card-body pt-0 pb-0">
                    <div className="carousel-with-button">
                      <AppTutorialCarousel slides={appTutorialSlideData} onLastSlideReached={handleLastSlideReached} />
                    </div>
                  </Card.Body>
                </Card>
              ) : tutorialPhase === 'parent-rights' ? (
                <Card className="processing-summary-parent-rights-card">
                  <Card.Body className="processing-summary-card-body pt-0 pb-0">
                    <div className="carousel-with-button">
                      <ParentRightsCarousel slides={parentRightsSlideData} />
                    </div>
                  </Card.Body>
                </Card>
              ) : (
                <Card className="processing-summary-loader-card">
                  <Card.Body className="processing-summary-card-body pt-0 pb-0">
                  </Card.Body>
                </Card>
              )}
        </Container>
        <MobileBottomNavigation tutorialPhaseEnabled={true} tutorialPhase={tutorialPhase}/>
      </>
    );
  }

  // If document fails the user is taken to the upload screen
  if (document && document.status === "FAILED") {
    navigate('/iep-documents');
  }

  // Processed Container - when document is processed, failed, or in other states
  return (
    <>
      <Container className="summary-container mt-3 mb-3">
        <div className="mt-2 text-start button-container d-flex justify-content-between align-items-center">
          <div className="d-flex gap-2 align-items-center">
            {apiClient.pdf.canGeneratePDF(document) && (
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
          {shouldShowLanguageDropdown && !isProcessing && document && document.status === "PROCESSED" && (
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
            
            <Card className="summary-card">
              <Card.Body className="summary-card-body pt-2 pb-0">
                <Row>
                  <Col md={12}>
                    {document.status === "FAILED" ? (
                      <Alert variant="danger">
                        <h5>{t('summary.failed.title')}</h5>
                        <p>{t('summary.failed.message')}</p>
                      </Alert>
                    ) : 
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
                            <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => navigate('/iep-documents')}
                >
                  {t('summary.reuploadButton')}
                </Button>
                          </Alert>
                        )}
                      </>
                  }
                  </Col>
                </Row>
              </Card.Body>
            
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
            <Offcanvas.Title>{t('glossary.header')}</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <h3>{selectedJargon?.term}</h3>
            <p>{selectedJargon?.definition}</p>
          </Offcanvas.Body>
        </Offcanvas>
      </Container>
      <MobileBottomNavigation />
    </>
  );
};

export default IEPSummarizationAndTranslation;