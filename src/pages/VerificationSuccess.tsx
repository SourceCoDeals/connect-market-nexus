
import { useAuth } from "@/context/AuthContext";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const VerificationSuccess = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async () => {
    if (!user?.email) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });

      if (error) throw error;

      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to view this page.</p>
      </div>
    );
  }

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

        <AuthStatus
          status={user.approval_status}
          emailVerified={user.email_verified}
          email={user.email}
          onResendVerification={!user.email_verified ? handleResendVerification : undefined}
          isResending={isResending}
        />

        <div className="flex justify-center">
          <Button variant="outline" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerificationSuccess;
