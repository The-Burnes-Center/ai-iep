import { useContext } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import { AppContext } from "./common/app-context";
import GlobalHeader from "./components/global-header";
import WelcomePage from "./pages/WelcomePage";
import "./styles/app.scss";
import PreferredLanguage  from './pages/profile/PreferredLanguage'; 
import UserProfileForm from './pages/profile/UserProfileForm';
import IEPDocumentView from './pages/iep-folder/IEPDocumentView';
import SummaryAndTranslationsPage from './pages/iep-folder/SummaryAndTranslationsPage';
import ViewAndAddChild from './pages/profile/ViewAndAddChild';
import RightsAndOnboarding from './pages/RightsAndOnboarding';
import ConsentForm from './pages/profile/ConsentForm';

function AppContent() {
  const location = useLocation();
  const appContext = useContext(AppContext);
  
  // Routes where header should be hidden
  const hideHeaderRoutes = ["/", "/consent-form", "/city","/view-update-add-child"];
  
  // Check if current location is in the list of routes where header should be hidden
  const shouldShowHeader = !hideHeaderRoutes.includes(location.pathname);
  
  return (
    <div style={{ height: "100%" }}>
      {shouldShowHeader && <GlobalHeader />}
      <div style={{ 
        height: shouldShowHeader ? "56px" : "0", 
        backgroundColor: shouldShowHeader ? "#000716" : "transparent" 
      }}>&nbsp;</div>
      
      <div>
        <Routes>    
          <Route path="/" element={<PreferredLanguage  />} />
          <Route path="/consent-form" element={<ConsentForm />} />
          <Route
                index
                path="/welcome-page"
                element={<WelcomePage />} 
            />        
          <Route
                path="/view-update-add-child"
                element={<ViewAndAddChild />} 
            />
            <Route path="/profile" element={<UserProfileForm />} />
            <Route path="/iep-documents" element={<IEPDocumentView />} />
            <Route path="/rights-and-onboarding" element={<RightsAndOnboarding />} />           
            <Route path="/summary-and-translations" element={<SummaryAndTranslationsPage />} /> 
        </Routes>
      </div>
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