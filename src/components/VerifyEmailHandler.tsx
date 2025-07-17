import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { ApprovalStatus } from '@/types';
import { useEmailNotifications } from '@/hooks/auth/use-email-notifications';

export default function VerifyEmailHandler() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tokenInvalidOrExpired, setTokenInvalidOrExpired] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { sendEmailVerificationConfirmation } = useEmailNotifications();
  
  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        setIsVerifying(true);
        
        // Parse URL params
        const params = new URLSearchParams(location.search);
        const type = params.get('type');
        const token = params.get('token_hash') || params.get('token');
        
        if (!type || !token) {
          throw new Error('Invalid verification link');
        }
        
        console.log("Verification params:", { type, token });
        
        if (type === 'signup' || type === 'recovery' || type === 'invite') {
          // Try Supabase's default verification first
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type === 'invite' ? 'invite' : type === 'recovery' ? 'recovery' : 'signup',
          });
          
          console.log("Verification response:", { data, error });
          
          if (error) {
            console.error('Verification error:', error);
            
            // If it's a custom token (user ID), try manual verification
            if (token.length === 36 && token.includes('-')) { // UUID format
              console.log('Attempting manual verification for custom token');
              
              try {
                // Update the user's email_verified status directly
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ email_verified: true })
                  .eq('id', token);
                
                if (updateError) {
                  console.error('Error updating email_verified status:', updateError);
                  throw updateError;
                }
                
                // Get user data
                const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', token)
                  .single();
                
                if (profileError) {
                  console.error('Error fetching profile:', profileError);
                  throw profileError;
                }
                
                console.log('Manual verification successful');
                setVerificationSuccess(true);
                setEmail(profileData.email);
                setApprovalStatus(profileData.approval_status as ApprovalStatus);
                setIsAdmin(profileData.is_admin === true);
                
                // Send email verification confirmation
                try {
                  await sendEmailVerificationConfirmation({
                    id: profileData.id,
                    email: profileData.email,
                    first_name: profileData.first_name,
                    last_name: profileData.last_name,
                    approval_status: profileData.approval_status,
                    is_admin: profileData.is_admin,
                    email_verified: true,
                    created_at: profileData.created_at,
                    updated_at: profileData.updated_at
                  });
                  console.log('Email verification confirmation sent');
                } catch (emailError) {
                  console.error('Failed to send email verification confirmation:', emailError);
                  // Continue even if email fails
                }
                
                // Show success message for 2 seconds then redirect
                setTimeout(() => {
                  if (profileData.is_admin === true) {
                    navigate('/admin');
                  } else if (profileData.approval_status === 'approved') {
                    navigate('/marketplace');
                  } else {
                    navigate('/pending-approval');
                  }
                }, 2000);
                
                return;
              } catch (manualError) {
                console.error('Manual verification failed:', manualError);
                setTokenInvalidOrExpired(true);
                throw manualError;
              }
            } else {
              setTokenInvalidOrExpired(true);
              
              // Try to extract email from session if available
              try {
                const { data } = await supabase.auth.getSession();
                if (data?.session?.user?.email) {
                  setEmail(data.session.user.email);
                }
              } catch (e) {
                console.error('Error getting email from session:', e);
              }
              throw error;
            }
          }
          
          setVerificationSuccess(true);
          
          // If the user is now verified, check their approval status
          if (data.user) {
            setEmail(data.user.email);
            
            // Get the profile data
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('approval_status, email_verified, is_admin, first_name, last_name, created_at, updated_at')
              .eq('id', data.user.id)
              .single();
              
            if (profileError) throw profileError;
            
            console.log("Profile data after verification:", profileData);
            
            // Set approval status and admin status from profile
            setApprovalStatus(profileData.approval_status as ApprovalStatus);
            setIsAdmin(profileData.is_admin === true);
            
            // Explicitly update profile email_verified field if needed
            if (!profileData.email_verified) {
              console.log("Email verified flag needs to be updated");
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ email_verified: true })
                .eq('id', data.user.id);
                
              if (updateError) {
                console.error('Error updating email_verified status:', updateError);
                // Continue even if this update fails, as the auth token is verified
              } else {
                console.log('Email verified flag updated successfully');
              }
            } else {
              console.log("Email was already marked as verified");
            }
            
            // Send email verification confirmation
            try {
              await sendEmailVerificationConfirmation({
                id: data.user.id,
                email: data.user.email!,
                first_name: profileData.first_name,
                last_name: profileData.last_name,
                approval_status: profileData.approval_status,
                is_admin: profileData.is_admin,
                email_verified: true,
                created_at: profileData.created_at,
                updated_at: profileData.updated_at
              });
              console.log('Email verification confirmation sent');
            } catch (emailError) {
              console.error('Failed to send email verification confirmation:', emailError);
              // Continue even if email fails
            }
            
            // Show success message for 2 seconds then redirect
            setTimeout(() => {
              if (profileData.is_admin === true) {
                navigate('/admin');
              } else if (profileData.approval_status === 'approved') {
                navigate('/marketplace');
              } else {
                navigate('/pending-approval');
              }
            }, 2000);
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
  }, [location.search, navigate, sendEmailVerificationConfirmation]);
  
  const handleContinue = () => {
    if (verificationSuccess) {
      if (isAdmin) {
        navigate('/admin');
      } else if (approvalStatus === 'approved') {
        navigate('/marketplace');
      } else {
        navigate('/pending-approval');
      }
    } else {
      // If verification failed, go back to login
      navigate('/login');
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email address is unknown. Please try signing up again.",
      });
      navigate('/signup');
      return;
    }

    try {
      setIsVerifying(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) throw error;

      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
      });
      
      // Navigate to verify email page to wait for verification
      navigate('/verify-email', { state: { email } });
    } catch (err: any) {
      console.error('Error resending verification email:', err);
      toast({
        variant: "destructive",
        title: "Failed to resend verification email",
        description: err.message || "Please try again later.",
      });
    } finally {
      setIsVerifying(false);
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
        <p className="text-center mb-6">
          {isAdmin 
            ? "Welcome admin! You will be redirected to the admin dashboard."
            : approvalStatus === 'approved' 
              ? "Your account has been approved. You will be redirected to the marketplace."
              : "Your email has been verified. Your account is now pending admin approval. You will be redirected shortly."}
        </p>
        <Button onClick={handleContinue}>Continue</Button>
      </div>
    );
  }
  
  if (tokenInvalidOrExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Verification link expired</h1>
        <p className="text-center text-muted-foreground mb-6">
          The verification link has expired or is invalid. Please request a new verification email.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            variant="default" 
            onClick={handleResendVerification} 
            disabled={isVerifying}
            className="flex items-center gap-2"
          >
            {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
            <RefreshCw className="h-4 w-4 mr-1" /> 
            Resend verification email
          </Button>
          <Button variant="outline" onClick={() => navigate('/login')}>
            Back to login
          </Button>
        </div>
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
      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="outline" onClick={() => navigate('/login')}>
          Back to login
        </Button>
      </div>
    </div>
  );
}
