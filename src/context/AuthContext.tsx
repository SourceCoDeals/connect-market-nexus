
import React, { createContext, useContext } from "react";
import { User as AppUser } from "@/types";
import { useNuclearAuth } from "@/hooks/use-nuclear-auth";

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (userData: Partial<AppUser>, password: string) => Promise<void>;
  updateUserProfile: (data: Partial<AppUser>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
  isBuyer: boolean;
  authChecked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useNuclearAuth();

  const value: AuthContextType = {
    user: auth.user,
    login: auth.login,
    logout: auth.logout,
    signup: auth.signup,
    updateUserProfile: auth.updateUserProfile,
    refreshUserProfile: auth.refreshUserProfile,
    isLoading: auth.isLoading,
    isAdmin: auth.isAdmin,
    isBuyer: auth.isBuyer,
    authChecked: auth.authChecked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
