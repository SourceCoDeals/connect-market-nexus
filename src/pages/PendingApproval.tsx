import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, AlertCircle, Clock, CheckCircle, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PendingApproval = () => {
  const { user, logout } = useAuth();
  const [canResendEmail, setCanResendEmail] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // Allow resending email if user email is not verified
    setCanResendEmail(user?.email_verified === false);
  }, [user]);

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
              <div className={`p-3 rounded-full ${user?.email_verified ? 'bg-blue-100' : 'bg-yellow-100'}`}>
                {user?.email_verified ? (
                  <ClipboardCheck className="h-8 w-8 text-blue-600" />
                ) : (
                  <Clock className="h-8 w-8 text-yellow-600" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              {user?.email_verified ? 'Account Under Review' : 'Email Verification Required'}
            </CardTitle>
            <CardDescription className="text-center">
              {user?.email_verified ? 
                'Your verified account is being reviewed by our team' :
                'Please verify your email to proceed with account review'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.email_verified ? (
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
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900 mb-1">Email Verification Required</p>
                  <p className="text-sm text-red-800">
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
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${user?.email_verified ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email Verification</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email_verified ? 'Email verified successfully' : 'Waiting for email verification'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${user?.email_verified ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Admin Review</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email_verified ? 'Under admin review (1-2 business days)' : 'Pending email verification'}
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

            {user?.email_verified && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800 text-center">
                  <strong>What's next?</strong> Our team is reviewing your application. 
                  You'll receive an email notification once your account is approved, typically within 1-2 business days.
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
                className={`${canResendEmail ? 'flex-1' : 'w-full'}`}
                onClick={() => logout()}
              >
                Sign out
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
