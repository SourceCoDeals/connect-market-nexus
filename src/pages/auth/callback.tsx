
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
        const queryParams = new URLSearchParams(window.location.search);
        const type = queryParams.get('type');
        
        if (type === 'signup' || type === 'recovery' || type === 'invite') {
          navigate(`/verify-email-handler${window.location.search}`);
          return;
        }
        
        // Simple session check
        const { data } = await supabase.auth.getSession();

        if (data.session?.user) {
          // Simple redirect based on admin status
          const { data: profile } = await supabase
            .from('profiles')
            .select('email_verified, approval_status, is_admin')
            .eq('id', data.session.user.id)
            .single();

          if (profile?.email_verified && profile?.approval_status === 'approved') {
            navigate(profile.is_admin ? '/admin' : '/marketplace');
          } else if (profile?.email_verified) {
            navigate('/pending-approval');
          } else {
            navigate('/verify-email', { state: { email: data.session.user.email } });
          }
        } else {
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
