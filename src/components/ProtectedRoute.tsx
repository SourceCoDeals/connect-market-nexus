
import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMFAChallengeRequired } from "@/hooks/use-mfa";
import { MFAChallenge } from "@/components/auth/MFAChallenge";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
}

const AUTH_TIMEOUT_MS = 10_000; // 10 seconds max wait for auth

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireApproved = true
}) => {
  const { user, isLoading, authChecked, logout } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  const { needsChallenge, isChecking } = useMFAChallengeRequired();
  const [mfaVerified, setMfaVerified] = useState(false);

  // SECURITY: Prevent infinite loading spinner if auth never resolves
  useEffect(() => {
    if (!isLoading && authChecked) return;
    const timer = setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading, authChecked]);

  // Loading check with timeout safety valve
  if ((isLoading || !authChecked) && !timedOut) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // No user (or timed out) - redirect to welcome/persona selection
  if (!user) {
    const redirectPath = `/welcome${location.search}`;
    return <Navigate to={redirectPath} state={{ from: location.pathname }} replace />;
  }

  // Check admin requirement
  if (requireAdmin && user.is_admin !== true) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check approval requirement (admin users bypass this)
  if (requireApproved && user.approval_status !== 'approved' && user.is_admin !== true) {
    return <Navigate to="/pending-approval" replace />;
  }

  // MFA enforcement for admin routes
  if (requireAdmin && !isChecking && needsChallenge && !mfaVerified) {
    return (
      <MFAChallenge
        onVerified={() => setMfaVerified(true)}
        onCancel={async () => {
          await supabase.auth.signOut();
          logout();
        }}
      />
    );
  }

  // Show loading while checking MFA for admin routes
  if (requireAdmin && isChecking) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Verifying security...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
