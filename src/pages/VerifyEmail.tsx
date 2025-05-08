
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

const VerifyEmail = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
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
              Please check your inbox and click on the verification link to complete your registration. 
              Once verified, your account will be reviewed by our team.
            </p>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            The email should arrive within a few minutes. If you don't see it, 
            check your spam folder.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            className="w-full"
            asChild
          >
            <Link to="/login">
              Back to Login
            </Link>
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
  );
};

export default VerifyEmail;
