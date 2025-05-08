
import React, { createContext, useContext, useState } from "react";
import { User } from "@/types";
import { useAuthState } from "@/hooks/auth/use-auth-state";
import { useAuthActions } from "@/hooks/auth/use-auth-actions";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (userData: Partial<User>, password: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  isAdmin: boolean;
  isBuyer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: isStateLoading, isAdmin, isBuyer } = useAuthState();
  const combinedIsLoading = isLoading || isStateLoading;
  
  // Create a state setter for user that we can pass to the actions hook
  const [_, setUserState] = useState<User | null>(user);
  const setUser = (newUser: User | null) => setUserState(newUser);
  
  const { login, logout, signup, updateUserProfile } = useAuthActions(setUser, setIsLoading);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: combinedIsLoading,
        login,
        logout,
        signup,
        updateUserProfile,
        isAdmin,
        isBuyer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
