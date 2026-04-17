# Client Portal — CTO Audit EXECUTION Report

**Date:** 2026-04-16
**Companion doc:** `CLIENT_PORTAL_CTO_AUDIT_2026-04-16.md` (scenarios & P0/P1/P2 backlog)
**This doc:** What happened when we actually _ran_ the audit — verified findings, DB probes, file:line citations, severity tags.
**Verification:** Dev server confirmed running at `http://localhost:8080`. All 40 scoring tests pass. TypeScript clean.

---

## Executive summary

- **P0 scoring bug**: fixed earlier today (prose-keyword false positives). Alpine DB now shows **0 prob-mismatched pending recs** (was 11).
- **No duplicate pushes or duplicate thesis criteria** in DB today. Both are schema-level gaps waiting to bite — no data damage yet.
- **No orphaned pending recs pointing at deactivated criteria** today. Fragile — could appear the moment anyone deactivates a criterion.
- **3 Supabase security advisors** on portal tables, **1 ERROR** (SECURITY DEFINER view).
- **29 unused indexes** on portal\_\* tables — significant index bloat.
- **9 verified code/schema gaps** worth fixing this week; 11 more worth fixing this month.

---

## 1 — DB-wide probes (systemic impact verification)

| Check                                          | SQL                                                                                                                                                                           | Result                     | Interpretation                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| Scoring false positives remaining (any portal) | `SELECT po.name, COUNT(*) FILTER (WHERE l.industry ILIKE '%auto%' OR '%collision%' OR '%tire%' OR '%restoration%' OR '%tow%') FROM portal_deal_recommendations JOIN listings` | Alpine: **0/9** mismatched | Earlier cleanup successful                                       |
| Duplicate pushes                               | `GROUP BY (portal_org_id, listing_id) HAVING COUNT>1`                                                                                                                         | **0**                      | Schema allows it, but nobody's pushed twice yet                  |
| Duplicate thesis criteria per portal           | `GROUP BY (portal_org_id, industry_label) HAVING COUNT>1`                                                                                                                     | **0**                      | Schema allows it; extraction dedup would bite on re-run          |
| Pending recs pointing at deactivated criteria  | `WHERE tc.is_active=false AND r.status='pending'`                                                                                                                             | **0**                      | Nobody has deactivated one yet — will bite on first deactivation |

---

## 2 — Supabase advisors (security) — portal scope only

| Level     | Lint                           | Object                                                                          | Impact                                                             |
| --------- | ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **ERROR** | `security_definer_view`        | `public.portal_pass_reason_summary`                                             | View runs with creator privileges, bypasses caller RLS. P0 to fix. |
| WARN      | `function_search_path_mutable` | `public.portal_responses_for_user`                                              | Role-mutable search_path — privilege-escalation class risk         |
| WARN      | `rls_policy_always_true`       | `portal_recommendation_queue` — `Service role full access on portal reco queue` | Policy is `ALL` with permissive check; review scope                |

## 3 — Supabase advisors (performance) — portal scope (57 findings)

- **29 unused indexes** on portal*\* tables (examples: `idx_portal_notifs*_`all 5,`idx*portal_activity*_`all 4,`idx_pdr_org_status`, `idx_pdr_score`, `idx_portal_reco_thesis`, `idx_ptc_portfolio`). Drop them — write amplification for zero read benefit.
- **17 `auth_rls_initplan` warnings** — RLS policies calling `auth.uid()` inline instead of `(SELECT auth.uid())`. Classic Postgres query-planner gotcha; rewrite as subselects.
- **11 `multiple_permissive_policies`** — overlapping permissive policies on several portal\_\* tables. Consolidate to one.

**Net:** one P0 security fix, one P1 RLS cleanup, one perf pass.

---

## 4 — Verified gaps (by use case, with severity)

### Thesis & extraction (from Explore agent A)

