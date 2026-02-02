
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
  const { user, isLoading, authChecked } = useAuth();
  const location = useLocation();

  // Simple loading check
  if (isLoading || !authChecked) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // No user - redirect to welcome/persona selection (preserve query params for attribution)
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

  return <>{children}</>;
};

export default ProtectedRoute;
