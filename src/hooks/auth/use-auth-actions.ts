
import { User as AppUser } from '@/types';
import { supabase, cleanupAuthState } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useAuthActions(
  setUser: (user: AppUser | null) => void,
  setIsLoading: (loading: boolean) => void
) {
  const signup = async (userData: Partial<AppUser>, password: string) => {
    setIsLoading(true);
    
    try {
      // Clean up any existing auth state first
      await cleanupAuthState();
      
      const { data, error } = await supabase.auth.signUp({
        email: userData.email!,
        password,
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

      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Account created successfully!",
          description: "Please check your email to verify your account before signing in.",
        });
      }

      return data;
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      // Clean up any existing auth state first
      await cleanupAuthState();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // User state will be updated by the auth state listener
      return data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    
    try {
      // Clean up auth state and force page refresh for clean state
      await cleanupAuthState();
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Logout error (continuing anyway):', error);
      }
      
      // Force page refresh to ensure clean state
      window.location.href = '/login';
    } catch (error: any) {
      console.error('Logout error:', error);
      // Even if logout fails, clean up and redirect
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<AppUser>) => {
    setIsLoading(true);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        throw new Error('No authenticated user');
      }

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', session.session.user.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });

      return updatedProfile;
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update profile",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signup,
    login,
    logout,
    updateUserProfile,
  };
}
