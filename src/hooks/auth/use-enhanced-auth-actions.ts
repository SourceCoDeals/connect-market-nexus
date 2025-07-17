
import { useNavigate } from "react-router-dom";
import { User } from "@/types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cleanupAuthState, createUserObject } from "@/lib/auth-helpers";
import { errorLogger } from "@/lib/error-logger";

export function useEnhancedAuthActions(setUser: (user: User | null) => void, setIsLoading: (loading: boolean) => void) {
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    const correlationId = crypto.randomUUID();
    const startTime = performance.now();
    
    setIsLoading(true);
    
    try {
      console.log(`[${correlationId}] Starting login process for: ${email}`);
      
      // Clean up existing auth state before login
      await cleanupAuthState();
      
      // Sign in with enhanced error handling
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        await errorLogger.error(error, {
          email,
          correlation_id: correlationId,
          action: 'login_attempt'
        });
        
        // Enhanced error messages for better UX
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please verify your email address before logging in.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes and try again.');
        }
        throw error;
      }
      
      if (!data?.user) {
        const errorMsg = "Failed to login. No user data returned.";
        await errorLogger.error(new Error(errorMsg), {
          email,
          correlation_id: correlationId,
          action: 'login_no_user_data'
        });
        throw new Error(errorMsg);
      }
      
      console.log(`[${correlationId}] Login successful for user: ${data.user.id}`);
      
      // Fetch user profile with retry logic
      let profile = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!profile && retryCount < maxRetries) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          
          if (profileError) {
            retryCount++;
            console.error(`[${correlationId}] Profile fetch attempt ${retryCount} failed:`, profileError);
            
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
              await errorLogger.error(profileError, {
                user_id: data.user.id,
                correlation_id: correlationId,
                retry_count: retryCount
              });
              throw profileError;
            }
          } else {
            profile = profileData;
          }
        } catch (err) {
          retryCount++;
          console.error(`[${correlationId}] Profile fetch attempt ${retryCount} failed:`, err);
          
          if (retryCount >= maxRetries) {
            await errorLogger.error(err as Error, {
              user_id: data.user.id,
              correlation_id: correlationId,
              retry_count: retryCount
            });
            throw new Error("Failed to load user profile. Please try again.");
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      if (!profile) {
        const errorMsg = "User profile not found";
        await errorLogger.error(new Error(errorMsg), {
          user_id: data.user.id,
          correlation_id: correlationId,
          action: 'profile_not_found'
        });
        throw new Error(errorMsg);
      }
      
      // Check email verification status
      if (!profile.email_verified) {
        console.log(`[${correlationId}] Email not verified for user: ${profile.email}`);
        toast({
          variant: "destructive",
          title: "Email not verified",
          description: "Please verify your email address before logging in.",
        });
        navigate("/verify-email", { state: { email } });
        return;
      }
      
      // Check approval status for regular users
      if (profile.is_admin !== true && (profile.approval_status === 'pending' || profile.approval_status === 'rejected')) {
        console.log(`[${correlationId}] User approval status: ${profile.approval_status}`);
        
        let message = "Your account is awaiting admin approval.";
        if (profile.approval_status === 'rejected') {
          message = "Your account application has been rejected.";
        }
        
        toast({
          variant: profile.approval_status === 'rejected' ? "destructive" : "default",
          title: profile.approval_status === 'rejected' ? "Account rejected" : "Account pending approval",
          description: message,
        });
        
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
      
      const loginDuration = performance.now() - startTime;
      console.log(`[${correlationId}] Login process completed in ${loginDuration}ms`);
      
      // Log performance if slow
      if (loginDuration > 3000) {
        await errorLogger.info(`Slow login performance: ${loginDuration}ms`, {
          user_id: data.user.id,
          correlation_id: correlationId,
          duration: loginDuration
        });
      }
      
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });
      
      // Navigate based on user role
      setTimeout(() => {
        if (profile.is_admin === true) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/marketplace";
        }
      }, 100);
      
    } catch (error: any) {
      console.error(`[${correlationId}] Login process error:`, error);
      
      await errorLogger.error(error, {
        email,
        correlation_id: correlationId,
        action: 'login_failure'
      });
      
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
    const correlationId = crypto.randomUUID();
    console.log(`[${correlationId}] Starting logout process`);
    
    setIsLoading(true);
    
    try {
      // Enhanced cleanup with better error handling
      await cleanupAuthState();
      
      // Update local state
      setUser(null);
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      
      console.log(`[${correlationId}] Logout completed successfully`);
      
      // Force page reload to clear all state
      setTimeout(() => {
        try {
          window.location.href = '/login';
        } catch (err) {
          console.error(`[${correlationId}] Navigation error:`, err);
          navigate('/login');
        }
      }, 100);
      
    } catch (error: any) {
      console.error(`[${correlationId}] Logout error:`, error);
      
      await errorLogger.error(error, {
        correlation_id: correlationId,
        action: 'logout_failure'
      });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to log out",
      });
      
      // Force logout anyway
      setUser(null);
      setTimeout(() => {
        try {
          window.location.href = '/login';
        } catch (err) {
          console.error(`[${correlationId}] Fallback navigation error:`, err);
          navigate('/login');
        }
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: Partial<User>, password: string) => {
    const correlationId = crypto.randomUUID();
    const startTime = performance.now();
    
    setIsLoading(true);
    
    try {
      console.log(`[${correlationId}] Starting signup process for: ${userData.email}`);
      
      // Clean up existing auth state
      cleanupAuthState();
      
      // Enhanced validation
      if (!userData.email || !password) {
        const errorMsg = "Email and password are required";
        await errorLogger.error(new Error(errorMsg), {
          correlation_id: correlationId,
          provided_email: !!userData.email,
          provided_password: !!password
        });
        throw new Error(errorMsg);
      }
      
      if (password.length < 8) {
        const errorMsg = "Password must be at least 8 characters long";
        await errorLogger.error(new Error(errorMsg), {
          correlation_id: correlationId,
          password_length: password.length
        });
        throw new Error(errorMsg);
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
            is_admin: false,
          },
        },
      });
      
      if (error) {
        await errorLogger.error(error, {
          email: userData.email,
          correlation_id: correlationId,
          action: 'signup_attempt'
        });
        throw error;
      }
      
      const signupDuration = performance.now() - startTime;
      console.log(`[${correlationId}] Signup completed in ${signupDuration}ms`);
      
      // Log performance if slow
      if (signupDuration > 5000) {
        await errorLogger.info(`Slow signup performance: ${signupDuration}ms`, {
          user_id: data?.user?.id,
          correlation_id: correlationId,
          duration: signupDuration
        });
      }
      
      toast({
        title: "Verification email sent",
        description: "Please check your email to verify your account.",
      });
      
      // Sign out after signup to force verification
      await supabase.auth.signOut();
      navigate("/verify-email", { state: { email: userData.email } });
      
    } catch (error: any) {
      console.error(`[${correlationId}] Signup error:`, error);
      
      await errorLogger.error(error, {
        email: userData.email,
        correlation_id: correlationId,
        action: 'signup_failure'
      });
      
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
    const correlationId = crypto.randomUUID();
    
    setIsLoading(true);
    
    try {
      console.log(`[${correlationId}] Starting profile update`);
      
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (!currentUser || !currentUser.id) {
        const errorMsg = "Not authenticated";
        await errorLogger.error(new Error(errorMsg), {
          correlation_id: correlationId,
          action: 'profile_update_unauthenticated'
        });
        throw new Error(errorMsg);
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
      
      if (error) {
        await errorLogger.error(error, {
          user_id: currentUser.id,
          correlation_id: correlationId
        });
        throw error;
      }
      
      // Update local state
      const updatedUser = { ...currentUser, ...data };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      console.log(`[${correlationId}] Profile updated successfully`);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      
    } catch (error: any) {
      console.error(`[${correlationId}] Profile update error:`, error);
      
      await errorLogger.error(error, {
        correlation_id: correlationId,
        action: 'profile_update_failure'
      });
      
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
