
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
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        // If we have a session, check if the user's email is verified
        if (data.session?.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('email_verified, approval_status')
            .eq('id', data.session.user.id)
            .single();

          if (profileError) throw profileError;

          // Redirect based on email verification and approval status
          if (profileData.email_verified) {
            if (profileData.approval_status === 'approved') {
              // User is verified and approved, redirect to marketplace
              navigate('/marketplace');
            } else {
              // User is verified but not approved, redirect to pending approval
              navigate('/pending-approval');
            }
          } else {
            // User's email is not verified, redirect to verify email page
            navigate('/verify-email', { 
              state: { email: data.session.user.email } 
            });
          }
        } else {
          // No session, redirect to login
          navigate('/login');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <h1 className="text-2xl font-bold mb-2">Processing your authentication...</h1>
      <p className="text-muted-foreground">Please wait while we verify your credentials.</p>
    </div>
  );
}
