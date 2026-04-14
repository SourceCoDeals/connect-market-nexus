import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { meetsRole, type TeamRole } from '@/config/role-permissions';
import { useAdminMFAStatus } from '@/hooks/use-mfa';
import { MFAChallenge } from '@/components/auth/MFAChallenge';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
  requireRole?: string;
}

// Admin paths that admins without MFA may still reach so they can enroll.
// Everything else under /admin is blocked until enrollment + challenge complete.
const MFA_ENROLLMENT_PATH = '/admin/settings/security';
const MFA_EXEMPT_PATHS = [MFA_ENROLLMENT_PATH, '/logout'];

const Spinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireApproved = false,
  requireRole,
}) => {
  const { user, isLoading, isAdmin, authChecked, teamRole } = useAuth();
  const location = useLocation();

  // Check MFA status only when we know the user is an admin on an admin route.
  const mfaCheckEnabled = Boolean(requireAdmin && user && isAdmin);
  const { status: mfaStatus } = useAdminMFAStatus(mfaCheckEnabled);

  // Show nothing while auth state is loading to prevent flash of content
  if (isLoading || !authChecked) {
    return <Spinner />;
  }

  // Not authenticated — redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Buyer approval check
  if (requireApproved && user.approval_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Admin check
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Mandatory MFA for admins — enforced on every admin route.
  // The enrollment path is exempt so admins can actually enroll.
  if (requireAdmin && isAdmin) {
    const isExemptPath = MFA_EXEMPT_PATHS.some((p) => location.pathname.startsWith(p));

    if (mfaStatus === 'loading') {
      return <Spinner />;
    }
    if (mfaStatus === 'needs_enrollment' && !isExemptPath) {
      return (
        <Navigate to={`${MFA_ENROLLMENT_PATH}?mfa_required=1`} state={{ from: location }} replace />
      );
    }
    if (mfaStatus === 'needs_challenge' && !isExemptPath) {
      return (
        <MFAChallenge
          onVerified={() => {
            // Force a re-render so the gate re-evaluates; MFAChallenge handles
            // the challenge-and-verify round trip and the session will now be AAL2.
            window.location.reload();
          }}
          onCancel={() => {
            window.location.href = '/login';
          }}
        />
      );
    }
  }

  // Team role check (e.g., requireRole="admin" or "owner")
  if (requireRole && !meetsRole(teamRole, requireRole as TeamRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
