import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle, Clock, LogOut, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cleanupAuthState } from '@/lib/auth-helpers';

const PendingApproval = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Handle navigation for approved users
  useEffect(() => {
    if (user?.approval_status === 'approved') {
      console.log("User is approved, redirecting to marketplace");
      navigate('/', { replace: true });
    }
  }, [user?.approval_status, navigate]);

  const handleResendVerification = async () => {
    // Safety check - only allow resend for unverified users
    if (user?.email_verified) {
      toast({
        title: "Email already verified",
        description: "Your email is already verified. No need to resend.",
      });
      return;
    }

    if (!user?.email) {
      toast({
        variant: "destructive",
        title: "Email not found",
        description: "Please try signing up again.",
      });
      return;
    }

    setIsResending(true);
    
    try {
      console.log("Attempting to resend verification email for:", user.email);
      
      // Use Supabase's built-in resend functionality
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `https://marketplace.sourcecodeals.com/pending-approval`
        }
      });

      if (resendError) {
        console.error("Supabase resend failed:", resendError);
        
        // Handle specific error cases
        if (resendError.message?.includes('rate limit')) {
          throw new Error("Please wait a moment before requesting another verification email.");
        } else if (resendError.message?.includes('already verified')) {
          throw new Error("Your email is already verified. Please refresh the page.");
        } else {
          throw new Error(resendError.message || "Failed to resend verification email");
        }
      } else {
        console.log("✅ Supabase verification email resent successfully");
      }

      toast({
        title: "Email sent",
        description: "We've sent another verification email to your inbox. Please check your spam folder if you don't see it.",
      });
    } catch (error: any) {
      console.error("Failed to resend verification email:", error);
      toast({
        variant: "destructive",
        title: "Failed to resend email", 
        description: error.message || "Please try again later or contact support.",
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
      
      // Navigate directly to login to prevent flashing
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Error during logout:", error);
      // Force navigation even if logout fails
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Determine UI state based PURELY on user data - no URL parameters
  const getUIState = () => {
    if (user?.email_verified) {
      return 'approved_pending'; // Email verified, waiting for admin approval
    } else {
      return 'email_not_verified'; // Default state - email not verified yet
    }
  };

  const uiState = getUIState();

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
              <div className={`p-3 rounded-full ${uiState === 'approved_pending' ? 'bg-green-100' : 'bg-primary/10'}`}>
                {uiState === 'approved_pending' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <Mail className="h-8 w-8 text-primary" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              {uiState === 'approved_pending' ? 'Account Under Review' : 'Email Verification Required'}
            </CardTitle>
            <CardDescription className="text-center">
              {uiState === 'approved_pending' 
                ? 'Your account is pending admin approval'
                : 'Please verify your email address to continue'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uiState === 'approved_pending' ? (
              // Email is verified - show approval status
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                  <div className="flex gap-3 items-center">
                    <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <p className="text-amber-800 text-sm">
                      Your email has been verified successfully. Your account is now waiting for approval from our team. We will notify you by email once your account is approved.
                    </p>
                  </div>
                </div>
                
                {/* Application Progress Timeline */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-center">Application Progress</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Account Created</p>
                        <p className="text-xs text-muted-foreground">Your account has been successfully created</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Email Verified</p>
                        <p className="text-xs text-muted-foreground">Your email address has been confirmed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Admin Review</p>
                        <p className="text-xs text-muted-foreground">Pending approval from our team</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // Email not verified - show verification instructions
              <>
                <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
                  <div className="flex gap-3 items-start">
                    <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm">
                        We've sent a verification email to <strong>{user?.email}</strong>. 
                        Please check your inbox and click on the verification link to complete your registration.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        The email should arrive within a few minutes. If you don't see it, check your spam folder.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            <div className="text-sm text-center text-muted-foreground">
              {uiState === 'approved_pending'
                ? 'You will not be able to access the marketplace until your account has been approved. This process typically takes 1-2 business days.'
                : 'Once verified, your account will be reviewed by our team for approval.'
              }
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {uiState !== 'approved_pending' && (
              <Button
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
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
            <div className="text-xs text-center text-muted-foreground">
              Need help? Contact{" "}
              <Link
                to="mailto:support@sourcecodeals.com"
                className="text-primary hover:underline"
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