| UC  | Gap                                                                                    | Severity | File:Line                                                    | Fix                                                         |
| --- | -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| 3   | No dedup on `(portal_org_id, industry_label)` when saving extracted theses             | **P1**   | `src/hooks/portal/use-extract-portal-thesis.ts:88`           | Add UNIQUE constraint; upsert on conflict                   |
| 3   | Extraction doesn't pass existing theses as context → re-extraction produces duplicates | P2       | `supabase/functions/extract-portal-thesis/index.ts:275-280`  | Fetch active criteria, inject into prompt                   |
| 3   | No cost/latency cap on Gemini calls                                                    | P2       | `extract-portal-thesis/index.ts:25` (only 20MB soft)         | Add per-admin-per-day cap                                   |
| 12  | Deactivating a criterion leaves pending recs orphaned                                  | **P0**   | `process-portal-recommendations/index.ts` / `scoring.ts:319` | DB trigger: `is_active→false` ⇒ pending recs become `stale` |
| 13  | Editing keywords doesn't re-score existing pending recs                                | P1       | `src/hooks/portal/use-portal-thesis.ts:47-71`                | On save, enqueue all active listings                        |
| 14  | `CloneThesis` copies `portfolio_buyer_id` cross-portal (nonsense link)                 | P1       | `src/hooks/portal/use-portal-thesis.ts:128`                  | Null it on clone across portal orgs                         |
| 16  | Orphan `portfolio_buyer_id` if linked buyer is archived                                | P2       | `ThesisCriteriaForm.tsx:294`                                 | Cascade-null on buyer archive                               |
| 22  | "Why Not?" dialog doesn't expose primary vs secondary haystack per reason              | P2       | `WhyNotDialog.tsx:203`                                       | Add `source` field to reasons array                         |
| 22  | "Why Not?" can't scope to a single criterion                                           | P2       | `WhyNotDialog.tsx`                                           | Add criterion picker                                        |

### Recommendations engine (from Explore agent B)

| UC  | Gap                                                                                                                                                                                                      | Severity | File:Line                                    | Fix                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------- | ------------------------------------------------------------- |
| —   | **`approved` status is never written** — dead code path. Nothing in the UI or hooks sets `status='approved'`; clicking "Approve & Push" goes straight to `pushed`. "Approved" filter shows empty forever | **P1**   | `PortalRecommendationsTab.tsx:79-80`         | Either remove the enum + tab OR implement a real approve step |
| —   | No `stale` option in status filter dropdown; stale recs invisible in UI                                                                                                                                  | P1       | `PortalRecommendationsTab.tsx` SelectContent | Add `<SelectItem value="stale">`                              |
| 10  | Pause doesn't stale pending recs → admin gets a mountain on resume                                                                                                                                       | P1       | Cron filter only; no cascade                 | DB trigger on portal.status→paused ⇒ stale pendings           |
| 25  | No "Reprocess recommendations for this portal now" admin action                                                                                                                                          | P1       | None exists                                  | New RPC + button: enqueue all active listings for portal      |
| 25  | No visibility into cron runs, failures, or queue depth                                                                                                                                                   | P2       | `process-portal-recommendations/index.ts`    | Log runs to `portal_cron_runs` audit table + admin dashboard  |

### Push / response / chat (from Explore agent C)

| UC  | Gap                                                                                                                                                          | Severity        | File:Line                                         | Fix                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| 18  | **Admin-side memo rendered with `dangerouslySetInnerHTML` and NO DOMPurify.** The buyer-side (`CompanyDetailsModal.tsx`) DOES sanitize — admin side doesn't. | **P0** (latent) | `ClientPortalDetail.tsx:566-573`                  | Wrap in DOMPurify.sanitize() matching buyer side                             |
| 6   | Bulk-push skips the duplicate check that single-push applies                                                                                                 | P1              | `PushToPortalDialog.tsx:130-154` vs `:71-74`      | Apply same dedup check in bulk path                                          |
| 6   | No `deal_snapshot` version column → memo schema drift breaks old pushes silently                                                                             | P1              | `20260617000000_client_portal_tables.sql:82`      | Add `snapshot_version int` + UI fallback                                     |
| 6   | Auto-refresh effect fires on every mount for any push missing memo, no cap                                                                                   | P1              | `ClientPortalDetail.tsx:138-154`                  | Per-session cap + localStorage memoization                                   |
| 7   | No undo on convert-to-pipeline; no back-link to the created pipeline deal                                                                                    | P2              | `use-portal-deals.ts:763-772`                     | Add `pipeline_deal_id` column; undo action                                   |
| 8   | No realtime, no unread badge, no attachments on `PortalDealChat`                                                                                             | P2              | `PortalDealChat.tsx:31-216`                       | Realtime subscription, unread count, attachment upload                       |
| 19  | **Buyer sends chat message → admin gets zero notification** (no email, no badge)                                                                             | **P1**          | `src/hooks/portal/use-portal-messages.ts:144-166` | Trigger `send-portal-notification` on insert where sender_type='portal_user' |
| 9   | Pass reasons have no feedback loop into scoring — same-industry deals keep appearing after declines                                                          | P1              | `PassReasonPanel.tsx` + scoring                   | Auto-stale future recs matching a dominant pass-category                     |
| 24  | No `deactivated_at` on `portal_users`; historical responses from deactivated users unmarked                                                                  | P2              | `20260617000000:45-59`                            | Add column, set on deactivate, show subtle badge in responses                |

