
import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
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
  const { user, isLoading, authChecked } = useAuth();
  const location = useLocation();
  const [waitTime, setWaitTime] = useState(0);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading && !authChecked) {
      const timer = setInterval(() => {
        setWaitTime(prev => prev + 1);
      }, 500);
      
      return () => clearInterval(timer);
    }
    
    // Reset wait time when loading completes
    if (!isLoading || authChecked) {
      setWaitTime(0);
    }
    
    return undefined;
  }, [isLoading, authChecked]);

  console.log("ProtectedRoute: ", {
    isLoading,
    authChecked,
    waitTime,
    user: user?.email,
    email_verified: user?.email_verified,
    approval_status: user?.approval_status,
    is_admin: user?.is_admin,
    path: location.pathname,
    requireAdmin,
    requireApproved
  });

  // Force navigation after waiting if auth check is still not complete
  if ((isLoading || !authChecked) && waitTime < 3) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Checking authentication...</p>
        {waitTime > 1 && (
          <p className="text-sm text-muted-foreground">This is taking longer than expected... ({waitTime}s)</p>
        )}
      </div>
    );
  }

  // If waited too long or auth check complete but no user, redirect to login
  if ((waitTime >= 3 && isLoading) || (authChecked && !user)) {
    console.log(`Redirecting to login: auth checked = ${authChecked}, user = ${!!user}, from path = ${location.pathname}`);
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Handle verification and approval requirements
  if (user) {
    // Check if email is verified - use strict comparison and handle edge cases
    const isEmailVerified = user.email_verified === true;
    
    console.log("🔍 User verification status check:", {
      email: user.email,
      email_verified: user.email_verified,
      email_verified_type: typeof user.email_verified,
      approval_status: user.approval_status,
      is_admin: user.is_admin
    });
    
    // If email is not verified, redirect to pending approval (which shows verification required)
    if (!isEmailVerified) {
      console.log("User email not verified, redirecting to pending approval");
      return <Navigate to="/pending-approval" replace />;
    }
    
    // Check for admin requirement - strictly check for true
    if (requireAdmin && user.is_admin !== true) {
      console.log("User is not an admin, redirecting to unauthorized");
      return <Navigate to="/unauthorized" replace />;
    }

    // Check for approval requirement - non-admin users need approval
    // Admin users bypass approval requirement
    if (requireApproved && user.approval_status !== 'approved' && user.is_admin !== true) {
      console.log("User is not approved, redirecting to pending approval page");
      return <Navigate to="/pending-approval" replace />;
    }

    console.log(`Protected route access granted to ${location.pathname} for user ${user.email}`);
    return <>{children}</>;
  }

  // This should never happen but as a final fallback
  console.warn("Unexpected state in ProtectedRoute - redirecting to login");
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
};

export default ProtectedRoute;
