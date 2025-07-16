
import { CheckCircle, XCircle, Clock, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApprovalStatus } from "@/types";

interface AuthStatusProps {
  status: ApprovalStatus;
  emailVerified: boolean;
  email?: string;
  onResendVerification?: () => void;
  isResending?: boolean;
}

export function AuthStatus({ 
  status, 
  emailVerified, 
  email, 
  onResendVerification,
  isResending 
}: AuthStatusProps) {
  const getStatusIcon = () => {
    if (!emailVerified) return <Mail className="h-8 w-8 text-blue-500" />;
    
    switch (status) {
      case "approved":
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case "rejected":
        return <XCircle className="h-8 w-8 text-red-500" />;
      case "pending":
      default:
        return <Clock className="h-8 w-8 text-yellow-500" />;
    }
  };

  const getStatusBadge = () => {
    if (!emailVerified) {
      return <Badge className="bg-blue-100 text-blue-800">Email Verification Required</Badge>;
    }

    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
    }
  };

  const getTitle = () => {
    if (!emailVerified) return "Verify Your Email";
    
    switch (status) {
      case "approved":
        return "Account Approved";
      case "rejected":
        return "Application Rejected";
      case "pending":
      default:
        return "Application Under Review";
    }
  };

  const getDescription = () => {
    if (!emailVerified) {
      return "Please check your email and click the verification link to continue.";
    }
    
    switch (status) {
      case "approved":
        return "Your account has been approved and you now have access to the marketplace.";
      case "rejected":
        return "Unfortunately, your application has been rejected. Please contact support for more information.";
      case "pending":
      default:
        return "Your application is being reviewed by our team. We'll notify you once a decision has been made.";
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          {getStatusIcon()}
        </div>
        <div className="flex justify-center mb-2">
          {getStatusBadge()}
        </div>
        <CardTitle>{getTitle()}</CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {!emailVerified && email && onResendVerification && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or resend it.
            </p>
            <Button 
              onClick={onResendVerification} 
              disabled={isResending}
              variant="outline"
              className="w-full"
            >
              {isResending ? "Sending..." : "Resend verification email"}
            </Button>
          </div>
        )}
        
        {emailVerified && status === "pending" && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
            <p className="text-sm text-blue-800">
              <strong>What happens next?</strong><br />
              Our team typically reviews applications within 24-48 hours. 
              You'll receive an email notification once your application has been reviewed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
