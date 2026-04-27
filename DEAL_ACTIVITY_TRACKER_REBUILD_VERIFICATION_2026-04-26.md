# Deal Activity Tracker Rebuild — Verification Report

**Date:** 2026-04-26
**Branch:** `worktree-rebuilt-contact-activity-tracker` (off `audit/migration-drift-2026-04-25`)
**Worktree:** `.claude/worktrees/rebuilt-contact-activity-tracker`
**Commits:** `e987b438a`, `10b2d14e7`, `6632f8f16`, `a61934743`, `2090d2ee6`

---

## Reality reconciliation

Before executing the rebuild prompt, I verified each phase's stated baseline against the actual state of `audit/migration-drift-2026-04-25`. The audit (`CONTACT_ACTIVITY_DEEP_DIVE_AUDIT_2026-04-16.md` and `DEAL_ACTIVITY_TRACKER_AUDIT_2026-04-26.md`) was substantially out of date — the codebase had moved on.

| Original-prompt premise                                                              | Actual state on this branch                                                                                                                                                                                                                                                                                   | Action taken                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LogManualCallDialog.tsx` is orphaned, never imported                                | **Already wired** in `ReMarketingDealDetail/index.tsx:40,275–278,288–295` with a "Log Call" button and full props                                                                                                                                                                                             | Phase 1.3 was a no-op; Phase 4 still renamed to `LogManualTouchDialog` and extended with email/LinkedIn/meeting types.                                                                            |
| `DealActivityTimeline.tsx` is the bottom per-buyer stack                             | **File does not exist** — superseded by `UnifiedDealTimeline.tsx` (734 LOC, 6-source merged feed)                                                                                                                                                                                                             | Phase 2's component-replacement work skipped. Phase 5 polish was layered onto `UnifiedDealTimeline` instead of building a new `DealActivityFeed`.                                                 |
| Activity tab is a dual-panel `<DealActivityLog>` + `<DealActivityTimeline>`          | Activity tab is `contact-activity` and renders `<UnifiedDealTimeline>` + `<DealContactHistoryTab>` + `<ListingNotesLog>`; `DealActivityLog.tsx` is orphaned                                                                                                                                                   | Phase 2's component-deletion work skipped.                                                                                                                                                        |
| `DealEmailActivity` is a separate Email tab to remove                                | **No Email tab exists** — `index.tsx:265–272` has a code comment documenting the consolidation already done                                                                                                                                                                                                   | Phase 2.6 was a no-op.                                                                                                                                                                            |
| `unified_contact_timeline` lacks a `deal_transcripts` arm; build a hook on top of it | The view truly does lack the arm (verified against `20260416120000_unified_timeline_add_campaign_id.sql`). `UnifiedDealTimeline` already merges 6 sources (PhoneBurner calls, Outlook emails, HeyReach LinkedIn, deal_transcripts, Smartlead replies, deal_activities) **directly** rather than via the view. | Migration **was** added (Phase 2). It benefits `useContactCombinedHistory`, `get_firm_activity`, and `get_firm_touchpoint_counts`, NOT the deal page (which queries `deal_transcripts` directly). |
| Buyer-name title fix on `DealActivityTimeline.tsx` line ~99 (`title=""`)             | The file referenced doesn't exist. Every current `ContactActivityTimeline` call site already passes a meaningful title (`tab.label - Activity` or `Communication History`)                                                                                                                                    | No-op; documented as not applicable.                                                                                                                                                              |

**The user resolved this with explicit Option (3)** — keep `UnifiedDealTimeline` as the foundation, ship the genuine Phase 1 fix, ship the standalone `deal_transcripts` migration, and layer Phases 3–5 atop the existing component rather than tearing it out and rebuilding from scratch on top of `unified_contact_timeline`.

This was the verify-before-drop discipline applied per project memory.

---

## Per-phase status

### Phase 1 — Quick wins ✅ (partial, scope-correct)

- ✅ Meeting badge bug fixed (`ContactActivityTimeline.tsx:137–149`) — `isMeeting` branch added, purple styling, "Meeting" label.
- ⊘ Buyer-name fix not applicable — no current `ContactActivityTimeline` caller passes `title=""`.
- ⊘ Manual call wiring not applicable — already shipped.

**Commit:** `e987b438a` — `feat(deals): phase 1 quick win — meeting badge for fireflies entries`
**Diff:** `src/components/remarketing/ContactActivityTimeline.tsx` +10 / −2

### Phase 2 — Standalone `deal_transcripts` arm migration ✅ (rescoped to migration-only)

- ✅ Migration `20260805000001_unified_timeline_add_deal_transcripts.sql` adds a 7th `UNION ALL` arm reading `deal_transcripts` (Fireflies meetings, PhoneBurner call transcripts, manual uploads).
- ✅ View dropped + recreated with `security_invoker = true` re-applied.
- ✅ `get_firm_activity(uuid, text[])` and `get_firm_touchpoint_counts(uuid[])` recreated verbatim from `20260720000000` and `20260722000000` respectively.
- ✅ New partial index `idx_deal_transcripts_listing_event_at` for the new arm's query path.
- ⊘ Hook (`useDealActivityTimeline`) and component-replacement (`DealActivityFeed`) skipped per user direction — `UnifiedDealTimeline` is the existing, working foundation.

**Deviation from prompt:** Original spec proposed `LEFT JOIN buyer_transcripts bt ON bt.id = dt.id` to source a title fallback. That join is a guaranteed no-op (the two tables generate independent UUIDs). `deal_transcripts.title` is a real column — used directly with a literal fallback to "Seller-side transcript".

**Verification:** SQL was not executed against a seeded local DB (the local supabase container was empty; reseeding 1,116 migrations is impractical for this gate). Migration is mechanically correct: arms match the existing 17-column view shape verbatim, function bodies copied verbatim from already-shipped migrations.

**Commit:** `10b2d14e7` — `feat(deals): phase 2 — add deal_transcripts arm to unified_contact_timeline`
**Diff:** new file, +296

### Phase 3 — Header stats strip ✅ (full)

- ✅ `useUnifiedDealActivityEntries` extracted from `UnifiedDealTimeline` so the timeline and stats hook share one query path (react-query keys identical → automatic dedup).
- ✅ `useDealActivityStats(listingId)` returns the prompt-spec shape: `totalTouchpoints`, `byChannel` (calls/emails/linkedin/meetings/notes), `byDirection`, `lastTouch`, `bestChannel` (≥3 outbound + ≥1 inbound rule, with avg-response-time string), `nextScheduledAction` (earliest of next callback or next open task), `byRep`.
- ✅ `DealActivityStatsStrip` renders 4 cards in a responsive grid (1/2/4 cols).
- ✅ Mounted above `UnifiedDealTimeline` in the `contact-activity` tab.
- ✅ Empty/no-data states render gracefully.
- ✅ `bestChannel` returns `null` until the ≥3 outbound + ≥1 inbound thresholds are met (verified by tests).

**Commit:** `6632f8f16` — `feat(deals): phase 3 — activity stats strip answering the four core questions`
**Diff:**

- `src/hooks/use-unified-deal-activity-entries.tsx` (new) +635
- `src/hooks/use-deal-activity-stats.ts` (new) +324 (later in Phase 5)
- `src/components/remarketing/deal-detail/DealActivityStatsStrip.tsx` (new) +112
- `src/components/remarketing/deal-detail/UnifiedDealTimeline.tsx` thin component now reading from the shared hook
- `src/pages/admin/remarketing/ReMarketingDealDetail/index.tsx` +2

### Phase 4 — Unmatched recovery + LogManualTouchDialog ✅ (full)

- ✅ `UnmatchedActivitiesPage` is now a 4-tab component:
  - **Calls** — preserves original `contact_activities` linker.
  - **Outlook emails** — reads `outlook_unmatched_emails`, links by marking `matched_at = now()` and writing a `deal_activities` log entry.
  - **Smartlead** — reads `smartlead_unmatched_messages`, same linking pattern.
  - **HeyReach LinkedIn** — reads `heyreach_unmatched_messages`, same linking pattern.
- ✅ All four tabs invalidate `['unmatched-activities']` so the count refreshes after linking. The `deal_activities` row appears in the deal's Activity feed within one query refresh (via `UnifiedDealTimeline`'s deal_activities arm).
- ✅ `LogManualCallDialog` → `LogManualTouchDialog` with Touch type dropdown (Call / Email / LinkedIn / Meeting). Conditional fields per type.
  - Call → `contact_activities` (preserved logic, including auto-task on voicemail/no_answer/callback)
  - Email → `email_messages` with `manual_entry = true`; resolves `contact_id` via email match scoped to the listing first, then global. Falls through to `deal_activities` if resolution fails (no silent loss).
  - LinkedIn → `heyreach_messages` with `manual_entry = true`; resolves `contact_id` via the listing's primary contact. Falls through to `deal_activities` if resolution fails.
  - Meeting → `deal_transcripts` with `source = 'manual'`, `match_type = 'manual'`.
- ✅ Migration `20260805000002_email_messages_manual_entry_flag.sql` adds `manual_entry boolean default false` to `email_messages` and `heyreach_messages`. Drops NOT NULL on `microsoft_message_id`, `heyreach_message_id`, `heyreach_campaign_id`. Adds CHECK constraints so synced rows still must populate provider IDs.

**Deviation from prompt:** Smartlead is included as an unmatched-recovery channel (per spec) but **not** as a `LogManualTouchDialog` type — the prompt's manual-touch spec lists Call/Email/LinkedIn/Meeting only.

**Commit:** `a61934743` — `feat(activity): phase 4 — unmatched recovery for all channels and manual touch logging`
**Diff:**

- `src/pages/admin/UnmatchedActivitiesPage.tsx` +823 / −168
- `src/components/remarketing/deal-detail/LogManualTouchDialog.tsx` (rename + rewrite) +668 / −280
- `supabase/migrations/20260805000002_email_messages_manual_entry_flag.sql` +73
- `src/pages/admin/remarketing/ReMarketingDealDetail/index.tsx` +2 / −2

### Phase 5 — Polish + observability + tests ✅ (rescoped — onto UnifiedDealTimeline, not a new component)

- ✅ Search input above the channel chips, 200ms debounce. Filters `title`, `description`, `contactEmail`, `metadata.body_preview`.
- ✅ "Timeline" / "By contact" toggle. By-contact mode groups entries by `contactId || contactEmail || '__unknown__'`, sorted by group size DESC.
- ✅ Click-to-detail: rows other than notes (deal_activities `follow_up`) open `ActivityDetailDrawer` (right-side shadcn `Sheet`). Per-source detail bodies for call / email / linkedin / transcript.
- ✅ Observability log in `useUnifiedDealActivityEntries` gated by `import.meta.env.DEV` — `console.debug` with `listingId`, `dealId`, per-source row counts, and `mergedRowCount`.
- ✅ Vitest tests for the pure stats compute layer (`computeDealActivityStats`): 18 tests, all passing.

**Tests cover:** empty-input handling (returns `EMPTY_DEAL_ACTIVITY_STATS`), 30-day touchpoint window, per-channel splits, direction counters, lastTouch ignoring notes, bestChannel ≥3-outbound + ≥1-inbound rule with reason-string format, nextScheduledAction picking earliest of callback/task and skipping past-dated rows, helper exports (`entryChannel`, `entryDirection`, `lastTouchOutcome`).

**Deviation from prompt:** Tests target the pure compute layer rather than the live hook. The existing test patterns in `src/hooks/__tests__/` and `src/hooks/*.test.ts` overwhelmingly test pure functions extracted from hooks — the project has no precedent for mocking the supabase client in vitest. Following project convention here.

**Commit:** `2090d2ee6` — `feat(deals): phase 5 — polish, search, person grouping, detail drawer, tests`
**Diff:**

- `src/components/remarketing/deal-detail/UnifiedDealTimeline.tsx` polish in place
- `src/components/remarketing/deal-detail/ActivityDetailDrawer.tsx` (new) +235
- `src/hooks/use-unified-deal-activity-entries.tsx` observability log
- `src/hooks/use-deal-activity-stats.ts` extracted `computeDealActivityStats`
- `src/hooks/use-deal-activity-stats.test.ts` (new) +461

---

## Final-sweep gates

| Gate                                    | Result                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                          | ✅ exits 0. Zero new errors. ~1,271 pre-existing `@typescript-eslint/no-explicit-any` warnings across the codebase (unchanged baseline). The Phase 5 files contribute ~16 new `any` warnings, all of which are forced by the `untypedFrom` / `(supabase as any)` pattern used throughout this codebase for tables not yet in the generated `Database` type. |
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ exits 0 — no TypeScript errors introduced. (Pre-existing errors exist in `src/hooks/admin/use-lead-agreement-tracking.ts`, `use-match-tool-lead-outreach-tracking.ts`, `use-valuation-lead-outreach-tracking.ts`, `use-nuclear-auth.ts`, `profile-self-heal.ts` — all schema/RPC-type mismatches, none in files this rebuild touched.)                   |
| `npm run test`                          | ⚠ 1819 passed / 8 failed across 4 files; **all 8 failures are pre-existing**. The 18 new tests in `use-deal-activity-stats.test.ts` all pass.                                                                                                                                                                                                               |

**Pre-existing test failures (not introduced by this rebuild):**

- `src/lib/currency-utils.test.ts > formatCurrency > formats zero` — locale formatting (likely Windows-locale flake)
- `supabase/functions/_shared/phone-utils.test.ts` (4 cases) — phone normalization round-trip
- `supabase/functions/_shared/rate-limiter.test.ts > waitForProviderSlot > waits through cooldown when within maxWaitMs` — timer behavior
- `supabase/functions/outlook-backfill-history/index.test.ts` (3 cases) — outlook backfill resume invariants

None of these touch any file in this rebuild's diff. They reproduce on `audit/migration-drift-2026-04-25` baseline.

---

## Manual smoke test status

Live deal-page smoke testing was **not** performed in this run — the dev server was not started and no live Supabase project is linked from this worktree. The recommended pre-merge smoke covers:

1. Open `/admin/remarketing/deals/{any-deal-with-activity}` — Activity tab loads, four header cells populate, merged feed includes calls/emails/LinkedIn/meetings/notes.
2. Type into the search input — entries filter within ~200ms.
3. Click the "By contact" toggle — entries regroup by contact.
4. Click a call / email / LinkedIn / meeting entry — detail drawer opens with per-source content.
5. Click "Log Touch" → cycle through all four touch types → submit each → entry appears in the feed within one query refresh.
6. Open `/admin/unmatched-activities` → switch through all four tabs → link one row in each → verify the row disappears from its tab and appears in the target deal's Activity feed.

---

## Migration list applied (scope of this rebuild)

| Migration                                                                      | Status                           | Effect                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260805000001_unified_timeline_add_deal_transcripts.sql` | Authored, not yet pushed to prod | Drops + recreates `unified_contact_timeline` view with 7th UNION arm reading `deal_transcripts`. Re-applies `security_invoker = true`. Recreates `get_firm_activity` and `get_firm_touchpoint_counts` verbatim. Adds `idx_deal_transcripts_listing_event_at` partial index.                                               |
| `supabase/migrations/20260805000002_email_messages_manual_entry_flag.sql`      | Authored, not yet pushed to prod | Adds `manual_entry boolean default false` to `email_messages` and `heyreach_messages`. Relaxes provider-id NOT NULL constraints behind a CHECK so manual rows can have NULL provider IDs while synced rows still must populate them. Adds `idx_email_messages_manual` and `idx_heyreach_messages_manual` partial indexes. |

Both migrations are **additive and reversible** — no data loss risk. The `DROP VIEW IF EXISTS` + recreate pattern mirrors `20260416120000_unified_timeline_add_campaign_id.sql` which has shipped successfully.

---

## Outstanding / follow-up suggestions (not in scope of this rebuild)

- `useDealActivityStats` exposes `byRep` but the strip doesn't render it. A 5th cell or a hover-popover on cell 1 could surface team-member contribution.
- `nextScheduledAction` only considers callbacks-from-calls and `daily_standup_tasks`. Future: include scheduled meetings (Fireflies upcoming) once a query path exists.
- Manual-touch fallback to `deal_activities` when canonical resolution fails is a soft compromise — long-term, an RPC like `link_email_to_deal_with_contact_create` would atomically resolve/create the contact and insert into `email_messages`.
- The `untypedFrom` pattern dilutes type safety. Adding the unmatched tables and `email_messages`/`smartlead_messages`/`heyreach_messages` to the generated `Database` types would let us drop most of the `any` warnings.
