
import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { User as AppUser } from "@/types";
import { toast } from "@/hooks/use-toast";
import { createUserObject } from "@/lib/auth-helpers";

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (userData: Partial<AppUser>, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refreshUserProfile = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }
      
      if (!sessionData.session) {
        setUser(null);
        setSession(null);
        return;
      }
      
      // Fetch user profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionData.session.user.id)
        .single();
      
      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        return;
      }
      
      if (profileData) {
        const appUser = createUserObject(profileData);
        setUser(appUser);
        setSession(sessionData.session);
      }
    } catch (error) {
      console.error("Error refreshing user profile:", error);
    }
  };

  useEffect(() => {
    const setupAuth = async () => {
      setIsLoading(true);
      try {
        // First set up the auth state change listener
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, currentSession) => {
            console.log("Auth state change event:", event);
            
            // Handle user session updates
            if (currentSession && event !== "SIGNED_OUT") {
              try {
                // Get user profile from profiles table
                const { data: profileData, error: profileError } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", currentSession.user.id)
                  .single();
                
                if (profileError) {
                  console.error("Error fetching user profile on auth change:", profileError);
                  setUser(null);
                  return;
                }
                
                if (profileData) {
                  const appUser = createUserObject(profileData);
                  setUser(appUser);
                  setSession(currentSession);
                  
                  // Redirect based on user status
                  setTimeout(() => {
                    if (!profileData.email_verified) {
                      navigate("/verify-email");
                    } else if (profileData.approval_status !== "approved") {
                      navigate("/pending-approval");
                    } else if (window.location.pathname === "/login" || 
                              window.location.pathname === "/signup" ||
                              window.location.pathname === "/verify-email" ||
                              window.location.pathname === "/pending-approval") {
                      navigate("/");
                    }
                  }, 0);
                }
              } catch (err) {
                console.error("Error in auth state change handler:", err);
              }
            } else {
              // User signed out or no session
              setUser(null);
              setSession(null);
            }
          }
        );

        // Then check for existing session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting auth session:", error);
          setIsLoading(false);
          return;
        }
        
        if (data.session) {
          // Get user profile
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.session.user.id)
            .single();
          
          if (profileError) {
            console.error("Error fetching initial user profile:", profileError);
            setIsLoading(false);
            return;
          }
          
          if (profileData) {
            const appUser = createUserObject(profileData);
            setUser(appUser);
            setSession(data.session);
            
            // Redirect based on user status
            if (!profileData.email_verified) {
              navigate("/verify-email");
            } else if (profileData.approval_status !== "approved") {
              navigate("/pending-approval");
            }
          }
        }
        
        setIsLoading(false);
        
        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (error) {
        console.error("Error in auth setup:", error);
        setIsLoading(false);
      }
    };

    setupAuth();
  }, [navigate]);
  
  const signup = async (userData: Partial<AppUser>, password: string) => {
    try {
      setIsLoading(true);
      
      // Extract email from userData
      const { email } = userData;
      
      if (!email) {
        throw new Error("Email is required");
      }
      
      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            company: userData.company,
            website: userData.website,
            phone: userData.phone_number,
            buyer_type: userData.buyer_type,
            ...userData, // Include any other fields
          },
        },
      });
      
      if (error) throw error;
      
      // Success message
      toast({
        title: "Signup successful",
        description: "Please check your email for verification link",
      });
      
      // Redirect to email verification page
      navigate("/verify-email");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Get user profile to check approval status
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      
      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        throw new Error("Error fetching your profile");
      }
      
      // Successfully logged in - redirects will happen in the auth state change listener
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
      navigate("/login");
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    signup,
    login,
    logout,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
