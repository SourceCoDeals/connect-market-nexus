
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

  console.log("ProtectedRoute: ", {
    isLoading,
    authChecked,
    user: user?.email,
    email_verified: user?.email_verified,
    approval_status: user?.approval_status,
    is_admin: user?.is_admin,
    path: location.pathname,
    requireAdmin,
    requireApproved
  });

  // Show loading while checking auth
  if (isLoading || !authChecked) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="text-muted-foreground">Checking authentication...</p>
      </div>
    );
  }

  // No user - redirect to login
  if (!user) {
    console.log(`No user found, redirecting to login from ${location.pathname}`);
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Check email verification
  if (user.email_verified !== true) {
    console.log("User email not verified, redirecting to verify-email");
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }
  
  // Check admin requirement
  if (requireAdmin && user.is_admin !== true) {
    console.log("User is not an admin, redirecting to unauthorized");
    return <Navigate to="/unauthorized" replace />;
  }

  // Check approval requirement (admin users bypass this)
  if (requireApproved && user.approval_status !== 'approved' && user.is_admin !== true) {
    console.log("User is not approved, redirecting to pending approval");
    return <Navigate to="/pending-approval" replace />;
  }

  console.log(`Protected route access granted to ${location.pathname} for user ${user.email}`);
  return <>{children}</>;
};

export default ProtectedRoute;
