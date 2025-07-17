
import React, { createContext, useContext, useEffect } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { User as AppUser } from "@/types";
import { useAuthState } from "@/hooks/auth/use-auth-state";
import { useEnhancedAuthActions } from "@/hooks/auth/use-enhanced-auth-actions";
import { isUserAdmin } from "@/lib/auth-helpers";

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
  // Use the dedicated auth state hook
  const { user, isLoading, isAdmin, isBuyer, authChecked } = useAuthState();
  
  // Use the enhanced auth actions hook
  const { signUp, signIn, signOut } = useEnhancedAuthActions();

  // Subscribe to profile changes for real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('profile-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        console.log('📡 Profile updated in real-time:', payload);
        // Trigger a refresh of the user profile to get the latest data
        setTimeout(() => {
          refreshUserProfile();
        }, 100);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const refreshUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error refreshing user profile:', error);
        return;
      }

      // The profile data will be automatically updated through the useAuthState hook
      console.log('Profile refreshed:', data);
    } catch (error) {
      console.error('Error refreshing user profile:', error);
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
    const result = await signIn(email, password);
    if (result.error) {
      throw result.error;
    }
  };

  const logout = async () => {
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

    // Refresh the profile data
    await refreshUserProfile();
  };

  // Update session when it changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);
        if (event === 'SIGNED_IN' && session?.user) {
          console.log("User signed in, updating profile");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
