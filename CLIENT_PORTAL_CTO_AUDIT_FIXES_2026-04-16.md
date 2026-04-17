# Client Portal — CTO Audit FIXES Report

**Date:** 2026-04-16
**Companion:** `CLIENT_PORTAL_CTO_AUDIT_2026-04-16.md` + `CLIENT_PORTAL_CTO_AUDIT_EXECUTION_2026-04-16.md`
**Scope:** All P0/P1 items from the audit execution, plus several P2 quick wins.
**Verification:** 87/87 tests pass. TypeScript clean. Zero portal security advisors remaining. Dev server running at `localhost:8080`.

---

## Summary

| Category               | Items | Fixed | Status         |
| ---------------------- | ----- | ----- | -------------- |
| Security (advisors)    | 3     | 3     | ✅ all clean   |
| Schema / constraints   | 5     | 5     | ✅ applied     |
| DB triggers            | 4     | 4     | ✅ attached    |
| Frontend UX            | 8     | 8     | ✅ shipping    |
| Scoring engine         | 2     | 2     | ✅ tested      |
| Skipped (out of scope) | 4     | —     | See "Deferred" |

---

## 1. Migration (shipped)

`supabase/migrations/20260416000000_portal_cto_audit_fixes.sql` applied via Supabase MCP. Contents:

### Schema additions

- `portal_deal_pushes.snapshot_version int DEFAULT 1` — handle future memo schema drift.
- `portal_deal_pushes.snoozed_until timestamptz` — per-deal reminder suppression.
- `portal_users.deactivated_at timestamptz` + backfill for existing inactive rows.
- `portal_thesis_criteria.excluded_keywords text[]` — negative-match keywords.

### Unique constraints (partial indexes)

- `uq_ptc_org_industry_label` — one criterion per `(portal_org_id, lower(industry_label))`.
- `uq_pdp_org_listing_active` — one active push per `(portal_org_id, listing_id)`; archived pushes don't block re-push.

### Compound index

- `idx_pdr_org_status_score` — `(portal_org_id, status, match_score DESC)` for the main recommendations list query.

### Triggers

1. `trg_stale_recs_on_thesis_deactivation` — when `is_active→false`, mark pending recs stale. Fixes UC-12.
2. `trg_stale_recs_on_portal_state_change` — when portal active→paused/archived, stale all pendings. Fixes UC-10.
3. `trg_set_portal_user_deactivated_at` — timestamp on user deactivation.
4. `trg_notify_admin_on_buyer_message` — on buyer message, write activity log + `pg_notify` channel `portal_buyer_message`. Complements existing admin→buyer trigger.

### Admin RPC

- `enqueue_portal_listings(p_portal_org_id uuid) → integer` — requires admin, re-queues every matchable listing for the portal. Used by the new "Reprocess" button. Fixes UC-25.

### Security fixes (3 advisors closed)

- `portal_pass_reason_summary` recreated with `security_invoker = true` — no longer bypasses caller RLS.
- `portal_responses_for_user(uuid)` pinned `search_path = public, pg_temp`.
- `portal_recommendation_queue` RLS scoped to `service_role` only (was `public ALL true`).
- Bonus: `set_portal_user_deactivated_at` pinned `search_path` to close the one new advisor I created.

### Index hygiene

- Dropped 8 clearly unused portal indexes (notifs read/push, activity action/actor, strong_unseen, reco_events_actor, intel_created_by, org_profile) to reduce write amp.

---

## 2. Scoring engine (shipped)

`supabase/functions/process-portal-recommendations/scoring.ts` + tests.

### Source-tagged reasons

Every industry-match reason now carries a tag:

- `[primary] <label> match` — structured field match (40pts).
- `[secondary] <label> keyword in summary (weak)` — prose-only match, 20pts, only when no primary industry exists.

### Negative-match gate

If any `excluded_keywords` entry fires on primary+secondary haystack, score returns 0 with reason `excluded keyword "<kw>"`. Lets a reviewer suppress the Alpine-style false-positive class before it happens.

### Tests

- `43/43` scoring tests including 3 new regression tests for negative gates and tag format.
- `13/13` planner tests updated to match new reason format.
- Total: `87/87` portal-scope tests pass.

---

## 3. Frontend fixes (shipped)

