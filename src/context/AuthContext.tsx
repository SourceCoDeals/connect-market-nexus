
import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

// Helper function to clean up auth state
const cleanupAuthState = () => {
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
  // Remove user data
  localStorage.removeItem("user");
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check auth status on initial load
  useEffect(() => {
    const checkUser = async () => {
      try {
        setIsLoading(true);
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }
        
        if (session?.user) {
          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            throw profileError;
          }
          
          // Create user object from profile data
          if (profileData) {
            const userData: User = {
              id: profileData.id,
              email: profileData.email,
              firstName: profileData.first_name,
              lastName: profileData.last_name,
              company: profileData.company || '',
              website: profileData.website || '',
              phone: profileData.phone_number || '',
              role: profileData.is_admin ? 'admin' : 'buyer',
              isEmailVerified: profileData.email_verified,
              isApproved: profileData.approval_status === 'approved',
              buyerType: profileData.buyer_type as any || 'corporate',
              createdAt: profileData.created_at,
            };
            
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          }
        } else {
          setUser(null);
          localStorage.removeItem("user");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
    
    // Set up auth state change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Fetch user profile when signed in
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error("Error fetching user profile:", error);
            return;
          }
          
          if (profile) {
            const userData: User = {
              id: profile.id,
              email: profile.email,
              firstName: profile.first_name,
              lastName: profile.last_name,
              company: profile.company || '',
              website: profile.website || '',
              phone: profile.phone_number || '',
              role: profile.is_admin ? 'admin' : 'buyer',
              isEmailVerified: profile.email_verified,
              isApproved: profile.approval_status === 'approved',
              buyerType: profile.buyer_type as any || 'corporate',
              createdAt: profile.created_at,
            };
            
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          localStorage.removeItem("user");
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Clean up existing auth state
      cleanupAuthState();
      
      // Try to sign out globally first to prevent auth conflicts
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }
      
      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileError) throw profileError;
        
        if (!profile.email_verified) {
          toast({
            variant: "destructive",
            title: "Email not verified",
            description: "Please verify your email address before logging in.",
          });
          await supabase.auth.signOut();
          navigate("/verify-email", { state: { email } });
          return;
        }
        
        if (profile.approval_status === 'pending') {
          toast({
            variant: "destructive",
            title: "Account pending approval",
            description: "Your account is awaiting admin approval.",
          });
          await supabase.auth.signOut();
          navigate("/pending-approval");
          return;
        }
        
        if (profile.approval_status === 'rejected') {
          toast({
            variant: "destructive",
            title: "Account rejected",
            description: "Your account application has been rejected.",
          });
          await supabase.auth.signOut();
          return;
        }
        
        const userData: User = {
          id: profile.id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          company: profile.company || '',
          website: profile.website || '',
          phone: profile.phone_number || '',
          role: profile.is_admin ? 'admin' : 'buyer',
          isEmailVerified: profile.email_verified,
          isApproved: profile.approval_status === 'approved',
          buyerType: profile.buyer_type as any || 'corporate',
          createdAt: profile.created_at,
        };
        
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        
        toast({
          title: "Welcome back",
          description: "You have successfully logged in.",
        });
        
        // Redirect based on user role
        if (profile.is_admin) {
          navigate("/admin/dashboard");
        } else {
          navigate("/marketplace");
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Clean up auth state first
      cleanupAuthState();
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Update local state
      setUser(null);
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      
      // Force page reload to clear all state
      window.location.href = '/';
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to log out",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: Partial<User>, password: string) => {
    setIsLoading(true);
    try {
      // Clean up existing auth state
      cleanupAuthState();
      
      // Try to sign out globally first
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }
      
      // Check required fields
      if (!userData.email || !password) {
        throw new Error("Email and password are required");
      }
      
      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: password,
        options: {
          data: {
            first_name: userData.firstName || '',
            last_name: userData.lastName || '',
            company: userData.company || '',
            website: userData.website || '',
            phone: userData.phone || '',
            buyer_type: userData.buyerType || 'corporate',
          },
        },
      });
      
      if (error) throw error;
      
      // User created successfully
      toast({
        title: "Verification email sent",
        description: "Please check your email to verify your account.",
      });
      
      // Sign out after signup to force verification
      await supabase.auth.signOut();
      navigate("/verify-email", { state: { email: userData.email } });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message || "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    setIsLoading(true);
    try {
      if (!user || !user.id) {
        throw new Error("Not authenticated");
      }
      
      // Update profile in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          company: data.company,
          website: data.website,
          phone_number: data.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Update local state
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update profile",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        signup,
        updateUserProfile,
        isAdmin: user?.role === "admin",
        isBuyer: user?.role === "buyer",
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
