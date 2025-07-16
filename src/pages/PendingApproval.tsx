import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, AlertCircle } from "lucide-react";

const PendingApproval = () => {
  const { user, logout } = useAuth();

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
              <div className="bg-yellow-100 p-3 rounded-full">
                <ClipboardCheck className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Account Under Review
            </CardTitle>
            <CardDescription className="text-center">
              Your account is currently being reviewed by our team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                {user?.email_verified === true ? 
                  "Thank you for verifying your email! Your account requires admin approval before you can access the marketplace." :
                  "Please verify your email to complete your registration. Once verified, your account will need admin approval."
                }
              </p>
            </div>
            {user && !user.email_verified && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  You need to verify your email address before your account can be reviewed. 
                  Please check your inbox for the verification email.
                </p>
              </div>
            )}
            <p className="text-sm text-center text-muted-foreground">
              We'll send you an email once your account has been approved.
              This typically takes 1-2 business days.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => logout()}
            >
              Sign out
            </Button>
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
