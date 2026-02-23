/**
 * Role-based permission configuration for the SourceCo admin panel.
 *
 * Defines the four internal team roles (owner, admin, moderator, viewer)
 * and maps each to the admin pages they can access plus what actions
 * they can perform.
 *
 * The hierarchy is: owner > admin > moderator > viewer
 *
 * - Owner:     Full access including role management
 * - Admin:     Full deal/user management, approvals, exports, settings, enrichment
 * - Moderator: Read-only access to most admin pages (called "Team Member" in UI)
 * - Viewer:    Marketplace access only — same as an approved buyer, no admin panel
 */

export type TeamRole = 'owner' | 'admin' | 'moderator' | 'viewer';

export interface PagePermission {
  /** Human-readable name shown in audit/debug */
  label: string;
  /** Route path pattern (matched against location.pathname) */
  path: string;
  /** Minimum role required to view this page */
  minRole: TeamRole;
  /** If true, the page is read-only for moderators (mutations disabled) */
  readOnlyForModerator?: boolean;
}

// Role hierarchy as numeric weight — higher = more privilege
const ROLE_WEIGHT: Record<TeamRole, number> = {
  viewer: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

/**
 * Check if `role` meets or exceeds the `required` role level.
 */
export function hasMinRole(role: TeamRole, required: TeamRole): boolean {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[required];
}

/**
 * Whether the given role can access the admin panel at all.
 * Viewers cannot — they are treated the same as marketplace buyers.
 */
export function canAccessAdmin(role: TeamRole): boolean {
  return hasMinRole(role, 'moderator');
}

/**
 * Whether the given role can perform mutations (create, update, delete)
 * on admin data. Moderators are read-only.
 */
export function canMutate(role: TeamRole): boolean {
  return hasMinRole(role, 'admin');
}

/**
 * Whether the given role can manage other users' roles.
 * Only owners can do this.
 */
export function canManageRoles(role: TeamRole): boolean {
  return role === 'owner';
}

// ---------------------------------------------------------------------------
// Admin page permission map
// ---------------------------------------------------------------------------

export const ADMIN_PAGE_PERMISSIONS: PagePermission[] = [
  // ── Dashboard ──
  { label: 'Dashboard', path: '/admin', minRole: 'moderator', readOnlyForModerator: true },

  // ── Deals ──
  { label: 'All Deals', path: '/admin/deals', minRole: 'moderator', readOnlyForModerator: true },
  { label: 'Deal Detail', path: '/admin/deals/:dealId', minRole: 'moderator', readOnlyForModerator: true },
  { label: 'Deal Pipeline', path: '/admin/deals/pipeline', minRole: 'admin' },

  // ── Buyers ──
  { label: 'All Buyers', path: '/admin/buyers', minRole: 'moderator', readOnlyForModerator: true },
  { label: 'Buyer Detail', path: '/admin/buyers/:id', minRole: 'moderator', readOnlyForModerator: true },
  { label: 'Buyer Universes', path: '/admin/buyers/universes', minRole: 'admin' },
  { label: 'Universe Detail', path: '/admin/buyers/universes/:id', minRole: 'admin' },
  { label: 'Deal Sourcing', path: '/admin/buyers/deal-sourcing', minRole: 'admin' },
  { label: 'Buyer Contacts', path: '/admin/buyers/contacts', minRole: 'moderator', readOnlyForModerator: true },

  // ── Marketplace ──
  { label: 'Marketplace Requests', path: '/admin/marketplace/requests', minRole: 'moderator', readOnlyForModerator: true },
  { label: 'Message Center', path: '/admin/marketplace/messages', minRole: 'moderator', readOnlyForModerator: true },
  { label: 'Marketplace Users', path: '/admin/marketplace/users', minRole: 'admin' },

  // ── Remarketing ──
  { label: 'Remarketing Dashboard', path: '/admin/remarketing', minRole: 'admin' },
  { label: 'Activity Queue', path: '/admin/remarketing/activity-queue', minRole: 'admin' },
  { label: 'CapTarget Leads', path: '/admin/remarketing/leads/captarget', minRole: 'admin' },
  { label: 'GP Partner Leads', path: '/admin/remarketing/leads/gp-partners', minRole: 'admin' },
  { label: 'Valuation Leads', path: '/admin/remarketing/leads/valuation', minRole: 'admin' },
  { label: 'Referral Partners', path: '/admin/remarketing/leads/referrals', minRole: 'admin' },
  { label: 'Deal Matching', path: '/admin/remarketing/matching/:listingId', minRole: 'admin' },
  { label: 'Introductions', path: '/admin/remarketing/introductions/:listingId', minRole: 'admin' },

  // ── Approvals ──
  { label: 'Approvals', path: '/admin/approvals', minRole: 'admin' },

  // ── Analytics ──
  { label: 'Analytics', path: '/admin/analytics', minRole: 'moderator', readOnlyForModerator: true },
  { label: 'Transcript Analytics', path: '/admin/analytics/transcripts', minRole: 'moderator', readOnlyForModerator: true },

  // ── Settings ──
  { label: 'Internal Team', path: '/admin/settings/team', minRole: 'admin' },
  { label: 'Owner Leads', path: '/admin/settings/owner-leads', minRole: 'admin' },
  { label: 'Notifications', path: '/admin/settings/notifications', minRole: 'admin' },
  { label: 'Webhooks', path: '/admin/settings/webhooks', minRole: 'admin' },
  { label: 'Enrichment Queue', path: '/admin/settings/enrichment-queue', minRole: 'admin' },
  { label: 'Enrichment Test', path: '/admin/settings/enrichment-test', minRole: 'admin' },
  { label: 'Remarketing Settings', path: '/admin/settings/remarketing', minRole: 'admin' },
  { label: 'Data Recovery', path: '/admin/settings/data-recovery', minRole: 'owner' },
  { label: 'Form Monitoring', path: '/admin/settings/form-monitoring', minRole: 'admin' },
  { label: 'Security Settings', path: '/admin/settings/security', minRole: 'admin' },
  { label: 'System Test', path: '/admin/system-test', minRole: 'owner' },

  // ── M&A Intelligence ──
  { label: 'M&A Dashboard', path: '/admin/ma-intelligence', minRole: 'admin' },
  { label: 'M&A Trackers', path: '/admin/ma-intelligence/trackers', minRole: 'admin' },
  { label: 'M&A Tracker Detail', path: '/admin/ma-intelligence/trackers/:id', minRole: 'admin' },
  { label: 'M&A Buyers', path: '/admin/ma-intelligence/buyers', minRole: 'admin' },
  { label: 'M&A Buyer Detail', path: '/admin/ma-intelligence/buyers/:id', minRole: 'admin' },
];

/**
 * Look up the permission entry for a given pathname.
 * Handles dynamic segments like :id by converting to a regex match.
 */
export function getPagePermission(pathname: string): PagePermission | undefined {
  // Exact match first
  const exact = ADMIN_PAGE_PERMISSIONS.find(p => p.path === pathname);
  if (exact) return exact;

  // Pattern match (replace :param with a regex segment)
  return ADMIN_PAGE_PERMISSIONS.find(p => {
    if (!p.path.includes(':')) return false;
    const regex = new RegExp(
      '^' + p.path.replace(/:[^/]+/g, '[^/]+') + '$'
    );
    return regex.test(pathname);
  });
}

/**
 * Check if a role can access a specific admin page.
 */
export function canAccessPage(role: TeamRole, pathname: string): boolean {
  const permission = getPagePermission(pathname);
  // If no permission defined, default to admin-only for safety
  if (!permission) return hasMinRole(role, 'admin');
  return hasMinRole(role, permission.minRole);
}

/**
 * Check if the role has read-only access to a page (true for moderators
 * on pages flagged readOnlyForModerator).
 */
export function isReadOnly(role: TeamRole, pathname: string): boolean {
  if (role !== 'moderator') return false;
  const permission = getPagePermission(pathname);
  return permission?.readOnlyForModerator === true;
}

/**
 * Get the display label for a team role.
 */
export function getRoleDisplayLabel(role: TeamRole): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'admin': return 'Admin';
    case 'moderator': return 'Team Member';
    case 'viewer': return 'Viewer';
    default: return 'Unknown';
  }
}
