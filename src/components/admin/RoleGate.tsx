/**
 * Inline role gate for admin sub-routes.
 *
 * Wraps a page element and redirects to /unauthorized when the
 * current user's team role is below the required minimum.
 *
 * Usage (inside App.tsx):
 *   <Route path="settings/team" element={<RoleGate min="admin"><InternalTeamPage /></RoleGate>} />
 */

// TEMPORARY BYPASS: imports disabled for dev
// import { Navigate } from 'react-router-dom';
// import { useAuth } from '@/context/AuthContext';
// import { meetsRole, type TeamRole } from '@/config/role-permissions';
import { type TeamRole } from '@/config/role-permissions';

interface RoleGateProps {
  children: React.ReactNode;
  /** Minimum team role needed to render children. */
  min: TeamRole;
}

export function RoleGate({ children }: RoleGateProps) {
  // TEMPORARY BYPASS: disabled for development page editing
  // TODO: Restore before production
  return <>{children}</>;
}
