import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { meetsRole, type TeamRole } from '@/config/role-permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
  requireRole?: TeamRole;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireApproved = false,
  requireRole,
}) => {
  const { user, isLoading, isAdmin, teamRole } = useAuth();

  // While auth state is loading, render nothing to prevent flash
  if (isLoading) return null;

  // No authenticated session → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Require approved user
  if (requireApproved && user.approval_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Require admin access
  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have admin privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Require specific team role
  if (requireRole && !meetsRole(teamRole, requireRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have the required role to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
