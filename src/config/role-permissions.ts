/**
 * Role-permissions configuration.
 *
 * Maps every admin page/route to its minimum required team role.
 * Hierarchy: owner > admin > moderator > viewer
 *
 * Usage:
 *   import { canAccessPage, isReadOnly } from '@/config/role-permissions';
 *   if (!canAccessPage('/admin/settings/team', userRole)) redirect('/unauthorized');
 */

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'viewer';

/** Numeric weight – higher = more privileged. */
export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  viewer: 1,
};

/** Display label for UI badges / dropdowns. */
export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  moderator: 'Team Member',
  viewer: 'Viewer',
};

// ── Page-level access matrix ────────────────────────────────────────────────

interface PagePermission {
  /** Minimum role that can view this page at all. */
  minRole: TeamRole;
  /** Minimum role that can perform mutations (create/edit/delete). Below this = read-only. */
  mutateRole?: TeamRole;
}

/**
 * Map of admin route paths to their permission requirements.
 * Paths use prefix matching: '/admin/deals' covers '/admin/deals/:dealId' too.
 */
export const PAGE_PERMISSIONS: Record<string, PagePermission> = {
  // ── Dashboard ───────────────────────────────────────────
  '/admin': { minRole: 'viewer' },

  // ── Deals ───────────────────────────────────────────────
  '/admin/deals': { minRole: 'viewer', mutateRole: 'admin' },
  '/admin/deals/pipeline': { minRole: 'admin' },

  // ── Buyers ──────────────────────────────────────────────
  '/admin/buyers': { minRole: 'viewer', mutateRole: 'admin' },
  '/admin/buyers/universes': { minRole: 'admin' },
  '/admin/buyers/deal-sourcing': { minRole: 'moderator', mutateRole: 'admin' },
  '/admin/buyers/contacts': { minRole: 'moderator', mutateRole: 'admin' },

  // ── Marketplace management ──────────────────────────────
  '/admin/marketplace/requests': { minRole: 'moderator', mutateRole: 'admin' },
  '/admin/marketplace/messages': { minRole: 'moderator' },
  '/admin/marketplace/users': { minRole: 'moderator', mutateRole: 'admin' },

  // ── ReMarketing ─────────────────────────────────────────
  '/admin/remarketing': { minRole: 'admin' },

  // ── Approvals ───────────────────────────────────────────
  '/admin/approvals': { minRole: 'admin' },

  // ── Analytics ───────────────────────────────────────────
  '/admin/analytics': { minRole: 'viewer' },
  '/admin/analytics/transcripts': { minRole: 'moderator' },

  // ── Settings ────────────────────────────────────────────
  '/admin/settings/team': { minRole: 'admin' },
  '/admin/settings/owner-leads': { minRole: 'moderator', mutateRole: 'admin' },
  '/admin/settings/notifications': { minRole: 'moderator' },
  '/admin/settings/webhooks': { minRole: 'admin' },
  '/admin/settings/enrichment-queue': { minRole: 'admin' },
  '/admin/settings/enrichment-test': { minRole: 'admin' },
  '/admin/settings/remarketing': { minRole: 'admin' },
  '/admin/settings/data-recovery': { minRole: 'owner' },
  '/admin/settings/form-monitoring': { minRole: 'admin' },
  '/admin/settings/security': { minRole: 'admin' },

  // ── System ──────────────────────────────────────────────
  '/admin/system-test': { minRole: 'owner' },
};

// ── Helper functions ────────────────────────────────────────────────────────

/** True if `role` meets or exceeds `required`. */
export function meetsRole(role: TeamRole | null | undefined, required: TeamRole): boolean {
  if (!role) return false;
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[required] ?? 0);
}

/**
 * Resolve the permission entry for a given path.
 * Uses longest-prefix match so '/admin/deals/pipeline' matches before '/admin/deals'.
 */
function resolvePermission(path: string): PagePermission | null {
  // Sort keys by length descending so longest prefix wins
  const sorted = Object.keys(PAGE_PERMISSIONS).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (path === key || path.startsWith(key + '/')) {
      return PAGE_PERMISSIONS[key];
    }
  }
  return null;
}

/** Can the given role access the page at all? */
export function canAccessPage(path: string, role: TeamRole | null | undefined): boolean {
  const perm = resolvePermission(path);
  if (!perm) return meetsRole(role, 'viewer'); // default: any team member
  return meetsRole(role, perm.minRole);
}

/** Is the given role restricted to read-only on this page? */
export function isReadOnly(path: string, role: TeamRole | null | undefined): boolean {
  const perm = resolvePermission(path);
  if (!perm || !perm.mutateRole) return false; // no mutate restriction
  return !meetsRole(role, perm.mutateRole);
}

/** Can the given role perform mutations on this page? */
export function canMutate(path: string, role: TeamRole | null | undefined): boolean {
  return canAccessPage(path, role) && !isReadOnly(path, role);
}

/** Only owners can manage other users' roles. */
export function canManageRoles(role: TeamRole | null | undefined): boolean {
  return meetsRole(role, 'owner');
}
