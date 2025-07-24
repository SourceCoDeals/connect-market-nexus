
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('📧 Email verification callback - processing...');
        
        // Let Supabase handle the verification token
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          throw error;
        }

        if (data.session?.user) {
          console.log('✅ User session found, checking profile...');
          
          // Get latest profile data to see if verification was successful
          const { data: profile } = await supabase
            .from('profiles')
            .select('email_verified, approval_status, is_admin')
            .eq('id', data.session.user.id)
            .single();

          console.log('📋 Profile data:', { 
            email_verified: profile?.email_verified, 
            approval_status: profile?.approval_status,
            is_admin: profile?.is_admin 
          });

          if (profile?.email_verified && profile?.approval_status === 'approved') {
            // Fully approved user - go to app
            navigate(profile.is_admin ? '/admin' : '/');
          } else {
            // Not fully approved yet - always go to pending approval
            // This handles both: email not verified OR email verified but waiting for admin approval
            navigate('/pending-approval');
          }
        } else {
          console.log('⚠️ No session found, redirecting to login');
          navigate('/login');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">Authentication error: {error}</div>
        <Button onClick={() => navigate('/login')}>
          Back to Login
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">Processing authentication...</h1>
        <p className="text-muted-foreground">Please wait...</p>
      </div>
    );
  }

  return null;
}
