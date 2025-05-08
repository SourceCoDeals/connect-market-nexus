import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, ApprovalStatus } from "@/types";
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
        
        // Set timeout to prevent indefinite loading
        const timeoutId = setTimeout(() => {
          console.warn("Auth check timeout - forcing reset");
          setIsLoading(false);
          setUser(null);
        }, 5000);
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Clear timeout as we got a response
        clearTimeout(timeoutId);
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }
        
        if (session?.user) {
          console.log("Found existing session:", session.user.id);
          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            if (profileError.code === 'PGRST116') {
              console.warn("User profile not found, creating one");
              // Profile not found, handle this case
              await supabase.auth.signOut();
              setUser(null);
            } else {
              console.error("Profile error:", profileError);
              throw profileError;
            }
          } else if (profileData) {
            console.log("Loaded profile data:", profileData.email);
            // Create user object from profile data
            const userData: User = {
              id: profileData.id,
              email: profileData.email,
              first_name: profileData.first_name,
              last_name: profileData.last_name,
              company: profileData.company || '',
              website: profileData.website || '',
              phone_number: profileData.phone_number || '',
              role: profileData.is_admin ? 'admin' as UserRole : 'buyer' as UserRole,
              email_verified: profileData.email_verified,
              approval_status: profileData.approval_status as ApprovalStatus,
              is_admin: profileData.is_admin,
              buyer_type: profileData.buyer_type as any || 'corporate',
              created_at: profileData.created_at,
              updated_at: profileData.updated_at,
              // Computed properties
              get firstName() { return this.first_name; },
              get lastName() { return this.last_name; },
              get phoneNumber() { return this.phone_number; },
              get isAdmin() { return this.is_admin; },
              get buyerType() { return this.buyer_type; },
              get emailVerified() { return this.email_verified; },
              get isApproved() { return this.approval_status === 'approved'; },
              get createdAt() { return this.created_at; },
              get updatedAt() { return this.updated_at; }
            };
            
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          }
        } else {
          console.log("No session found");
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
        console.log("Auth state change:", event);
        
        if (event === "SIGNED_IN" && session) {
          // Use setTimeout to prevent deadlocks in Supabase auth
          setTimeout(async () => {
            try {
              // Fetch user profile when signed in
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (error) {
                console.error("Error fetching user profile:", error);
                if (error.code === 'PGRST116') {
                  // Profile not found
                  console.warn("User profile not found on sign in");
                  await supabase.auth.signOut();
                  setUser(null);
                  return;
                }
                throw error;
              }
              
              if (profile) {
                const userData: User = {
                  id: profile.id,
                  email: profile.email,
                  first_name: profile.first_name,
                  last_name: profile.last_name,
                  company: profile.company || '',
                  website: profile.website || '',
                  phone_number: profile.phone_number || '',
                  role: profile.is_admin ? 'admin' as UserRole : 'buyer' as UserRole,
                  email_verified: profile.email_verified,
                  approval_status: profile.approval_status as ApprovalStatus,
                  is_admin: profile.is_admin,
                  buyer_type: profile.buyer_type as any || 'corporate',
                  created_at: profile.created_at,
                  updated_at: profile.updated_at,
                  // Computed properties
                  get firstName() { return this.first_name; },
                  get lastName() { return this.last_name; },
                  get phoneNumber() { return this.phone_number; },
                  get isAdmin() { return this.is_admin; },
                  get buyerType() { return this.buyer_type; },
                  get emailVerified() { return this.email_verified; },
                  get isApproved() { return this.approval_status === 'approved'; },
                  get createdAt() { return this.created_at; },
                  get updatedAt() { return this.updated_at; }
                };
                
                setUser(userData);
                localStorage.setItem("user", JSON.stringify(userData));
              }
            } catch (error) {
              console.error("Error in auth state change handler:", error);
            }
          }, 0);
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
        console.warn("Global sign out failed:", err);
      }
      
      console.log("Attempting login with email:", email);
      
      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error("Login error:", error);
        throw error;
      }
      
      if (!data || !data.user) {
        console.error("No user data returned from login");
        throw new Error("Failed to login. No user data returned.");
      }
      
      console.log("Login successful, user ID:", data.user.id);
      
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (profileError) {
        console.error("Profile fetch error:", profileError);
        throw profileError;
      }
      
      if (!profile) {
        console.error("No profile found for user");
        throw new Error("User profile not found");
      }
      
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
      
      if (profile.approval_status === 'pending' as ApprovalStatus) {
        toast({
          variant: "destructive",
          title: "Account pending approval",
          description: "Your account is awaiting admin approval.",
        });
        await supabase.auth.signOut();
        navigate("/pending-approval");
        return;
      }
      
      if (profile.approval_status === 'rejected' as ApprovalStatus) {
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
        first_name: profile.first_name,
        last_name: profile.last_name,
        company: profile.company || '',
        website: profile.website || '',
        phone_number: profile.phone_number || '',
        role: profile.is_admin ? 'admin' as UserRole : 'buyer' as UserRole,
        email_verified: profile.email_verified,
        approval_status: profile.approval_status as ApprovalStatus,
        is_admin: profile.is_admin,
        buyer_type: profile.buyer_type as any || 'corporate',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        // Computed properties
        get firstName() { return this.first_name; },
        get lastName() { return this.last_name; },
        get phoneNumber() { return this.phone_number; },
        get isAdmin() { return this.is_admin; },
        get buyerType() { return this.buyer_type; },
        get emailVerified() { return this.email_verified; },
        get isApproved() { return this.approval_status === 'approved'; },
        get createdAt() { return this.created_at; },
        get updatedAt() { return this.updated_at; }
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
    } catch (error: any) {
      console.error("Login process error:", error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Something went wrong",
      });
      throw error;
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
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            company: userData.company || '',
            website: userData.website || '',
            phone_number: userData.phone_number || '',
            buyer_type: userData.buyer_type || 'corporate',
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
          first_name: data.first_name,
          last_name: data.last_name,
          company: data.company,
          website: data.website,
          phone_number: data.phone_number,
          bio: data.bio,
          buyer_type: data.buyer_type,
          fund_size: data.fund_size,
          aum: data.aum,
          estimated_revenue: data.estimated_revenue,
          investment_size: data.investment_size,
          target_company_size: data.target_company_size,
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
