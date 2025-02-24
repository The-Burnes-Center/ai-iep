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
export interface Kid {
  kidId?: string;
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
  kids: Kid[];
  createdAt: number;
  updatedAt: number;
}

export interface ProfileResponse {
  profile: UserProfile;
}

export interface KidResponse {
  message: string;
  kidId: string;
  createdAt: number;
  updatedAt: number;
}