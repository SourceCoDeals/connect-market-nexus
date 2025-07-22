
import React, { createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as AppUser } from "@/types";
import { useSimpleAuthState } from "@/hooks/auth/use-simple-auth-state";
import { useSimpleAuthActions } from "@/hooks/auth/use-simple-auth-actions";

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
  // Use the new simplified auth state management
  const { 
    user, 
    isLoading, 
    isAdmin, 
    isBuyer, 
    authChecked, 
    refreshUserData,
    clearAuthState 
  } = useSimpleAuthState();
  
  // Use the new simplified auth actions hook
  const { signUp, signIn, signOut } = useSimpleAuthActions();

  const refreshUserProfile = async () => {
    if (refreshUserData && user?.id) {
      await refreshUserData(user.id);
    }
  };

  // Create wrapper functions to match the expected interface
  const signup = async (userData: Partial<AppUser>, password: string) => {
    const email = userData.email;
    if (!email) {
      throw new Error("Email is required for signup");
    }
    
    const result = await signUp(email, password, userData);
    if (result.error) {
      throw result.error;
    }
  };

  const login = async (email: string, password: string) => {
    console.log('🔐 Starting login process for:', email);
    
    const result = await signIn(email, password);
    if (result.error) {
      throw result.error;
    }
    
    console.log('✅ Login successful for:', email);
  };

  const logout = async () => {
    console.log('👋 Starting logout process');
    
    // Clear local state first for immediate UI update
    await clearAuthState();
    
    // Then sign out from Supabase
    const result = await signOut();
    if (result.error) {
      console.warn('⚠️ Logout had errors but continuing:', result.error);
      // Don't throw - user is already logged out locally
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

    // Refresh the profile data
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
