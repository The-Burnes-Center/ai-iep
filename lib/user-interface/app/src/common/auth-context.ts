import { createContext } from "react";

export interface AuthContextType {
  authenticated: boolean;
  setAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  setAuthenticated: () => {},
});