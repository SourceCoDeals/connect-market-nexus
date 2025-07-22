
import React, { createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as AppUser } from "@/types";
import { useOptimizedAuthState } from "@/hooks/auth/use-optimized-auth-state";
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
  // Use the optimized auth state management
  const { 
    user, 
    isLoading, 
    isAdmin, 
    isBuyer, 
    authChecked, 
    refreshUserData,
    clearAuthState 
  } = useOptimizedAuthState();
  
  // Use the enhanced auth actions hook
  const { signUp, signIn, signOut } = useEnhancedAuthActions();

  const refreshUserProfile = async () => {
    if (refreshUserData) {
      await refreshUserData();
    }
  };

  // Optimized signup function
  const signup = async (userData: Partial<AppUser>, password: string) => {
    const email = userData.email;
    if (!email) {
      throw new Error("Email is required for signup");
    }
    
    // Clear any existing auth state first
    await clearAuthState();
    
    const result = await signUp(email, password, userData);
    if (result.error) {
      throw result.error;
    }
  };

  // Optimized login function
  const login = async (email: string, password: string) => {
    console.log('🔐 Starting optimized login process for:', email);
    
    // Clear any existing auth state first
    await clearAuthState();
    
    const result = await signIn(email, password);
    if (result.error) {
      throw result.error;
    }
    
    console.log('✅ Login successful for:', email);
  };

  // Optimized logout function
  const logout = async () => {
    console.log('👋 Starting optimized logout process');
    
    try {
      // Sign out from Supabase first
      await supabase.auth.signOut();
      
      // Then clear local state
      await clearAuthState();
      
      console.log('✅ Logout completed successfully');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Force clear state even if signOut fails
      await clearAuthState();
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
