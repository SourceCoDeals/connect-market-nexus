/**
 * Inline role gate for admin sub-routes.
 *
 * Wraps a page element and redirects to /unauthorized when the
 * current user's team role is below the required minimum.
 *
 * Usage (inside App.tsx):
 *   <Route path="settings/team" element={<RoleGate min="admin"><InternalTeamPage /></RoleGate>} />
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { meetsRole, type TeamRole } from '@/config/role-permissions';

interface RoleGateProps {
  children: React.ReactNode;
  /** Minimum team role needed to render children. */
  min: TeamRole;
}

export function RoleGate({ children, min }: RoleGateProps) {
  const { teamRole, isLoading, authChecked } = useAuth();

  // While auth is loading, render nothing to avoid flash
  if (isLoading || !authChecked) {
    return null;
  }

  if (!meetsRole(teamRole, min)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
