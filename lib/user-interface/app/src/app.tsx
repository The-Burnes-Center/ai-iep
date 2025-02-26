import { useContext } from "react";
import {
  BrowserRouter,
  HashRouter,
  Outlet,
  Route,
  Routes,
  Navigate,
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
import UserProfileForm from './pages/profile/UserProfileForm';
import IEPDocumentView from './pages/iep-folder/IEPDocumentView';

function App() {
  const appContext = useContext(AppContext);
  const Router = BrowserRouter;

  return (
    <div style={{ height: "100%" }}>
      <Router>
        <GlobalHeader />
        <div style={{ height: "56px", backgroundColor: "#000716" }}>&nbsp;</div>
        <div>
          <Routes>    
          {/* "/" path now takes us to a Welcome page */}
          <Route
                index
                path="/"
                element={<WelcomePage />} 
            />        
            {/* <Route
                index
                path="/"
                element={<Navigate to={`/chatbot/playground/${uuidv4()}`} replace />}
            />             */}
            <Route path="/profile" element={<UserProfileForm />} />
            <Route path="/iep-documents" element={<IEPDocumentView />} />
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
      </Router>
    </div>
  );
}

export default App;
