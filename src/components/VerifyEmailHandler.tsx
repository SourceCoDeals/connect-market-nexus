
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { ApprovalStatus } from '@/types';
import { useEmailNotifications } from '@/hooks/auth/use-email-notifications';
import { createUserObject } from '@/lib/auth-helpers';

export default function VerifyEmailHandler() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tokenInvalidOrExpired, setTokenInvalidOrExpired] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { sendEmailVerificationConfirmation } = useEmailNotifications();
  
  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        setIsVerifying(true);
        
        // Check for Brevo error parameters first (common when click tracking corrupts URLs)
        const queryParams = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams(location.hash.substring(1));
        
        const hasError = queryParams.get('error') === 'access_denied' || hashParams.get('error') === 'access_denied';
        const errorCode = queryParams.get('error_code') || hashParams.get('error_code');
        
        console.log('🔍 URL Analysis:', { 
          hasError, 
          errorCode,
          hash: location.hash,
          search: location.search 
        });
        
        // CRITICAL FIX: If we see Brevo error parameters, check actual user verification status first
        if (hasError && errorCode === 'otp_expired') {
          console.log('⚠️  Brevo error detected - checking actual user verification status');
          
          try {
            // Check if user is already verified by getting current session
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (sessionData?.session?.user) {
              console.log('✅ User has valid session, checking verification status');
              
              // Get profile to check verification status
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', sessionData.session.user.id)
                .single();
                
              if (!profileError && profileData?.email_verified) {
                console.log('🎉 User is actually verified! Redirecting based on status...');
                
                // User is verified, redirect appropriately
                setVerificationSuccess(true);
                setEmail(profileData.email);
                setApprovalStatus(profileData.approval_status as ApprovalStatus);
                setIsAdmin(profileData.is_admin === true);
                
                // Direct redirect without showing success screen
                if (profileData.is_admin === true) {
                  console.log('🔄 Redirecting verified admin to /admin');
                  navigate('/admin', { replace: true });
                } else if (profileData.approval_status === 'approved') {
                  console.log('🔄 Redirecting verified approved user to /marketplace');
                  navigate('/marketplace', { replace: true });
                } else {
                  console.log('🔄 Redirecting verified pending user to /pending-approval');
                  navigate('/pending-approval', { replace: true });
                }
                return;
              }
            }
            
            console.log('❌ User not verified or no session, showing error');
          } catch (checkError) {
            console.error('Error checking verification status:', checkError);
          }
          
          // If we get here, user is genuinely not verified
          setTokenInvalidOrExpired(true);
          setError('The verification link has expired or is invalid.');
          setIsVerifying(false);
          return;
        }
        
        // Continue with normal verification flow
        const accessToken = hashParams.get('access_token');
        const tokenType = hashParams.get('token_type');
        const type = hashParams.get('type') || queryParams.get('type');
        const refreshToken = hashParams.get('refresh_token');
        
        // Fallback to query params for custom tokens
        const customToken = queryParams.get('token_hash') || queryParams.get('token');
        
        console.log('🔍 Verification attempt:', { 
          hasAccessToken: !!accessToken, 
          type, 
          tokenType,
          hasRefreshToken: !!refreshToken,
          customTokenLength: customToken?.length 
        });
        
        // Handle Supabase native flow (hash fragments)
        if (accessToken && tokenType === 'bearer' && type === 'signup') {
          console.log('🔄 Processing Supabase native verification');
          
          // Set the session from the tokens
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            throw sessionError;
          }
          
          if (!sessionData.user) {
            throw new Error('No user data in session');
          }
          
          console.log('✅ Supabase native verification successful');
          setVerificationSuccess(true);
          setEmail(sessionData.user.email);
          
          // Get the profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionData.user.id)
            .single();
            
          if (profileError) throw profileError;
          
          console.log('👤 Profile data retrieved:', { 
            approvalStatus: profileData.approval_status, 
            isAdmin: profileData.is_admin,
            emailVerified: profileData.email_verified 
          });
          
          // Set approval status and admin status from profile
          setApprovalStatus(profileData.approval_status as ApprovalStatus);
          setIsAdmin(profileData.is_admin === true);
          
          // Update profile email_verified field if needed
          if (!profileData.email_verified) {
            console.log('📧 Updating email_verified status in profile');
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ email_verified: true })
              .eq('id', sessionData.user.id);
              
            if (updateError) {
              console.error('Error updating email_verified status:', updateError);
            } else {
              console.log('✅ Profile email_verified status updated');
            }
          }
          
          // Send email verification confirmation
          try {
            const userObject = createUserObject(profileData);
            await sendEmailVerificationConfirmation(userObject);
            console.log('📧 Email verification confirmation sent');
          } catch (emailError) {
            console.error('Failed to send email verification confirmation:', emailError);
          }
          
          // Immediately redirect to appropriate destination
          if (profileData.is_admin === true) {
            console.log('🔄 Redirecting admin to /admin');
            navigate('/admin', { replace: true });
          } else if (profileData.approval_status === 'approved') {
            console.log('🔄 Redirecting approved user to /marketplace');
            navigate('/marketplace', { replace: true });
          } else {
            console.log('🔄 Redirecting pending user to /pending-approval');
            navigate('/pending-approval', { replace: true });
          }
          return;
        }
        
        // Handle custom tokens (fallback for legacy flow)
        if (!type || !customToken) {
          throw new Error('Invalid verification link');
        }
        
        if (type === 'signup' || type === 'recovery' || type === 'invite') {
          // If it's a custom token (user ID), try manual verification first
          if (customToken.length === 36 && customToken.includes('-')) { // UUID format
            console.log('🔄 Attempting manual verification with UUID token');
            
            try {
              // Update the user's email_verified status directly
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ email_verified: true })
                .eq('id', customToken);
              
              if (updateError) {
                console.error('Error updating email_verified status:', updateError);
                throw updateError;
              }
              
              // Get user data
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', customToken)
                .single();
              
              if (profileError) {
                console.error('Error fetching profile:', profileError);
                throw profileError;
              }
              
              console.log('✅ Manual verification successful');
              setVerificationSuccess(true);
              setEmail(profileData.email);
              setApprovalStatus(profileData.approval_status as ApprovalStatus);
              setIsAdmin(profileData.is_admin === true);
              
              // Send email verification confirmation using createUserObject
              try {
                const userObject = createUserObject(profileData);
                await sendEmailVerificationConfirmation(userObject);
              } catch (emailError) {
                console.error('Failed to send email verification confirmation:', emailError);
                // Continue even if email fails
              }
              
              // Immediately redirect without showing intermediate success screen
              if (profileData.is_admin === true) {
                navigate('/admin', { replace: true });
              } else if (profileData.approval_status === 'approved') {
                navigate('/marketplace', { replace: true });
              } else {
                navigate('/pending-approval', { replace: true });
              }
              
              return;
            } catch (manualError) {
              console.error('Manual verification failed:', manualError);
              setTokenInvalidOrExpired(true);
              throw manualError;
            }
          }
          
          // Try Supabase's default verification
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: customToken,
            type: type === 'invite' ? 'invite' : type === 'recovery' ? 'recovery' : 'signup',
          });
          
          console.log('🔑 Supabase verification result:', { data: !!data, error: error?.message });
          
          if (error) {
            console.error('Verification error:', error);
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
          
          setVerificationSuccess(true);
          
          // If the user is now verified, check their approval status
          if (data.user) {
            setEmail(data.user.email);
            
            // Get the profile data
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();
              
            if (profileError) throw profileError;
            
            console.log('👤 Profile data retrieved:', { 
              approvalStatus: profileData.approval_status, 
              isAdmin: profileData.is_admin,
              emailVerified: profileData.email_verified 
            });
            
            // Set approval status and admin status from profile
            setApprovalStatus(profileData.approval_status as ApprovalStatus);
            setIsAdmin(profileData.is_admin === true);
            
            // Explicitly update profile email_verified field if needed
            if (!profileData.email_verified) {
              console.log('📧 Updating email_verified status in profile');
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ email_verified: true })
                .eq('id', data.user.id);
                
              if (updateError) {
                console.error('Error updating email_verified status:', updateError);
                // Continue even if this update fails, as the auth token is verified
              } else {
                console.log('✅ Profile email_verified status updated');
              }
            } else {
              console.log('✅ Profile already marked as email verified');
            }
            
            // Send email verification confirmation using createUserObject
            try {
              const userObject = createUserObject(profileData);
              await sendEmailVerificationConfirmation(userObject);
              console.log('📧 Email verification confirmation sent');
            } catch (emailError) {
              console.error('Failed to send email verification confirmation:', emailError);
              // Continue even if email fails
            }
            
            // Immediately redirect to appropriate destination
            if (profileData.is_admin === true) {
              console.log('🔄 Redirecting admin to /admin');
              navigate('/admin', { replace: true });
            } else if (profileData.approval_status === 'approved') {
              console.log('🔄 Redirecting approved user to /marketplace');
              navigate('/marketplace', { replace: true });
            } else {
              console.log('🔄 Redirecting pending user to /pending-approval');
              navigate('/pending-approval', { replace: true });
            }
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
  }, [location.search, location.hash, navigate, sendEmailVerificationConfirmation]);
  
  const handleContinue = () => {
    if (verificationSuccess) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else if (approvalStatus === 'approved') {
        navigate('/marketplace', { replace: true });
      } else {
        navigate('/pending-approval', { replace: true });
      }
    } else {
      // If verification failed, go back to login
      navigate('/login', { replace: true });
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email address is unknown. Please try signing up again.",
      });
      navigate('/signup', { replace: true });
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
      navigate('/verify-email', { state: { email }, replace: true });
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
              : "Your email has been verified. You will be redirected to the approval status page."}
        </p>
        {!shouldRedirect && (
          <Button onClick={handleContinue}>Continue</Button>
        )}
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
          <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
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
        <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
          Back to login
        </Button>
      </div>
    </div>
  );
}
