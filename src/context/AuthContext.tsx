
import React, { createContext, useContext, useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { User as AppUser } from "@/types";
import { useAuthState } from "@/hooks/auth/use-auth-state";
import { useAuthActions } from "@/hooks/auth/use-auth-actions";

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isBuyer: boolean;
  signup: (userData: Partial<AppUser>, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateUserProfile: (data: Partial<AppUser>) => Promise<void>;
  authChecked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  
  // Use the dedicated auth state hook
  const { user, isLoading, isAdmin, isBuyer, authChecked } = useAuthState();
  
  const setUser = React.useCallback((newUser: AppUser | null) => {
    // This is a dummy function that's needed for the useAuthActions hook
    // The actual state management is handled by useAuthState
    console.log("Auth actions setting user:", newUser?.email);
  }, []);
  
  const setLoadingState = React.useCallback((loading: boolean) => {
    // This is a dummy function that's needed for the useAuthActions hook
    // The actual state management is handled by useAuthState
    console.log("Auth actions setting loading:", loading);
  }, []);
  
  // Connect auth actions with the auth state
  const { login, logout, signup, updateUserProfile } = useAuthActions(
    setUser,
    setLoadingState
  );

  // Update session when it changes
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    
    getSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log("Session updated in AuthContext");
      setSession(newSession);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserProfile = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }
      
      if (!sessionData.session) {
        return;
      }
      
      // Fetch user profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionData.session.user.id)
        .single();
      
      if (profileError || !profileData) {
        console.error("Error fetching user profile:", profileError);
        return;
      }
      
      // We don't need to update state here as useAuthState handles it
      setSession(sessionData.session);
    } catch (error) {
      console.error("Error refreshing user profile:", error);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    isAdmin,
    isBuyer,
    signup,
    login,
    logout,
    refreshUserProfile,
    updateUserProfile,
    authChecked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
