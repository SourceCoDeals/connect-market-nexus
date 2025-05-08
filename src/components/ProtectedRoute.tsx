
import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

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
      }, 1000);
      
      return () => clearInterval(timer);
    }
    
    // Reset wait time when loading completes
    if (!isLoading || authChecked) {
      setWaitTime(0);
    }
    
    return undefined;
  }, [isLoading, authChecked]);

  // Force navigation after 3 seconds of loading if auth check is still not complete
  if ((isLoading || !authChecked) && waitTime < 3) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground">Loading...</p>
        {waitTime > 1 && (
          <p className="text-sm text-muted-foreground">This is taking longer than expected...</p>
        )}
      </div>
    );
  }

  // If waited too long or auth check complete but no user, redirect to login
  if ((waitTime >= 3 && isLoading) || (authChecked && !user)) {
    console.log("Redirecting to login: auth checked =", authChecked, "user =", !!user);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && requireAdmin && !user.isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (user && requireApproved && user.approval_status !== 'approved' && !user.isAdmin) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
