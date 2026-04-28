// ============================================================================
// Activity event bus
// ============================================================================
// Custom-event names + payload types for inter-component communication on
// the deal page. Lightweight alternative to lifting state up through
// ReMarketingDealDetail.
//
// Producers:
//   - DealSearchDialog          → ACTIVITY_SEARCH_JUMP_EVENT
//   - DealActivityStatsStrip    → ACTIVITY_SET_FILTER_EVENT, ACTIVITY_SEARCH_JUMP_EVENT
//
// Consumers:
//   - UnifiedDealTimeline       (subscribes to both)
// ============================================================================

import type { FilterCategory } from '@/hooks/use-unified-deal-activity-entries';

// ── Jump-to-entry (Fix #5 / audit #2) ─────────────────────────────────────

export const ACTIVITY_SEARCH_JUMP_EVENT = 'activity-search-jump';

export interface ActivitySearchJumpDetail {
  /** Source-prefixed entry id (e.g. `call-<uuid>`). Optional — rawId is enough. */
  entryId?: string;
  /** Raw uuid from the canonical row (no prefix). The timeline strips its prefix. */
  rawId?: string;
  source?: string;
}

export function dispatchActivityJump(detail: ActivitySearchJumpDetail) {
  window.dispatchEvent(new CustomEvent(ACTIVITY_SEARCH_JUMP_EVENT, { detail }));
}

// ── Set-filter (audit #2) ─────────────────────────────────────────────────

export const ACTIVITY_SET_FILTER_EVENT = 'activity-set-filter';

export interface ActivitySetFilterDetail {
  filter: FilterCategory;
  /** Optional: also clear the search input when setting the filter. */
  clearSearch?: boolean;
}

export function dispatchActivitySetFilter(detail: ActivitySetFilterDetail) {
  window.dispatchEvent(new CustomEvent(ACTIVITY_SET_FILTER_EVENT, { detail }));
}
