
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cleanupAuthState } from "@/lib/auth-helpers";

const VerificationSuccess = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // If the user is already approved, redirect to marketplace
  useEffect(() => {
    if (user?.approval_status === 'approved') {
      navigate('/marketplace', { replace: true });
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      console.log("Logging out from verification success page");
      
      // Clean up auth state first
      await cleanupAuthState();
      
      // Sign out from Supabase
      await supabase.auth.signOut({ scope: 'global' });
      
      // Force a complete page reload to ensure clean state
      window.location.href = '/login';
    } catch (error) {
      console.error("Error during logout:", error);
      // Force navigation even if logout fails
      window.location.href = '/login';
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
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Email Verified Successfully
            </CardTitle>
            <CardDescription className="text-center">
              Your account is now pending admin approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <div className="flex gap-3 items-center">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-amber-800 text-sm">
                  Your account is waiting for approval from our team. We will notify you by email once your account is approved.
                </p>
              </div>
            </div>
            <div className="text-sm text-center text-muted-foreground">
              You will not be able to access the marketplace until your account has been approved. This process typically takes 1-2 business days.
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
            <div className="text-xs text-center text-muted-foreground">
              Need help? Contact{" "}
              <a
                href="mailto:support@sourcecodeals.com"
                className="text-primary hover:underline"
              >
                support@sourcecodeals.com
              </a>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default VerificationSuccess;
