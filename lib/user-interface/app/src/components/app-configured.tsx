import { useEffect, useState } from "react";
import App from "../app";
import { Amplify, Auth } from "aws-amplify";
import { AppConfig } from "../common/types";
import { AppContext } from "../common/app-context";
import { LanguageProvider } from "../common/language-context";
import { AuthContext } from "../common/auth-context"; 
import { Alert, StatusIndicator } from "@cloudscape-design/components";
import { StorageHelper } from "../common/helpers/storage-helper";
import { Mode } from "@cloudscape-design/global-styles";
import CustomLogin from "./CustomLogin";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
      },
    },
  }); 

export default function AppConfigured() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(null);
  const [theme, setTheme] = useState(StorageHelper.getTheme());
  const [configured, setConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await fetch("/aws-exports.json");
        const awsExports = await result.json();

        Amplify.configure(awsExports);

        setConfig(awsExports);
        setConfigured(true);
        
        try {
          const user = await Auth.currentAuthenticatedUser();
          if (user) {
            setAuthenticated(true);
          }
        } catch (e) {
          console.log("No authenticated user found");
        }
      } catch (e) {
        console.error("Error loading configuration:", e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadConfig();
  }, []);

  const handleLoginSuccess = () => {
    setAuthenticated(true);
  };

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          const newValue =
            document.documentElement.style.getPropertyValue(
              "--app-color-scheme"
            );

          const mode = newValue === "dark" ? Mode.Dark : Mode.Light;
          if (mode !== theme) {
            setTheme(mode);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
    };
  }, [theme]);

  if (isLoading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusIndicator type="loading">Loading</StatusIndicator>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Alert header="Configuration error" type="error">
          Error loading configuration from "
          <a href="/aws-exports.json" style={{ fontWeight: "600" }}>
            /aws-exports.json
          </a>
          "
        </Alert>
      </div>
    );
  }

  // Important: Wrapping the CustomLogin component with LanguageProvider
  // ensures the login flow has access to translations
  if (!authenticated) {
    return (
      <AppContext.Provider value={config}>
        <LanguageProvider>
            <CustomLogin onLoginSuccess={handleLoginSuccess} />
        </LanguageProvider>
      </AppContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ authenticated, setAuthenticated }}>
      <AppContext.Provider value={config}>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </LanguageProvider>
      </AppContext.Provider>
    </AuthContext.Provider>
  );
}