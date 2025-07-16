
import { useLocation, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { useAuth } from "@/context/AuthContext";

const VerifyEmail = () => {
  const location = useLocation();
  const { user } = useAuth();
  const email = location.state?.email || user?.email;

  // If user is already verified, redirect to appropriate page
  if (user?.email_verified) {
    if (user.approval_status === 'approved') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/pending-approval" replace />;
    }
  }

  if (!email) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Please check your email inbox and click the verification link to activate your account.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>After clicking the verification link, you'll be able to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Complete your account setup</li>
                <li>Access the marketplace once approved</li>
                <li>Save and connect with listings</li>
              </ul>
            </div>

            <ResendVerificationButton email={email} />

            <div className="text-center text-xs text-muted-foreground">
              <p>Don't see the email? Check your spam folder or try resending.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