### Portal management (from Explore agent D)

| UC  | Gap                                                                                                      | Severity | File:Line                                                          | Fix                                                              |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 2   | **Bulk invite missing entirely.** Single-email-per-invite, no CSV, no multi-paste                        | **P1**   | `InvitePortalUserDialog.tsx:43` + `invite-portal-user/index.ts:40` | Accept array of emails; batch-insert with transactional rollback |
| 2   | No rate-limit on invite edge function                                                                    | P2       | `invite-portal-user/index.ts`                                      | Add per-admin-per-hour cap                                       |
| 17  | Expired magic link → buyer stuck (no auto-redirect to re-request flow)                                   | P1       | `src/pages/ResetPassword.tsx:47-54`                                | Detect expired token, offer one-click re-send                    |
| 20  | Analytics are org-level only; no per-user drill-down                                                     | P2       | `use-portal-activity.ts:23-74`                                     | Add per-user breakdown (who logs in, who reviews)                |
| 21  | **No unsubscribe link in reminder emails** (compliance risk even for B2B)                                | **P1**   | `portal-auto-reminder/index.ts:129`                                | Add unsubscribe token + honoring endpoint                        |
| 21  | No per-deal snooze; `max` is org-level only                                                              | P2       | schema lacks column                                                | Add `snoozed_until` on `portal_deal_pushes`                      |
| 21  | **`portal-auto-reminder` has no cron schedule defined in any migration** — runs only if manually invoked | **P0**   | none                                                               | Add `cron.schedule('portal-auto-reminder', '0 14 * * *', …)`     |
| 23  | New portal doesn't seed intelligence docs / Fireflies transcripts from linked buyer                      | P2       | `CreatePortalDialog` + create hook                                 | Copy buyer attachments + transcripts on create                   |

### Schema / infra / RLS (from Explore agent E + advisors)

| Gap                                                                                             | Severity        | Location                               | Fix                                                                |
| ----------------------------------------------------------------------------------------------- | --------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `portal_pass_reason_summary` is SECURITY DEFINER view (bypasses caller RLS)                     | **P0**          | advisor `security_definer_view`        | Recreate as SECURITY INVOKER or as a function with explicit checks |
| `portal_responses_for_user` function has mutable search_path                                    | P1              | advisor `function_search_path_mutable` | Pin `SET search_path = public, pg_temp`                            |
| `Service role full access on portal reco queue` RLS policy is `ALL + true`                      | P1              | advisor                                | Scope to service_role check `auth.role() = 'service_role'`         |
| 29 unused portal indexes                                                                        | P2 (perf, cost) | advisor                                | Drop unused; keep a baseline set                                   |
| 17 RLS auth*rls_initplan on portal*\*                                                           | P2              | advisor                                | Rewrite `auth.uid()` → `(SELECT auth.uid())`                       |
| 11 multiple_permissive_policies                                                                 | P2              | advisor                                | Consolidate duplicate policies                                     |
| All 5 portal edge functions import from `esm.sh@2` unpinned                                     | P2              | functions/portal-\*/index.ts           | Pin to `@supabase/supabase-js@2.x.y`                               |
| None of the portal edge functions emit structured JSON logs                                     | P2              | all five                               | Replace `console.error(string)` with JSON payloads                 |
| No `UNIQUE(portal_org_id, industry_label)` on `portal_thesis_criteria`                          | P1              | schema                                 | Add unique partial index                                           |
| No `UNIQUE(portal_org_id, listing_id) WHERE status NOT IN ('archived')` on `portal_deal_pushes` | P1              | schema                                 | Add unique partial index                                           |
| No compound `(portal_org_id, match_score DESC)` on `portal_deal_recommendations`                | P2              | schema                                 | Add covering index for the main list query                         |

---

## 5 — Top-15 fix priority (this week)

