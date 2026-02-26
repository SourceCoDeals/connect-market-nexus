import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { meetsRole, type TeamRole } from '@/config/role-permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
  requireRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireApproved = false,
  requireRole,
}) => {
  const { user, isAdmin, isLoading, authChecked, teamRole } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth state is being determined
  if (isLoading || !authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Requires admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Requires a specific team role
  if (requireRole && !meetsRole(teamRole, requireRole as TeamRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Requires approved account (buyer onboarding completion, etc.)
  if (requireApproved && user.status === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
