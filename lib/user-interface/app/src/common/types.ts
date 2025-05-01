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
  children: Child[];
  createdAt: number;
  updatedAt: number;
  consentGiven: Boolean;
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
  status?: "PROCESSING" | "PROCESSED" | "FAILED";
  createdAt?: string;
  
  // Document content by language
  summaries: {
    en?: string;
    vi?:string;
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
  
  // Raw data
  ocrData?: any;
}