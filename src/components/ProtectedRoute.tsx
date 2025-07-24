
import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  requireApproved = true
}) => {
  const { user, isLoading, authChecked, processingVerification } = useAuth();
  const location = useLocation();

  // FAILSAFE: Check for verification tokens in URL to prevent flash
  const urlParams = new URLSearchParams(window.location.search);
  const hasTokens = urlParams.get('access_token') && urlParams.get('refresh_token');
  const isOnPendingApproval = location.pathname === '/pending-approval';
  
  // If we detect tokens on pending approval page, show loading immediately
  if (hasTokens && isOnPendingApproval) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Verifying your email...</p>
        <p className="text-sm text-muted-foreground/80">Please wait while we confirm your email verification</p>
      </div>
    );
  }

  // Simple loading check
  if (isLoading || !authChecked) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Show verification processing screen to prevent flash
  if (processingVerification) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Verifying your email...</p>
        <p className="text-sm text-muted-foreground/80">Please wait while we confirm your email verification</p>
      </div>
    );
  }

  // No user - redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Check email verification (but skip if we're processing verification)
  if (user.email_verified !== true) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }
  
  // Check admin requirement
  if (requireAdmin && user.is_admin !== true) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check approval requirement (admin users bypass this)
  if (requireApproved && user.approval_status !== 'approved' && user.is_admin !== true) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
