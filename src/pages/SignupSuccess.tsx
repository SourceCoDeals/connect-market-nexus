import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, ArrowRight, Clock, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SignupSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isResending, setIsResending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const email = searchParams.get('email') || '';

  useEffect(() => {
    // Check if email is already verified (rare but possible)
    const checkEmailStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          setEmailVerified(true);
        }
      } catch (error) {
        // Ignore - user not logged in yet
      }
    };
    
    checkEmailStatus();
  }, []);

  const handleResendVerification = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No email address found. Please try signing up again.",
      });
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;

      toast({
        title: "Email sent!",
        description: "We've sent another verification email to your inbox.",
      });
    } catch (error: any) {
      console.error('Resend verification error:', error);
      
      let errorMessage = "Failed to resend verification email. Please try again.";
      if (error.message?.includes('already verified')) {
        errorMessage = "Your email is already verified! You can now log in.";
        setEmailVerified(true);
      } else if (error.message?.includes('rate limit')) {
        errorMessage = "Please wait a moment before requesting another email.";
      }
      
      toast({
        variant: error.message?.includes('already verified') ? "default" : "destructive",
        title: error.message?.includes('already verified') ? "Already verified" : "Error",
        description: errorMessage,
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircle className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-center">
                Account Created Successfully!
              </CardTitle>
              <CardDescription className="text-center mt-2">
                Welcome to the marketplace! Here's what happens next:
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Progress Steps */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-primary p-1.5">
                  <CheckCircle className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Account Created</p>
                  <p className="text-xs text-muted-foreground">✓ Completed</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className={`rounded-full p-1.5 ${emailVerified ? 'bg-primary' : 'bg-muted'}`}>
                  <Mail className={`h-4 w-4 ${emailVerified ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">Email Verification</p>
                  <p className="text-xs text-muted-foreground">
                    {emailVerified ? '✓ Verified' : 'Check your email inbox'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-muted p-1.5">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Admin Approval</p>
                  <p className="text-xs text-muted-foreground">Typically within 24 hours</p>
                </div>
              </div>
            </div>

            {/* What's Next Section */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">What happens next?</p>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>1. Check your email</strong> - Click the verification link we sent to {email}</p>
                <p><strong>2. Admin review</strong> - Our team will approve your account (usually within 24 hours)</p>
                <p><strong>3. Get notified</strong> - You'll receive an email when your account is approved</p>
                <p><strong>4. Start browsing</strong> - Access thousands of business listings once approved</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {!emailVerified && (
                <Button 
                  onClick={handleResendVerification}
                  disabled={isResending}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              )}
              
              <Link to="/login" className="block">
                <Button className="w-full">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {emailVerified ? 'Continue to Login' : 'I\'ll verify later - Take me to Login'}
                </Button>
              </Link>
            </div>

            {/* Support */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Need help? Contact us at{' '}
                <a href="mailto:support@sourcecodeals.com" className="text-primary hover:underline">
                  support@sourcecodeals.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignupSuccess;