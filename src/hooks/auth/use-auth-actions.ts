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
      
      const userData = createUserObject(profile);
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
      setIsLoading(false);
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
