import { SelectProps } from "@cloudscape-design/components";
import { CognitoHostedUIIdentityProvider } from "@aws-amplify/auth";

export interface AppConfig {
  Auth: {
        region: string,
        userPoolId: string,
        userPoolWebClientId: string,
        oauth: {
          domain: string,
          scope: string[],
          redirectSignIn: string,
          // redirectSignOut: "https://myapplications.microsoft.com/",
          responseType: string,
        }
      },
      httpEndpoint : string,
      wsEndpoint : string,
      federatedSignInProvider : string,
}

export interface NavigationPanelState {
  collapsed?: boolean;
  collapsedSections?: Record<number, boolean>;
}

export type LoadingStatus = "pending" | "loading" | "finished" | "error";
export type AdminDataType =
| "file"
| "feedback"
| "evaluationSummary"
| "detailedEvaluation"
| "prompt";

// In src/common/types.ts
export interface Child {
  childId?: string;
  name: string;
  schoolCity: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  phone: string;
  primaryLanguage: string;
  secondaryLanguage: string;
  city: string;
  parentName: string;
  children: Child[];
  createdAt: number;
  updatedAt: number;
  consentGiven: Boolean;
  showOnboarding: Boolean;
}

export interface Language {
  primaryLanguage: string;
  secondaryLanguage: string;
}

export interface ProfileResponse {
  profile: UserProfile;
}

export interface ChildResponse {
  message: string;
  childId: string;
  createdAt: number;
  updatedAt: number;
}

// Add to types.ts
export interface IEPSection {
  name: string;
  displayName: string;
  content: string;
  pageNumbers?: number[];
}

export interface IEPDocument {
  // Basic document info
  documentId?: string;
  documentUrl?: string;
  status?: "PROCESSING" | "PROCESSING_TRANSLATIONS" | "PROCESSED" | "FAILED";
  progress?: number; // Processing progress percentage (0-100)
  current_step?: string; // Current processing step (e.g., "initializing", "ocr_complete", "redacting", etc.)
  createdAt?: string;
  message?: string;
  
  // Document content by language
  abbreviations?: {
    en?: Array<{
      abbreviation: string;
      full_form: string;
    }>;
  };
  summaries: {
    en?: string;
    vi?:string;
    es?: string;
    zh?: string;
    // Add other languages as needed
  };
  
  // Document index (Table of Contents)
  document_index: {
    en?: string;
    vi?: string;
    es?: string;
    zh?: string;
    // Add other languages as needed
  };
  
  sections: {
    en: IEPSection[];
    vi: IEPSection[];
    es: IEPSection[];
    zh: IEPSection[];
    // Add other languages as needed
  };
  
  // Missing information insights by language
  missingInfo?: {
    en?: Array<{
      category: string;
      description: string;
    }>;
    vi?: Array<{
      category: string;
      description: string;
    }>;
    es?: Array<{
      category: string;
      description: string;
    }>;
    zh?: Array<{
      category: string;
      description: string;
    }>;
    // Add other languages as needed
  };
  
  // Raw data
  ocrData?: any;
}