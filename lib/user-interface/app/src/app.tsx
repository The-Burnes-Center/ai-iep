import React from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import GlobalHeader from "./components/global-header";
import WelcomePage from "./pages/WelcomePage";
import "./styles/app.scss";
import "./styles/modal.css";
import "./styles/buttons.css";
import { trackPageView } from './common/helpers/analytics-helper';
import PreferredLanguage  from './pages/profile/PreferredLanguage'; 
import OnboardingUser from './pages/profile/OnboardingUser';
import UserProfileForm from './pages/profile/UserProfileForm';
import IEPDocumentView from './pages/iep-folder/IEPDocumentView';
import SummaryAndTranslationsPage from './pages/iep-folder/SummaryAndTranslationsPage';
import ViewAndAddChild from './pages/profile/ViewAndAddChild';
import ViewAndAddParent from './pages/profile/ViewAndAddParent';
import UpdateProfileName from './pages/profile/UpdateProfileName';
import RevokeConsent from './pages/profile/RevokeConsent';
import RightsAndOnboarding from './pages/RightsAndOnboarding';
import ConsentForm from './pages/profile/ConsentForm';
import WelcomeIntro from './pages/profile/WelcomeIntro';
import AboutApp from './pages/profile/AboutApp';
import FrequentlyAskedQuestions from './components/FrequentlyAskedQuestions';
import AccountCenter from './pages/profile/AccountCenter';
import SupportCenter from './pages/profile/SupportCenter';
import SurveyForm from "./components/SurveyForm";
import AboutAIEP from './components/AboutAIEP';
import DeleteAccount from "./pages/profile/DeleteAccount";
import ChangeLanguage from "./pages/profile/ChangeLanguage";
import ParentRights from "./pages/ParentRights";
 

function AppContent() {
  const location = useLocation();
  
  // Track page views when location changes
  React.useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  
  
  // TODO: remove shouldShowHeader which remains from earlier implementation of GlobalHeader
  const shouldShowHeader = false;
  
  return (
    <div style={{ height: "100%" }}>
      {shouldShowHeader && <GlobalHeader />}
      <div style={{ 
        height: "0", 
        backgroundColor: "transparent" 
      }}>&nbsp;</div>
      
      {/* <div> */}
        <Routes>    
          <Route path="/" element={<PreferredLanguage  />} />
          <Route path="/onboarding-user" element={<OnboardingUser />} />
          <Route path="/consent-form" element={<ConsentForm />} />
          <Route path="/welcome-intro" element={<WelcomeIntro />} />
          <Route path="/about-app" element={<AboutApp />} />
          <Route
                index
                path="/welcome-page"
                element={<WelcomePage />} 
            />        
          <Route
                path="/view-update-add-child"
                element={<ViewAndAddChild />} 
            />
          <Route
                path="/view-and-add-parent"
                element={<ViewAndAddParent />} 
            />
            <Route path="/profile" element={<UserProfileForm />} />
            <Route path="/account-center/profile" element={<UpdateProfileName />} />
            <Route path="/account-center" element={<AccountCenter />} />
            <Route path="/support-center" element={<SupportCenter />} />
            <Route path="/account-center/delete-account" element={<DeleteAccount />} />
            <Route path="/account-center/change-language" element={<ChangeLanguage />} />
            <Route path="/iep-documents" element={<IEPDocumentView />} />
            <Route path="/rights-and-onboarding" element={<RightsAndOnboarding />} />
            <Route path="/parent-rights" element={<ParentRights />} />
            <Route path="/summary-and-translations" element={<SummaryAndTranslationsPage />} /> 
            <Route path="/revoke-consent" element={<RevokeConsent />} />
            <Route path="/frequently-asked-questions" element={<FrequentlyAskedQuestions />} />
            <Route path="/survey-form" element={<SurveyForm />} />
            <Route path="/about-aiep" element={<AboutAIEP />} />
        </Routes>
      {/* </div> */}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App; 