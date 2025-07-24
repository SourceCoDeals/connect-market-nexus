
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

  // Check if we're coming from an email link (on pending approval page)
  const isFromEmailLink = location.pathname === '/pending-approval';

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

  // Only check email verification if NOT coming from email link
  // Email links should go to pending approval even if verification failed
  if (user.email_verified !== true && !isFromEmailLink) {
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
