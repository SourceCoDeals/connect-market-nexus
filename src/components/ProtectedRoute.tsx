import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
  requireRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin,
  requireApproved,
  requireRole,
}) => {
  const { user, isLoading, authChecked } = useAuth();

  // Show a loading spinner while authentication state is being determined
  if (isLoading || !authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No authenticated user — redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin check
  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Approval status check
  if (requireApproved && user.approval_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Role check
  if (requireRole && user.role !== requireRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
