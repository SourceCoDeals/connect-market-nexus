
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, AlertCircle, Clock, CheckCircle, Users, LogOut, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cleanupAuthState } from "@/lib/auth-helpers";

const PendingApproval = () => {
  const { user, refreshUserProfile, setProcessingVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [canResendEmail, setCanResendEmail] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'success' | 'error' | 'idle'>('idle');

  // Handle URL parameters from email verification
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const error = urlParams.get('error');
    const errorCode = urlParams.get('error_code');
    const errorDescription = urlParams.get('error_description');
    
    // PRIORITY 1: If user is already verified, always show success regardless of URL params
    if (user?.email_verified && verificationStatus === 'idle') {
      setVerificationStatus('success');
      if (error && errorCode === 'otp_expired') {
        // User clicked expired link but is already verified
        toast({
          title: "Email already verified!",
          description: "Your account is now under review.",
        });
      } else {
        toast({
          title: "Email verified successfully!",
          description: "Your account is now under review.",
        });
      }
    } 
    // PRIORITY 2: Only show errors if user is NOT verified AND there are error params
    else if (error && user?.email_verified === false) {
      setVerificationStatus('error');
      console.log('🚨 Email verification error:', { error, errorCode, errorDescription });
      
      if (errorCode === 'otp_expired') {
        toast({
          variant: "destructive",
          title: "Verification link expired",
          description: "Please request a new verification email.",
        });
      } else {
        toast({
          variant: "destructive", 
          title: "Verification failed",
          description: errorDescription || "Please try requesting a new verification email.",
        });
      }
    }
  }, [location.search, user?.email_verified, verificationStatus]);

  useEffect(() => {
    // Allow resending email if user email is not verified OR if there was an error
    setCanResendEmail(user?.email_verified === false || verificationStatus === 'error');
  }, [user, verificationStatus]);

  // If user is approved, redirect to marketplace
  useEffect(() => {
    if (user?.approval_status === 'approved') {
      navigate('/marketplace', { replace: true });
    }
  }, [user, navigate]);

  const handleResendVerification = async () => {
    if (!user?.email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email address not found.",
      });
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });

      if (error) throw error;

      toast({
        title: "Verification email sent!",
        description: "Please check your inbox for the verification email.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to resend verification email",
        description: error.message || "Please try again later.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      console.log("Logging out from pending approval page");
      
      // Clean up auth state first
      await cleanupAuthState();
      
      // Sign out from Supabase
      await supabase.auth.signOut({ scope: 'global' });
      
      // Navigate directly to login without page reload to prevent flashing
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Error during logout:", error);
      // Force navigation even if logout fails
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Show proper state based on user's email verification status
  const isEmailVerified = user?.email_verified === true;
  const isApproved = user?.approval_status === 'approved';

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center">
            <img 
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
              alt="SourceCo Logo" 
              className="h-10 w-10 mr-3"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold">SourceCo</h1>
              <p className="text-lg text-muted-foreground font-light">Marketplace</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className={`p-3 rounded-full ${isEmailVerified ? 'bg-blue-100' : 'bg-yellow-100'}`}>
                {isEmailVerified ? (
                  <ClipboardCheck className="h-8 w-8 text-blue-600" />
                ) : (
                  <Clock className="h-8 w-8 text-yellow-600" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              {isEmailVerified ? 'Account Under Review' : 'Email Verification Required'}
            </CardTitle>
            <CardDescription className="text-center">
              {isEmailVerified ? 
                'Your verified account is being reviewed by our team' :
                'Please verify your email to proceed with account review'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationStatus === 'error' ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900 mb-1">Verification Link Issue</p>
                  <p className="text-sm text-red-800">
                    The verification link has expired or is invalid. Please request a new verification email below.
                  </p>
                </div>
              </div>
            ) : isEmailVerified ? (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">Email Verified Successfully!</p>
                    <p className="text-sm text-blue-800">
                      Your account is now under review by our admin team. You'll receive an email notification once approved.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 mb-1">Email Verification Required</p>
                  <p className="text-sm text-yellow-800">
                    You need to verify your email address before your account can be reviewed. 
                    Please check your inbox for the verification email.
                  </p>
                </div>
              </div>
            )}

            {/* Status Timeline */}
            <div className="bg-muted/50 border rounded-md p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Application Status</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Account Created</p>
                    <p className="text-xs text-muted-foreground">Registration completed successfully</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isEmailVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email Verification</p>
                    <p className="text-xs text-muted-foreground">
                      {isEmailVerified ? 'Email verified successfully' : 'Waiting for email verification'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isEmailVerified ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Admin Review</p>
                    <p className="text-xs text-muted-foreground">
                      {isEmailVerified ? 'Under admin review (1-2 business days)' : 'Pending email verification'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 rounded-full flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Access Granted</p>
                    <p className="text-xs text-muted-foreground">Full marketplace access</p>
                  </div>
                </div>
              </div>
            </div>

            {isEmailVerified && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800 text-center">
                  <strong>What's next?</strong> Our team is reviewing your application. 
                  You'll receive an email notification once your account is approved, typically within 1-3 hours.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {canResendEmail && (
                <Button
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="flex-1"
                >
                  {isResending ? "Sending..." : "Resend Verification Email"}
                </Button>
              )}
              <Button
                variant="outline"
                className={`${canResendEmail ? 'flex-1' : 'w-full'} flex items-center gap-2`}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </>
                )}
              </Button>
            </div>
            <div className="text-sm text-center text-muted-foreground">
              <span>Need help? Contact </span>
              <Link
                to="mailto:support@sourcecodeals.com"
                className="text-primary font-medium hover:underline"
              >
                support@sourcecodeals.com
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default PendingApproval;
