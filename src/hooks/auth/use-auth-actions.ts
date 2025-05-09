import { useNavigate } from "react-router-dom";
import { User } from "@/types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cleanupAuthState, createUserObject } from "@/lib/auth-helpers";

export function useAuthActions(setUser: (user: User | null) => void, setIsLoading: (loading: boolean) => void) {
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Clean up existing auth state before login
      await cleanupAuthState();
      
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
      
      console.log("User profile fetched:", {
        email_verified: profile.email_verified,
        approval_status: profile.approval_status
      });
      
      // Check email verification status from the profile
      if (!profile.email_verified) {
        toast({
          variant: "destructive",
          title: "Email not verified",
          description: "Please verify your email address before logging in.",
        });
        navigate("/verify-email", { state: { email } });
        return;
      }
      
      // Check approval status
      if (profile.approval_status === 'pending' || profile.approval_status === 'rejected') {
        let message = "Your account is awaiting admin approval.";
        if (profile.approval_status === 'rejected') {
          message = "Your account application has been rejected.";
        }
        
        toast({
          variant: profile.approval_status === 'rejected' ? "destructive" : "default",
          title: profile.approval_status === 'rejected' ? "Account rejected" : "Account pending approval",
          description: message,
        });
        
        // For both pending and rejected, keep them logged in but send to verification success
        const userData = createUserObject(profile);
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        navigate("/verification-success");
        return;
      }
      
      // User is verified and approved
      const userData = createUserObject(profile);
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });
      
      // Use window.location for a full page refresh to prevent stale state
      setTimeout(() => {
        if (profile.is_admin) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/marketplace";
        }
      }, 100);
      
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
      console.log("Starting logout process");
      
      // Clean up auth state first
      await cleanupAuthState();
      
      // Update local state
      setUser(null);
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      
      // Force page reload to clear all state
      window.location.href = '/login';
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to log out",
      });
      
      // Even if there's an error, still try to force logout
      setUser(null);
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: Partial<User>, password: string) => {
    setIsLoading(true);
    try {
      // Clean up existing auth state
      cleanupAuthState();
      
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
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (!currentUser || !currentUser.id) {
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
        .eq('id', currentUser.id);
      
      if (error) throw error;
      
      // Update local state
      const updatedUser = { ...currentUser, ...data };
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

  return {
    login,
    logout,
    signup,
    updateUserProfile
  };
}
