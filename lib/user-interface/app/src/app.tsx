import { useContext } from "react";
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
  Navigate,
  useLocation
} from "react-router-dom";
import { AppContext } from "./common/app-context";
import GlobalHeader from "./components/global-header";
import Playground from "./pages/chatbot/playground/playground";
import DataPage from "./pages/admin/data-view-page";
import UserFeedbackPage from "./pages/admin/user-feedback-page";
import SessionPage from "./pages/chatbot/sessions/sessions";
import WelcomePage from "./pages/WelcomePage";
import { v4 as uuidv4 } from "uuid";
import "./styles/app.scss";
import ConfigurationPage from "./pages/admin/sys-prompt-config/sys_prompt_config_page";
import LlmEvaluationPage from "./pages/admin/llm-eval/llm-evaluation-page"; 
import DetailedEvaluationPage from "./pages/admin/llm-eval/detailed-evaluation-page";
import PreferredLanguage  from './pages/profile/PreferredLanguage'; 
import City  from './pages/profile/City'; 
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
          <Route path="/city" element={<City />} />
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
            <Route path="/chatbot" element={<Outlet />}>
              <Route path="playground/:sessionId" element={<Playground />} />
              <Route path="sessions" element={<SessionPage />} />              
            </Route>
            <Route path="/admin" element={<Outlet />}>                 
             <Route path="data" element={<DataPage />} />   
             <Route path="configuration" element={<ConfigurationPage />} /> 
             <Route path="user-feedback" element={<UserFeedbackPage />} /> 
             <Route path="llm-evaluation" element={<Outlet />}>
            <Route index element={<LlmEvaluationPage />} />
            <Route
              path=":evaluationId"
              element={
                <DetailedEvaluationPage
                  documentType="detailedEvaluation" 
                />
              }
            />
          </Route>                          
            </Route>            
            <Route path="*" element={<Navigate to={`/chatbot/playground/${uuidv4()}`} replace />} />
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