// ── Centralized application constants ─────────────────────────────────
// Avoid magic strings and numbers scattered throughout the codebase.

// Re-export sibling constant modules
export { STATUS_TAGS, STATUS_TAG_LABELS, type StatusTagValue } from './statusTags';

// ── Route paths ──────────────────────────────────────────────────────

export const ROUTES = {
  // Public
  WELCOME: '/welcome',
  LOGIN: '/login',
  SIGNUP: '/signup',
  SIGNUP_SUCCESS: '/signup-success',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  PENDING_APPROVAL: '/pending-approval',
  AUTH_CALLBACK: '/auth/callback',
  UNAUTHORIZED: '/unauthorized',
  SELL: '/sell',
  SELL_SUCCESS: '/sell/success',

  // Buyer-facing (authenticated)
  MARKETPLACE: '/',
  PROFILE: '/profile',
  LISTING_DETAIL: '/listing/:id',
  MY_DEALS: '/my-deals',
  MESSAGES: '/messages',
  SAVED_LISTINGS: '/saved-listings',

  // Admin
  ADMIN: '/admin',
  ADMIN_DEALS: '/admin/deals',
  ADMIN_BUYERS: '/admin/buyers',
  ADMIN_REQUESTS: '/admin/marketplace/requests',
  ADMIN_USERS: '/admin/marketplace/users',
  ADMIN_PIPELINE: '/admin/deals/pipeline',
  ADMIN_APPROVALS: '/admin/approvals',
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_MESSAGES: '/admin/marketplace/messages',

  // ReMarketing
  REMARKETING: '/admin/remarketing',
  REMARKETING_ACTIVITY_QUEUE: '/admin/remarketing/activity-queue',

  // M&A Intelligence
  MA_INTELLIGENCE: '/admin/ma-intelligence',
} as const;

// ── Pagination ───────────────────────────────────────────────────────

/** Default number of items per page for paginated lists. */
export const DEFAULT_PAGE_SIZE = 50;

/** Default number of items per page for marketplace listing grids. */
export const MARKETPLACE_PAGE_SIZE = 12;

// ── Query / cache timing (milliseconds) ──────────────────────────────

export const CACHE_TIMES = {
  /** Default stale time for react-query (5 minutes). */
  STALE_DEFAULT: 5 * 60 * 1000,
  /** Default garbage-collection time (10 minutes). */
  GC_DEFAULT: 10 * 60 * 1000,
  /** Short stale time for frequently changing data (30 seconds). */
  STALE_SHORT: 30 * 1000,
  /** Long stale time for rarely changing data (10 minutes). */
  STALE_LONG: 10 * 60 * 1000,
  /** Real-time polling interval (10 seconds). */
  REALTIME_POLL: 10 * 1000,
} as const;

// ── Approval & connection statuses ───────────────────────────────────

export const APPROVAL_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const CONNECTION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ON_HOLD: 'on_hold',
} as const;

export const LISTING_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

// ── Buyer types (display labels) ─────────────────────────────────────

export const BUYER_TYPE_LABELS: Record<string, string> = {
  corporate: 'Corporate Development',
  privateEquity: 'Private Equity',
  familyOffice: 'Family Office',
  searchFund: 'Search Fund',
  individual: 'Individual',
  independentSponsor: 'Independent Sponsor',
  advisor: 'Advisor / Banker',
  businessOwner: 'Business Owner',
} as const;

// ── Error handling ───────────────────────────────────────────────────

export const CIRCUIT_BREAKER = {
  /** Number of consecutive failures before opening the circuit. */
  THRESHOLD: 5,
  /** Milliseconds to wait before retrying after circuit opens. */
  TIMEOUT: 30_000,
  /** Maximum retry attempts for failed operations. */
  MAX_RETRIES: 3,
} as const;

// ── Miscellaneous ────────────────────────────────────────────────────

/** Maximum error queue size in the ErrorManager. */
export const MAX_ERROR_QUEUE_SIZE = 100;

/** Toast display duration in milliseconds (non-critical). */
export const TOAST_DURATION_MS = 5_000;
