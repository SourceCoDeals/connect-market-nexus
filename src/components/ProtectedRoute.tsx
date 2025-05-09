
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
      }, 500); // Faster counter for better UX
      
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
    path: location.pathname
  });

  // Force navigation after 3 seconds of loading if auth check is still not complete
  if ((isLoading || !authChecked) && waitTime < 6) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Loading authentication...</p>
        {waitTime > 1 && (
          <p className="text-sm text-muted-foreground">This is taking longer than expected... ({waitTime}s)</p>
        )}
      </div>
    );
  }

  // If waited too long or auth check complete but no user, redirect to login
  if ((waitTime >= 6 && isLoading) || (authChecked && !user)) {
    console.log(`Redirecting to login: auth checked = ${authChecked}, user = ${!!user}, from path = ${location.pathname}`);
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Handle verification and approval requirements
  if (user) {
    // Check if email is verified
    if (!user.email_verified) {
      console.log("User email not verified, redirecting to verify email page");
      return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
    }
    
    // Check for admin requirement
    if (requireAdmin && !user.isAdmin) {
      console.log("User is not an admin, redirecting to unauthorized");
      return <Navigate to="/unauthorized" replace />;
    }

    // Check for approval requirement
    if (requireApproved && user.approval_status !== 'approved' && !user.isAdmin) {
      console.log("User is not approved, redirecting to verification success");
      return <Navigate to="/verification-success" replace />;
    }

    console.log(`Protected route access granted to ${location.pathname} for user ${user.email}`);
    return <>{children}</>;
  }

  // This should never happen but as a final fallback
  console.warn("Unexpected state in ProtectedRoute - redirecting to login");
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
};

export default ProtectedRoute;
