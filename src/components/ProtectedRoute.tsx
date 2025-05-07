
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
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [waitTime, setWaitTime] = useState(0);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      const timer = setInterval(() => {
        setWaitTime(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(timer);
    }
    
    return undefined;
  }, [isLoading]);

  // Force navigation after 5 seconds of loading
  useEffect(() => {
    if (waitTime >= 5 && isLoading) {
      console.warn("Auth loading timeout reached, redirecting to login");
      window.location.href = "/login";
    }
  }, [waitTime, isLoading]);

  if (isLoading && waitTime < 5) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground">Loading...</p>
        {waitTime > 2 && (
          <p className="text-sm text-muted-foreground">This is taking longer than expected...</p>
        )}
      </div>
    );
  }

  if (!user) {
    // If not loading and no user, redirect to login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requireApproved && user.approval_status !== 'approved' && !user.isAdmin) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
