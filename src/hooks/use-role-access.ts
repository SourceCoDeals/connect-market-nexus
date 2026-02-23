/**
 * Hook that provides role-based access checks for any admin page.
 *
 * Usage:
 *   const { canAccess, readOnly, canMutate, roleLabel } = useRoleAccess();
 *   if (!canAccess) return <Navigate to="/unauthorized" />;
 *   <Button disabled={readOnly}>Save</Button>
 */

import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  canAccessPage,
  isReadOnly,
  canMutate as canMutateFn,
  canManageRoles as canManageRolesFn,
  meetsRole,
  ROLE_LABELS,
  type TeamRole,
} from '@/config/role-permissions';

export function useRoleAccess(overridePath?: string) {
  const { teamRole } = useAuth();
  const location = useLocation();
  const path = overridePath ?? location.pathname;

  return {
    /** The user's current team role. */
    teamRole,
    /** True if the user can view this page. */
    canAccess: canAccessPage(path, teamRole),
    /** True if the user is restricted to read-only on this page. */
    readOnly: isReadOnly(path, teamRole),
    /** True if the user can create/edit/delete on this page. */
    canMutate: canMutateFn(path, teamRole),
    /** True if the user can manage other users' roles (owner only). */
    canManageRoles: canManageRolesFn(teamRole),
    /** Human-readable label for the current role. */
    roleLabel: teamRole ? ROLE_LABELS[teamRole] : 'Unknown',
    /** Check if user meets a specific minimum role. */
    meetsRole: (required: TeamRole) => meetsRole(teamRole, required),
  };
}
