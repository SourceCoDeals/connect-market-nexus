
import React, { createContext, useContext, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as AppUser } from "@/types";
import { useFreshAuthState } from "@/hooks/auth/use-fresh-auth-state";
import { useEnhancedAuthActions } from "@/hooks/auth/use-enhanced-auth-actions";

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
  // Use the new robust auth state management
  const { 
    user, 
    isLoading, 
    isAdmin, 
    isBuyer, 
    authChecked, 
    refreshUserData,
    clearAuthState 
  } = useFreshAuthState();
  
  // Use the enhanced auth actions hook
  const { signUp, signIn, signOut } = useEnhancedAuthActions();

  const refreshUserProfile = async () => {
    if (refreshUserData) {
      await refreshUserData();
    }
  };

  // Create wrapper functions to match the expected interface
  const signup = async (userData: Partial<AppUser>, password: string) => {
    const email = userData.email;
    if (!email) {
      throw new Error("Email is required for signup");
    }
    
    if (user) {
      await clearAuthState();
    }
    
    const result = await signUp(email, password, userData);
    if (result.error) {
      throw result.error;
    }
  };

  const login = async (email: string, password: string) => {
    console.log('🔐 Starting login process for:', email);
    
    if (user) {
      await clearAuthState();
    }
    
    const result = await signIn(email, password);
    if (result.error) {
      throw result.error;
    }
    
    console.log('✅ Login successful for:', email);
  };

  const logout = async () => {
    console.log('👋 Starting logout process');
    await clearAuthState();
    
    const result = await signOut();
    if (result.error) {
      throw result.error;
    }
  };

  const updateUserProfile = async (data: Partial<AppUser>) => {
    if (!user) {
      throw new Error("No user logged in");
    }

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    await refreshUserProfile();
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    signup,
    updateUserProfile,
    refreshUserProfile,
    isLoading,
    isAdmin,
    isBuyer,
    authChecked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
