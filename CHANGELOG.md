## CHANGELOG

### 2026-04-26 — Deal Activity Tracker Rebuild (5-phase)

- **What:** Made the deal page Activity tab answer the four product questions ("what conversations happened?", "where did it end?", "best way to reach this contact?", "how many touches?") in <10 seconds.
  - **Phase 1:** Fixed Fireflies meetings rendering as "Call" with green badge in `ContactActivityTimeline` — added an `isMeeting` branch with purple styling.
  - **Phase 2:** Added a `deal_transcripts` UNION arm to the `unified_contact_timeline` view so seller-side Fireflies meetings, PhoneBurner call transcripts, and manual uploads surface in `useContactCombinedHistory`, `get_firm_activity`, and `get_firm_touchpoint_counts`.
  - **Phase 3:** New `DealActivityStatsStrip` (4 cells: Touchpoints 30d, Last touch, Best channel, Next action) backed by the new `useDealActivityStats` hook. Extracted `useUnifiedDealActivityEntries` from `UnifiedDealTimeline` so both the timeline and the stats strip share one query path.
  - **Phase 4:** `UnmatchedActivitiesPage` now has four tabs (Calls, Outlook emails, Smartlead, HeyReach LinkedIn) — each lets users link an orphaned record to a deal. `LogManualCallDialog` → `LogManualTouchDialog` adds Email / LinkedIn / Meeting touch types; new `manual_entry` flag on `email_messages` and `heyreach_messages` distinguishes manual rows from sync-captured ones.
  - **Phase 5:** Search input (200ms debounce), Timeline / By contact toggle, click-to-detail `ActivityDetailDrawer`, DEV-gated observability log on the data hook, vitest suite (18 tests) for the pure stats compute layer.
- **Why:** Pre-existing audit (`CONTACT_ACTIVITY_DEEP_DIVE_AUDIT_2026-04-16.md`) flagged the Activity tab as unable to answer the four questions a SourceCo team member asks when opening a deal page. Audit baseline was stale — see Reality Reconciliation in the verification report for what was already in place vs what this rebuild added.
- **Files changed:** 13 (3,769 insertions, 1,081 deletions)
  - SQL: `supabase/migrations/20260805000001_unified_timeline_add_deal_transcripts.sql`, `supabase/migrations/20260805000002_email_messages_manual_entry_flag.sql`
  - Hooks: `src/hooks/use-unified-deal-activity-entries.tsx`, `src/hooks/use-deal-activity-stats.ts`, `src/hooks/use-deal-activity-stats.test.ts`
  - Components: `DealActivityStatsStrip.tsx`, `ActivityDetailDrawer.tsx`, `LogManualTouchDialog.tsx` (rename of `LogManualCallDialog.tsx`), `UnifiedDealTimeline.tsx`, `ContactActivityTimeline.tsx`
  - Pages: `ReMarketingDealDetail/index.tsx`, `UnmatchedActivitiesPage.tsx`
- **DB changes:**
  - `unified_contact_timeline` view dropped + recreated with seventh `deal_transcripts` UNION arm (security_invoker preserved); `get_firm_activity` and `get_firm_touchpoint_counts` recreated verbatim
  - `email_messages.manual_entry` boolean (default false) + `microsoft_message_id` made nullable behind a CHECK constraint
  - `heyreach_messages.manual_entry` boolean (default false) + `heyreach_message_id` and `heyreach_campaign_id` made nullable behind a CHECK constraint
- **Link:** See `DEAL_ACTIVITY_TRACKER_REBUILD_VERIFICATION_2026-04-26.md` for the full reality-reconciliation, per-phase status, and migration details. Branch: `worktree-rebuilt-contact-activity-tracker` (off `audit/migration-drift-2026-04-25`).

---

### 2026-02-26 — CTO Audit & Remediation Session

- **What:** Comprehensive platform audit covering database, AI Command Center, enrichment pipeline, integrations, navigation, code documentation, code organisation, and security
- **Why:** CTO-level audit to identify and fix broken references, missing documentation, security gaps, and code organisation issues
- **Files changed:** Multiple — see AUDIT_REPORT_2026-02-26.md for full list
- **DB changes:** Audit of unified contacts migration, table reference fixes
- **Link:** See PR on branch claude/sourceco-code-audit-yduOu

---

### 2026-02-25 — PR #283: Fix Marketplace Button & Queue Navigation

- **What:** Increased flag size, reordered UI, added Marketplace Queue link to sidebar navigation
- **Why:** Improve marketplace button visibility and add queue access to navigation
- **Files changed:** UI components, sidebar navigation
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/283

---

### 2026-02-24 — PR #281: Adjust Design Colors

- **What:** Toned down intense yellow/gold colours across the design system
- **Why:** Visual improvement — original colours were too intense
- **Files changed:** Design system, colour variables
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/281

---

### 2026-02-23 — PR #280: Marketplace Queue Feature

- **What:** Added marketplace queue feature, fixed Push to Marketplace button in monolithic deal detail file
- **Why:** Enable marketplace queue workflow for deal management
- **Files changed:** Marketplace components, deal detail
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/280

---

### 2026-02-23 — PR #279: Flag Connection Requests

- **What:** Added flagging capability for connection requests
- **Why:** Allow admins to flag and manage connection requests
- **Files changed:** Connection request components
- **DB changes:** None
- **Link:** https://github.com/SourceCoDeals/connect-market-nexus/pull/279

---

### 2026-02-22 — PhoneBurner Manual Token Integration

- **What:** Removed PhoneBurner OAuth flow, switched to manual access tokens, enhanced dialer identifiers
- **Why:** OAuth flow was unreliable; manual tokens provide more stable integration
- **Files changed:** PhoneBurner integration files, OAuth callback, push contacts
- **DB changes:** Schema changes for manual token support
- **Link:** Multiple commits on main branch

---