1. **DOMPurify the admin memo renderer** (`ClientPortalDetail.tsx:566-573`). Mirror what buyer side already does.
2. **Stale pending recs when `portal_thesis_criteria.is_active → false`** (DB trigger).
3. **Stale pending recs when `portal_organizations.status → paused/archived`** (DB trigger).
4. **Fix SECURITY DEFINER view** `portal_pass_reason_summary`.
5. **Schedule the `portal-auto-reminder` cron** — it's never running.
6. **Email admin on new buyer chat message** — trigger `send-portal-notification` from message insert.
7. **Add `stale` to the Recommendations status filter.**
8. **Either remove `approved` status or make "Approve" actually write it** — currently dead code.
9. **Add UNIQUE partial indexes** on `(portal_org_id, industry_label)` and `(portal_org_id, listing_id WHERE not archived)`.
10. **Dedup in bulk push** path.
11. **Fix expired magic link path** — auto-redirect to re-request.
12. **Add unsubscribe link** to auto-reminder emails.
13. **Cap auto-refresh** in `ClientPortalDetail.tsx:138-154` — session-memoized.
14. **"Reprocess recommendations now"** admin button per portal.
15. **Pass-reason feedback loop** — auto-stale future recs matching a dominant rejection category.

All 15 are <1 day engineering effort; several (1, 3, 7, 9, 12) are <1 hour.

---

## 6 — Delta from the original audit document

Items added this run that weren't in the companion audit doc:

- **Dead `approved` status** — not called out before; confirmed dead code path.
- **`portal-auto-reminder` has no cron** — implied as "works" in UC-21; verified it has no schedule.
- **SECURITY DEFINER view + mutable search_path function** — security advisor findings.
- **29 unused indexes** — not an audit finding, but a real perf cost.
- **Systemic dupe scan** — verified 0 cases exist today (good news, but schema still permits).
- **Bulk-push bypass of dedup check** — original doc noted "no dedup on push" but didn't call out bulk vs single mismatch.
- **Message notification path literally absent** — original doc called it a gap, this run confirmed no code path at all (not even disabled).

Items the agents flagged but need human judgment before fix:

- Clone-across-portal `portfolio_buyer_id` behavior — may be intended when the linked portco is a shared-industry reference.
- Aggressive auto-refresh — may be serving a real need if memos legitimately disappear.
- Unused indexes — some may be created for future queries; confirm with the engineer who wrote the migrations.

---

## 7 — Not verified (would need live walkthrough)

Without clicking through the UI as a real user, these need a manual pass:

- Extraction dialog scroll fix (Chromium-specific; dev server running at :8080 ready for check).
- Thesis card click-to-edit (same).
- Alpine recommendations now showing clean pending list.
- Buyer-side portal first-login flow (magic link → dashboard).
- Push → buyer email → buyer open/click → response flow end-to-end.

**Recommended smoke test (5 min total):**

1. Open `http://localhost:8080/admin/client-portals/alpine-investors` → Thesis tab → click HVAC card → edit form opens.
2. Same page → Recommendations tab → filter Pending → confirm auto body / collision shops are gone.
3. Same page → Intelligence tab → upload any PDF → "Extract Thesis" → verify the candidate list scrolls when it has 5+ rows.

---

## 8 — Files produced today

- `CLIENT_PORTAL_CTO_AUDIT_2026-04-16.md` (25 scenarios + backlog)
- `CLIENT_PORTAL_CTO_AUDIT_EXECUTION_2026-04-16.md` (this doc — verified findings)
- `supabase/functions/process-portal-recommendations/scoring.ts` (scoring fix)
- `supabase/functions/process-portal-recommendations/scoring.test.ts` (regression tests, 40/40 pass)
- `src/components/portal/ThesisCriteriaCard.tsx` (click-to-edit)
- `src/components/portal/ExtractThesisDialog.tsx` (scroll fix)

**DB changes:** 11 Alpine auto/collision pending recs marked `stale`.

---

## 9 — What I'd do tomorrow (if I had another day)

1. Write the DB migration bundling: UNIQUE constraints, cascade-stale triggers, auto-reminder cron, fix SECURITY DEFINER view, consolidate RLS, drop unused indexes.
2. Ship DOMPurify + memo sanitization.
3. Add the "Reprocess recommendations" admin action.
4. Wire buyer-message → admin-email notification.
5. Replace the dead `approved` status with a real batch-approval workflow OR delete the enum + UI.

Each of these lands in <4 hours. Combined they close all current P0/P1 items.
