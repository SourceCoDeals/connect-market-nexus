/**
 * RoleGate — Per-page role-based access gate for admin routes.
 *
 * Wraps admin page content and checks if the user's team role
 * has permission to access the current page based on the
 * role-permissions config.
 *
 * Usage in admin pages:
 *   <RoleGate>
 *     <DealPipelinePage />
 *   </RoleGate>
 *
 * Or with an explicit minimum role:
 *   <RoleGate minRole="admin">
 *     <SettingsPage />
 *   </RoleGate>
 */

import { Navigate } from "react-router-dom";
import { useRoleAccess } from "@/hooks/use-role-access";
import type { TeamRole } from "@/types";

interface RoleGateProps {
  children: React.ReactNode;
  /** Override: require a specific minimum role instead of using the page permission config */
  minRole?: TeamRole;
  /** Custom fallback instead of redirect (e.g., show a message) */
  fallback?: React.ReactNode;
}

export function RoleGate({ children, minRole, fallback }: RoleGateProps) {
  const { canAccess, hasMinRole } = useRoleAccess();

  const allowed = minRole ? hasMinRole(minRole) : canAccess;

  if (!allowed) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

/**
 * ReadOnlyBanner — Shows a banner when the user has read-only access.
 * Use this inside admin pages to inform moderators they can view but not edit.
 */
export function ReadOnlyBanner() {
  const { readOnly, roleLabel } = useRoleAccess();

  if (!readOnly) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 mb-4 text-sm text-amber-800">
      You have <strong>read-only</strong> access to this page as a {roleLabel}.
      Contact an admin if you need to make changes.
    </div>
  );
}
