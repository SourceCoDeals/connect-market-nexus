
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, LogOut, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cleanupAuthState } from "@/lib/auth-helpers";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Get email from location state (passed from signup)
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email address not found. Please try signing up again.",
      });
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) throw error;

      toast({
        title: "Verification email sent!",
        description: "Please check your inbox for the new verification email.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to resend email",
        description: error.message || "Please try again later.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      setIsLoggingOut(true);
      console.log("Navigating back to login from verify email page");
      
      // Clean up auth state first
      await cleanupAuthState();
      
      // Sign out from Supabase to ensure clean state
      await supabase.auth.signOut({ scope: 'global' });
      
      // Navigate to login directly to prevent flashing
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Error during navigation:", error);
      // Force navigation even if cleanup fails
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

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
              <div className="bg-primary/10 p-3 rounded-full">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Check Your Email
            </CardTitle>
            <CardDescription className="text-center">
              We've sent you a verification link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
              <p className="text-sm text-center">
                {email ? (
                  <>
                    We've sent a verification email to <strong>{email}</strong>. 
                    Please check your inbox and click on the verification link to complete your registration.
                  </>
                ) : (
                  <>
                    Please check your inbox and click on the verification link to complete your registration.
                  </>
                )}
              </p>
              <p className="text-sm text-center text-muted-foreground mt-2">
                Once verified, your account will be reviewed by our team for approval.
              </p>
            </div>
            <div className="bg-muted/50 border rounded-md p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">What happens next?</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Check your email and click the verification link</li>
                    <li>Your account will be marked as verified</li>
                    <li>Our admin team will review and approve your account</li>
                    <li>You'll receive an approval email when ready</li>
                  </ol>
                </div>
              </div>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              The email should arrive within a few minutes. If you don't see it, 
              check your spam folder.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {email && (
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="flex-1"
                >
                  {isResending ? "Sending..." : "Resend Email"}
                </Button>
              )}
              <Button
                variant="outline"
                className={`${email ? 'flex-1' : 'w-full'} flex items-center gap-2`}
                onClick={handleBackToLogin}
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
                    Back to Login
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

export default VerifyEmail;