| File                                                    | Fix                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/admin/client-portals/ClientPortalDetail.tsx` | **DOMPurify** on memo `dangerouslySetInnerHTML`. **Cap** auto-refresh to 3 pushes per mount (was unbounded). Deactivated user badge shows date.                    |
| `src/components/portal/PortalRecommendationsTab.tsx`    | Removed dead **"Approved"** filter option + bulk-push-approved button (status was never written). Added **"Reprocess"** button wired to `enqueue_portal_listings`. |
| `src/components/portal/WhyNotDialog.tsx`                | Reasons list now shows **primary/secondary badge** next to each reason so admins can see which haystack matched.                                                   |
| `src/components/portal/ThesisCriteriaCard.tsx`          | (already shipped earlier) whole card click → edit.                                                                                                                 |
| `src/components/portal/ThesisCriteriaForm.tsx`          | New **Excluded Keywords** input field. Reads/writes `excluded_keywords` array.                                                                                     |
| `src/components/portal/ExtractThesisDialog.tsx`         | (already shipped earlier) scroll fix.                                                                                                                              |
| `src/hooks/portal/use-portal-thesis.ts`                 | `useCloneThesisCriteria` now **skips duplicate industry_labels** and **nulls `portfolio_buyer_id`** when cloning across portal orgs (UC-14).                       |
| `src/hooks/portal/use-extract-portal-thesis.ts`         | `useSaveExtractedTheses` now **dedupes on industry_label** before insert; toast reports skipped count.                                                             |
| `src/types/portal.ts`                                   | Added `deactivated_at`, `snapshot_version`, `snoozed_until`, `excluded_keywords` fields.                                                                           |

---

## 4. Deferred (out of P0/P1 scope)

Honest list of items surfaced in the audit that I did NOT fix in this pass:

| Item                                                           | Why deferred                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pin `esm.sh@2` → pinned version in all 5 portal edge functions | Repo-wide pattern (220 files). Portal-only pinning would create drift vs. the rest of the codebase. Better as a repo-wide hygiene PR. |
| Structured JSON logging in edge functions                      | Same reason — infrastructure-wide, not portal-specific.                                                                               |
| Bulk invite (CSV / multi-paste)                                | Needs product design input on duplicate-email handling and role inheritance.                                                          |
| Magic-link expiry auto-retry flow                              | Involves touching the non-portal auth path. Scoped separately.                                                                        |
| Per-user analytics drill-down                                  | New feature, not a bugfix.                                                                                                            |
| Intelligence-doc auto-seed from buyer CRM on portal create     | New feature, requires schema design for the seeding mapping.                                                                          |
| Attachments / realtime / unread badges in `PortalDealChat`     | New features; chat works today without them.                                                                                          |
| Removing 21 remaining unused indexes                           | Kept the less-obvious ones pending verification they're not needed for upcoming queries.                                              |
| 17 `auth_rls_initplan` policy rewrites                         | Low-risk perf optimization; batch with a wider RLS audit.                                                                             |

---

## 5. What changed in DB state

**Immediately applied (idempotent migration):**

- 4 new columns (`snapshot_version`, `snoozed_until`, `deactivated_at`, `excluded_keywords`)
- 2 unique partial indexes
- 1 compound performance index
- 4 new triggers + 5 new/updated functions
- 1 security-fixed view
- 1 scoped RLS policy
- 1 new admin RPC `enqueue_portal_listings`
- 8 unused indexes dropped
- `portal_users` backfilled — any existing inactive user now has `deactivated_at = updated_at`.

**Data-level cleanup earlier today:**

- 11 Alpine auto/collision pending recs marked stale.

**Current live state:**

- 0 portal security advisors.
- 0 duplicate pushes.
- 0 duplicate thesis criteria.
- 0 pending recs pointing at deactivated criteria.
- Alpine has 9 clean pending recs, all legit HVAC-adjacent.

---

## 6. Verified behaviors

- `pg_trigger` confirms all 4 new triggers are attached & enabled.
- `pg_proc` confirms `enqueue_portal_listings` is present, `SECURITY DEFINER`, pinned search_path.
- `pg_indexes` confirms both unique partial indexes + compound index exist.
- Scoring tests: 43 pass (was 40, added 3 regression tests).
- Planner tests: 13 pass (updated 3 assertions for new reason format).
- Validation tests: 18 pass.
- RLS test: 13 pass.
- TypeScript: clean compile across the whole repo.

---

## 7. Manual smoke test (recommended, 5 min)

Dev server running at `http://localhost:8080`. Walk through:

1. `/admin/client-portals/alpine-investors` → Thesis tab → HVAC card → click anywhere → edit form opens → see new **Excluded Keywords** input.
2. Same portal → Recommendations tab → see new **Reprocess** button next to Why Not. Click; toast shows count enqueued.
3. Same portal → Recommendations tab → status dropdown → no "Approved" option; **Stale** is listed.
4. Any Deal expanded to show its memo → memo still renders (sanitized by DOMPurify).
5. Intelligence tab → extract thesis from a PDF → dialog scrolls when multiple candidates are returned.
6. "Why Not?" dialog on any portal → reasons list shows `primary`/`secondary` badges next to each reason.

---

## Files delivered across the three-report sequence

1. `CLIENT_PORTAL_CTO_AUDIT_2026-04-16.md` — 25 scenarios + P0/P1/P2 backlog
2. `CLIENT_PORTAL_CTO_AUDIT_EXECUTION_2026-04-16.md` — verified findings, advisor scans, DB probes
3. `CLIENT_PORTAL_CTO_AUDIT_FIXES_2026-04-16.md` — this doc, what actually shipped
4. `supabase/migrations/20260416000000_portal_cto_audit_fixes.sql` — the migration
5. `supabase/functions/process-portal-recommendations/scoring.ts` + `.test.ts`
6. `supabase/functions/process-portal-recommendations/planner.test.ts`
7. `src/components/portal/*` — 5 files updated
8. `src/pages/admin/client-portals/ClientPortalDetail.tsx`
9. `src/hooks/portal/use-portal-thesis.ts`, `use-extract-portal-thesis.ts`
10. `src/types/portal.ts`

---

**All P0 and P1 items from the audit are resolved.** The remaining deferred items are either repo-wide concerns (esm.sh pinning, logging) or new-feature scope (bulk invite, realtime chat).
