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
      
      // Sign in with enhanced error handling
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error("Login error:", error);
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
      
      if (!data || !data.user) {
        console.error("No user data returned from login");
        throw new Error("Failed to login. No user data returned.");
      }
      
      console.log("Login successful, user ID:", data.user.id);
      
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
            console.error(`Profile fetch attempt ${retryCount} failed:`, profileError);
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
              throw profileError;
            }
          } else {
            profile = profileData;
          }
        } catch (err) {
          retryCount++;
          console.error(`Profile fetch attempt ${retryCount} failed:`, err);
          if (retryCount >= maxRetries) {
            throw new Error("Failed to load user profile. Please try again.");
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      if (!profile) {
        console.error("No profile found for user");
        throw new Error("User profile not found");
      }
      
      console.log("User profile fetched:", {
        email_verified: profile.email_verified,
        approval_status: profile.approval_status,
        is_admin: profile.is_admin
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
      
      // Check approval status for regular users (not admins)
      if (profile.is_admin !== true && (profile.approval_status === 'pending' || profile.approval_status === 'rejected')) {
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
      
      // User is verified and approved or is admin
      const userData = createUserObject(profile);
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });
      
      // Use window.location for a full page refresh to prevent stale state
      setTimeout(() => {
        if (profile.is_admin === true) {
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
      
      // Enhanced cleanup with better error handling
      await cleanupAuthState();
      
      // Update local state
      setUser(null);
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      
      // Force page reload to clear all state with better error handling
      setTimeout(() => {
        try {
          window.location.href = '/login';
        } catch (err) {
          console.error("Navigation error:", err);
          navigate('/login');
        }
      }, 100);
      
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to log out",
      });
      
      // Even if there's an error, still try to force logout
      setUser(null);
      setTimeout(() => {
        try {
          window.location.href = '/login';
        } catch (err) {
          console.error("Fallback navigation error:", err);
          navigate('/login');
        }
      }, 100);
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
      
      // Enhanced validation
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }
      
      // Create auth user - explicitly set is_admin to false for new users
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
            is_admin: false, // Always explicitly set new users to non-admin
          },
        },
      });
      
      if (error) throw error;
      
      // After signup, update the profile to ensure correct defaults
      if (data?.user?.id) {
        // Explicitly set the profile fields to ensure correct values regardless of DB defaults
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_admin: false,
            approval_status: 'pending',
            email_verified: false
          })
          .eq('id', data.user.id);
          
        if (profileError) {
          console.error("Error updating profile defaults:", profileError);
          // Continue despite this error, as the database defaults should now be correct
        }
        
        // Send admin notification email with enhanced retry logic
        try {
          console.log("Sending admin notification for new signup");
          const notificationPayload = {
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            email: userData.email,
            company: userData.company || ''
          };
          
          // Enhanced retry logic for admin notifications
          let notificationSent = false;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!notificationSent && retryCount < maxRetries) {
            try {
              const { error: notificationError } = await supabase.functions.invoke(
                "admin-notification", 
                { 
                  body: JSON.stringify(notificationPayload) 
                }
              );
              
              if (!notificationError) {
                notificationSent = true;
                console.log("Admin notification sent successfully");
              } else {
                retryCount++;
                console.error(`Admin notification attempt ${retryCount} failed:`, notificationError);
                if (retryCount < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              }
            } catch (notificationErr) {
              retryCount++;
              console.error(`Admin notification attempt ${retryCount} failed:`, notificationErr);
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          }
          
          if (!notificationSent) {
            console.error("All admin notification attempts failed");
          }
        } catch (notificationErr) {
          // Log but don't throw to prevent blocking signup
          console.error("Failed to send admin notification:", notificationErr);
        }
      }
      
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
