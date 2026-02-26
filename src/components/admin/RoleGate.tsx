/**
 * RoleGate.tsx
 *
 * Inline role gate for admin sub-routes. Wraps a page element and
 * redirects to /unauthorized when the current user's team role is
 * below the required minimum.
 *
 * Usage (inside App.tsx):
 *   <Route path="settings/team" element={<RoleGate min="admin"><InternalTeamPage /></RoleGate>} />
 *
 * AUDIT REF: CTO Audit February 2026 — restored from dev bypass
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
  const { teamRole, isLoading } = useAuth();

  // While auth is loading, show nothing to prevent flash of unauthorized content
  if (isLoading) return null;

  if (!meetsRole(teamRole, min)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
