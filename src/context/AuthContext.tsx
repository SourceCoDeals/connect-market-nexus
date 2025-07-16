
import React, { createContext, useContext, useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { User as AppUser } from "@/types";
import { useAuthState } from "@/hooks/auth/use-auth-state";
import { useAuthActions } from "@/hooks/auth/use-auth-actions";
import { isUserAdmin } from "@/lib/auth-helpers";

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
  }, []);
  
  // Connect auth actions with the auth state
  const { login, logout, signup, updateUserProfile } = useAuthActions(
    setUser,
    setLoadingState
  );

  // Update session when it changes
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error) {
          setSession(data.session);
        } else {
          console.error("Error getting session:", error);
          setSession(null);
        }
      } catch (err) {
        console.error("Unexpected error getting session:", err);
        setSession(null);
      }
    };
    
    getSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("Auth state change event:", event);
      setSession(newSession);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        console.log("User signed in or updated, refreshing profile");
        // Use setTimeout to avoid Supabase auth deadlocks
        setTimeout(() => {
          refreshUserProfile();
        }, 0);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserProfile = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error during refresh:", sessionError);
        return;
      }
      
      if (!sessionData.session) {
        console.log("No active session during refresh");
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
      console.log("User profile refreshed successfully");
    } catch (error) {
      console.error("Error refreshing user profile:", error);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    isAdmin: isUserAdmin(user), // Use helper function for consistent logic
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
