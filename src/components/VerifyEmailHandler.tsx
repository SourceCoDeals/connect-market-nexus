
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function VerifyEmailHandler() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        setIsVerifying(true);
        
        // Parse URL params
        const params = new URLSearchParams(location.search);
        const type = params.get('type');
        const token = params.get('token');
        
        if (!type || !token) {
          throw new Error('Invalid verification link');
        }
        
        if (type === 'signup' || type === 'recovery' || type === 'invite') {
          // Call Supabase to verify email
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type === 'invite' ? 'invite' : type === 'recovery' ? 'recovery' : 'signup',
          });
          
          if (error) throw error;
          
          setVerificationSuccess(true);
          
          // If the user is now verified, check their approval status
          if (data.user) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('approval_status')
              .eq('id', data.user.id)
              .single();
              
            if (profileError) throw profileError;
            
            setApprovalStatus(profileData.approval_status);
          }
        } else {
          throw new Error('Unknown verification type');
        }
      } catch (err: any) {
        console.error('Verification error:', err);
        setError(err.message || 'Failed to verify email');
        setVerificationSuccess(false);
      } finally {
        setIsVerifying(false);
      }
    };
    
    handleEmailVerification();
  }, [location.search]);
  
  const handleContinue = () => {
    if (verificationSuccess) {
      if (approvalStatus === 'approved') {
        // Redirect to login if approved
        navigate('/login', { 
          state: { emailVerified: true } 
        });
      } else {
        // Redirect to pending approval page
        navigate('/pending-approval');
      }
    } else {
      // If verification failed, go back to login
      navigate('/login');
    }
  };
  
  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">Verifying your email...</h1>
        <p className="text-muted-foreground">Please wait while we verify your email address.</p>
      </div>
    );
  }
  
  if (verificationSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Email verified successfully!</h1>
        {approvalStatus === 'approved' ? (
          <p className="text-center mb-6">Your account is approved. You can now log in to the marketplace.</p>
        ) : (
          <p className="text-center mb-6">Your email has been verified, but your account is pending admin approval.</p>
        )}
        <Button onClick={handleContinue}>
          {approvalStatus === 'approved' ? 'Continue to login' : 'Continue'}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <XCircle className="h-12 w-12 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Verification failed</h1>
      <p className="text-center text-muted-foreground mb-6">
        {error || 'We could not verify your email. The link may have expired or is invalid.'}
      </p>
      <Button onClick={() => navigate('/login')}>Back to login</Button>
    </div>
  );
}
