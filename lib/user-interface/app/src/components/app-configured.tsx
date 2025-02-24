import { useEffect, useState } from "react";
import {
  ThemeProvider,
  defaultDarkModeOverride,
} from "@aws-amplify/ui-react";
import App from "../app";
import { Amplify, Auth } from "aws-amplify";
import { AppConfig } from "../common/types";
import { AppContext } from "../common/app-context";
import { AuthContext } from "../common/auth-context"; // Import AuthContext
import { Alert, StatusIndicator } from "@cloudscape-design/components";
import { StorageHelper } from "../common/helpers/storage-helper";
import { Mode } from "@cloudscape-design/global-styles";
import "@aws-amplify/ui-react/styles.css";
import CustomLogin from "./CustomLogin";

// AppConfigured component is a wrapper around the app component which has the global header and different routes
// In main.tsx , the application renders AppConfigured as the root component

export default function AppConfigured() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(null);
  const [theme, setTheme] = useState(StorageHelper.getTheme());
  const [configured, setConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

// This useEffect hook runs once when the component mounts and handles two critical setup tasks:
// 1. Loads and configures AWS services using aws-exports.json
// 2. Checks if there's an existing authenticated user session
  useEffect(() => {
    const loadConfig = async () => {
      // Load AWS Configuration
      // Fetch AWS configuration from aws-exports.json which contains: Cognito User Pool settings, API endpoints & OAuth settings
      try {
        const result = await fetch("/aws-exports.json");
        const awsExports = await result.json();

        // Configure Amplify with the loaded settings
        // This sets up authentication, API clients, and other AWS services
        Amplify.configure(awsExports);

        // Store configuration in state
        setConfig(awsExports);
        setConfigured(true);
        
        // Attempt to retrieve the current authenticated user session
        try {
          const user = await Auth.currentAuthenticatedUser();
          // If a valid session exists, update authentication state
          if (user) {
            setAuthenticated(true);
          }
        } catch (e) {
          // User will need to log in through CustomLogin component
          console.log("No authenticated user found");
        }
      } catch (e) {
        // Unable to load AWS configuration
        console.error("Error loading configuration:", e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadConfig();
  }, []);

    // When the login is successful in CustomLoginComponent this callback is called which causes re-render of AppConfigured 
    // In the re-render authenticated is false and App component is returned
    const handleLoginSuccess = () => {
      setAuthenticated(true);
    };

// This useEffect was specifically for Cloudscape Design System's theming
// Will need to be reimplemented differently for React Bootstrap theming  
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

  // Initially set to true then set to false when the configurations are loaded
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

    // Intially see to false and displayed only if there is an error in displaying configurations
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

  // If not authenticated, show custom login
  // In case of correct credentials CustomLogin component sets authenticated to true
  if (!authenticated) {
    return <CustomLogin onLoginSuccess={  handleLoginSuccess } />;
  }

  // Auth.currentAuthenticatedUser() returns true or user enters correct credentials and 
  return (
  <AuthContext.Provider value={{ authenticated, setAuthenticated }}>
    <AppContext.Provider value={config}>
      <ThemeProvider
        theme={{
          name: "default-theme",
          overrides: [defaultDarkModeOverride],
        }}
        colorMode={theme === Mode.Dark ? "dark" : "light"}
      >
        <App />
      </ThemeProvider>
    </AppContext.Provider>
    </AuthContext.Provider>
  );
}
