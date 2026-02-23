/**
 * useRoleAccess — Hook for role-based access control in admin pages.
 *
 * Provides the current user's team role and helpers to check page access,
 * mutation permissions, and read-only state based on the role hierarchy.
 *
 * Usage:
 *   const { canAccess, readOnly, canMutate } = useRoleAccess();
 *
 *   if (!canAccess) return <Navigate to="/unauthorized" />;
 *   <Button disabled={readOnly}>Save</Button>
 */

import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { TeamRole } from '@/types';
import {
  canAccessPage,
  canAccessAdmin as canAccessAdminFn,
  canMutate as canMutateFn,
  canManageRoles as canManageRolesFn,
  isReadOnly as isReadOnlyFn,
  hasMinRole,
  getRoleDisplayLabel,
} from '@/config/role-permissions';

export interface RoleAccessResult {
  /** The user's team role, or null for marketplace-only users */
  teamRole: TeamRole | null;

  /** Whether the user can access the admin panel at all */
  canAccessAdmin: boolean;

  /** Whether the user can access the current admin page */
  canAccess: boolean;

  /** Whether the current page is read-only for this user */
  readOnly: boolean;

  /** Whether the user can perform mutations (create, update, delete) */
  canMutate: boolean;

  /** Whether the user can manage other users' roles (owner only) */
  canManageRoles: boolean;

  /** Display label for the user's role */
  roleLabel: string;

  /** Check if the user has at least the given role */
  hasMinRole: (required: TeamRole) => boolean;

  /** Check if the user can access a specific page path */
  canAccessPath: (path: string) => boolean;
}

export function useRoleAccess(): RoleAccessResult {
  const { teamRole } = useAuth();
  const location = useLocation();

  // Default to 'viewer' for safety if role is unknown but user is admin
  const effectiveRole: TeamRole = teamRole ?? 'viewer';

  return {
    teamRole,
    canAccessAdmin: teamRole ? canAccessAdminFn(effectiveRole) : false,
    canAccess: teamRole ? canAccessPage(effectiveRole, location.pathname) : false,
    readOnly: teamRole ? isReadOnlyFn(effectiveRole, location.pathname) : true,
    canMutate: teamRole ? canMutateFn(effectiveRole) : false,
    canManageRoles: teamRole ? canManageRolesFn(effectiveRole) : false,
    roleLabel: teamRole ? getRoleDisplayLabel(effectiveRole) : 'Buyer',
    hasMinRole: (required: TeamRole) =>
      teamRole ? hasMinRole(effectiveRole, required) : false,
    canAccessPath: (path: string) =>
      teamRole ? canAccessPage(effectiveRole, path) : false,
  };
}
