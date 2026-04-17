# Client Portal — CTO-Level Deep Audit

**Date:** 2026-04-16
**Scope:** Client portal subsystem (admin-side and buyer-side) — thesis extraction, thesis management, recommendation engine, deal push, buyer workflows, data schema, edge functions.
**Context:** Reported pain points — (1) thesis extraction wrong, (2) thesis list not scrollable, (3) thesis cards not click-to-edit, (4) Alpine portal recommending unrelated auto/collision deals against an HVAC thesis.

---

## Part 1 — Root causes identified & fixed today

### 1.1 CRITICAL: Scoring false positives via prose-text keyword match

**Symptom:** Alpine Investors (HVAC-only thesis) had 11 pending recommendations for auto body, collision, towing, and restoration shops — none of them HVAC.

**Root cause:** `scoreListingAgainstCriteria` in `supabase/functions/process-portal-recommendations/scoring.ts` concatenated the structured industry taxonomy (`industry`, `category`, `categories`, `services`) with the long-form prose (`service_mix`, `executive_summary`) into a single haystack, then fired word-boundary regex on each thesis keyword. The "mechanical" keyword in Alpine's HVAC thesis therefore matched:

- `Peters Body & Fender` — "...collision and **mechanical** repair services..."
- `Cape Auto Body Collision Center` — "...routine **mechanical** maintenance..."
- `Airpark Towing LLC` — "towing feeds collision and **mechanical** work"
- …and 8 other auto shops with "mechanical repair" in their summaries.

Because the industry gate is hard (40-point binary), a false match on ANY keyword gated the entire deal into the recommendation queue. Geography/size bonuses then pushed many to score 45-80, well above the 30-point cutoff.

**Fix applied** (`scoring.ts`):

- Split haystack into **primary** (structured taxonomy) and **secondary** (prose) buckets.
- Primary match = full 40 points + reason `"<label> match"`.
- Secondary match is now only used as fallback when the listing has NO primary industry at all. When secondary fires it scores 20 (flagged `"<label> keyword in summary (weak)"`).
- When a listing has a primary industry that doesn't match the thesis, summary matches are ignored — no more auto body shops scoring on an HVAC thesis.

**Cleanup:** 11 spurious Alpine recommendations marked `stale` directly in DB.

**Regression test added** (`scoring.test.ts`): `"regression (Alpine 2026-04): summary-only \"mechanical\" match is blocked when primary industry contradicts"`.

---

### 1.2 Thesis cards not click-to-edit

**Symptom:** Admins couldn't click a thesis card to open the edit form — only the tiny "Edit" button opened it.

**Fix** (`ThesisCriteriaCard.tsx`): Whole card is now a button (`role="button"`, `tabIndex=0`, Enter/Space keyboard support, hover state, cursor pointer). Edit and Delete buttons `stopPropagation` so they don't double-fire.

---

### 1.3 Thesis extraction dialog couldn't scroll

**Symptom:** When AI extracted multiple thesis candidates from an uploaded doc, the user could only see the first few rows — no scroll.

**Root cause:** Radix `ScrollArea` inside a `flex-col min-h-0` parent inside `DialogContent` was failing to compute its viewport height correctly in some Chromium builds, leaving the inner `Viewport` at intrinsic content height and clipping anything past the visible region.

**Fix** (`ExtractThesisDialog.tsx`): Replaced Radix `ScrollArea` with a plain `<div className="flex-1 min-h-0 overflow-y-auto pr-3">`. More predictable, one element fewer in the layout chain.

---

## Part 2 — 25 end-to-end use cases, with gaps identified

Each scenario walks through the steps a real user would take, what currently works, what breaks, and what needs to change.

### UC-1 — New portal onboarding (prospect → live portal)

**Steps:** Admin opens `/admin/client-portals` → "New Portal" → pastes name, links buyer, sets relationship owner, writes welcome message → creates portal → invites first user.

**Works:** Portal creation, user invite, welcome email (see `invite-portal-user` edge function).

**Gaps:**

- No template / clone on the create dialog — every new portal starts blank. "Clone from portal" works but only after creation.
- No validation that `buyer_id` is actually the portal's buyer (you can currently link a portal to any buyer in the system).
- Welcome email template is hard-coded in the edge function, not editable per portal.

---

### UC-2 — Bulk inviting a buyer's whole partner team to a new portal

**Steps:** After creating portal, add 5-10 users (one at a time via the Invite dialog).

**Works:** Individual invites, status (pending → accepted).

**Gaps:**

- No CSV/paste-multi-emails bulk invite. Admin has to invite users one by one. For a portal with 8 team members this is ~2 minutes of friction.
- No "invite all contacts from this buyer" button that would pull from the buyer's existing CRM contacts.
- No way to set default role (buyer_admin vs viewer) for the batch.

---

### UC-3 — Uploading intelligence docs & extracting thesis (Alpine example)

**Steps:** Go to portal → Intelligence tab → drag in "Alpine thesis memo.pdf" → wait for upload → click "Extract Thesis" → review candidates → check boxes → save.

**Works:** Upload, Gemini extraction (`extract-portal-thesis` edge function), candidate review UI, validation, insert.

**Gaps:**

- **(fixed today)** Candidate review list couldn't scroll.
- Extraction prompt doesn't use the buyer's existing portal notes / prior thesis as context, so re-extraction from a doc update can produce overlapping duplicates (same industry_label twice).
- No deduplication when saving — if a criterion already exists with the same `industry_label`, the save creates a second row.
- No way to preview the source doc alongside the extracted candidates (admin has to open a second browser tab).
- If Gemini returns an odd JSON shape, the error toast is generic ("Extraction failed"); there's no retry and no link to the edge function logs.
- Extraction cost ($0.02) and latency (10-60s) are mentioned in the code comment but not surfaced in the UI — the user doesn't know what's happening during the loading state beyond the spinner.

---

### UC-4 — Building a calling list for prospects to push into a new portal

**Story:** SMB sales wants to call the 20 HVAC businesses in OH/PA/NY/NJ that fit Alpine's $500K-$5M EBITDA range, then pitch the deals.

**Steps:**

1. Filter marketplace listings by industry="HVAC", state in (OH, PA, NY, NJ), EBITDA 500K-5M.
2. Export the list as CSV for the call sheet.
3. As calls succeed and deals progress, push them to Alpine's portal.

**Gaps:**

- **No direct filter-by-thesis UI.** The admin today has to manually translate a thesis into marketplace filters. A "Find matching deals for this thesis" button on the thesis card would save 10+ min per portal.
- No CSV export of marketplace search results.
- The Recommendations tab IS the closest thing to this, but it only surfaces deals the cron has already processed. A fresh recompute is triggered by listing updates, not by an admin click.

**Recommendation:** Add a button on each `ThesisCriteriaCard` — "Find matching deals" — that runs the scoring engine on demand against the entire active marketplace (not just queued listings) and shows top 50 matches. This is the fastest path to a calling list.

---

### UC-5 — Reviewing recommendations and approving a subset for push

**Steps:** Portal → Recommendations tab → filter "pending" → open each card → click "Approve & push" → fills Push dialog → confirms.

**Works:** Listing, approve-push flow, bulk-push-approved.

**Gaps:**

- No way to multi-select and bulk-dismiss (e.g., "dismiss all pending scoring below 50").
- `dismiss_reason` is free text. There's no dropdown of structured reasons (wrong geo, wrong size, off-thesis keyword, out of business), so reporting on why admins reject recommendations is impossible.
- The "Why Not?" debugging dialog is great but hidden; admins don't know to use it unless they've been shown.
- No indication of when the recommendation was generated — if it's 4 weeks old and the listing has been updated twice since, admins should see a "refresh" hint.

---

### UC-6 — Pushing a deal and watching the buyer respond

**Steps:** Admin pushes deal → buyer gets email → buyer logs into portal → views deal → clicks "Connect with Owner" or "Learn More" or "Pass".

**Works:** Push creates a row in `portal_deal_pushes` with a `deal_snapshot` JSON blob, email sent via `send-portal-notification`, buyer response creates a `portal_response` row.

**Gaps:**

- `deal_snapshot` is regenerated on refresh but the schema doesn't version it, so if a memo regeneration changes the structure, old snapshots look broken. Saw this symptom in `ClientPortalDetail.tsx:138-154` which auto-refreshes when it can't find `memo_html` — that auto-refresh fires on _every_ page mount for any push that's missing a memo, potentially hammering the refresh RPC.
- The "latest response" is shown on the admin view but the conversation thread is hidden behind the message icon. Admins need to click each row to see if the buyer has asked a question — easy to miss.
- No typing indicator, read receipts, or "seen" states on messages.
- Pushing the same deal twice to the same portal silently creates duplicates (no dedupe on push).

---

### UC-7 — Converting "Interested" response into a pipeline deal

**Steps:** Deals tab → row with status `interested` → click "Convert" → creates a pipeline opportunity tied to the deal.

**Works:** The `useConvertToPipelineDeal` mutation is wired.

**Gaps:**

- No undo / reverse. Once converted, there's no UI to re-open the push back to `interested` without DB surgery.
- No visibility into the pipeline deal from the portal detail after conversion — admins have to navigate to `/admin/deals/:id` manually.

---

### UC-8 — Admin chat inside a pushed deal

**Steps:** Click the message icon on a push row → opens `PortalDealChat` inline.

**Works:** Basic send/receive.

**Gaps:**

- Inline chat takes column span 10; on smaller screens the deal table scrolls weirdly.
- No attachments, no mentions, no link to the buyer's profile.
- No unread count / notification badge on the message icon.

---

### UC-9 — Buyer clicks "Pass" with a reason, admin reviews pass-reasons panel

**Steps:** Buyer passes deal with reason → `portal_responses.response_type = 'pass'` + `notes` → admin sees it in the PassReasonPanel on the Responses tab.

**Works:** Pass reasons are visible.

**Gaps:**

- No categorization — free text "too small" / "bad geo" / "already looked" / "competitive process" all live in the same field.
- No feedback loop — a pass reason that says "wrong industry" should automatically dismiss future recommendations from that industry for this portal, but today the next cron run will push a similar listing right back.

---

### UC-10 — Pausing / reactivating a portal

**Steps:** Portal → Pause button → status becomes `paused` → the cron `process-portal-recommendations` filters out paused portals.

**Works:** Status filter is on `portal_organizations.status = 'active'` in `index.ts:82-92`.

**Gaps:**

- When paused, existing `pending` recommendations stay in the table forever. On resume the admin sees a mountain of stale matches. Should at minimum flag "generated while paused — review before pushing".
- No "pause notifications but keep matching" half-state.

---

### UC-11 — Archiving a portal

**Steps:** Portal → Archive → status becomes `archived`.

**Works:** UI transitions.

**Gaps:**

- Archive doesn't cascade anywhere. Users can still log in. Recommendations cron filter `active` only, so archived portals don't get new recs — but existing pending recs linger in the table.
- No grace period, no "soft delete undo within 7 days".

---

### UC-12 — Renewing / refreshing thesis after a buyer strategy update

**Steps:** Admin re-uploads updated thesis memo → extracts → adds new criteria → deactivates old ones.

**Gaps:**

- **No criterion versioning.** Deactivating a row leaves stale recommendations referencing `thesis_criteria_id` pointing at an `is_active=false` row. The scoring cron re-scores when listings change, but old recommendations from the deactivated thesis don't auto-reap.
- The existing reap logic in `planRecommendationWrites` only reaps pending rows for listings _in the current batch_. If a thesis is deactivated and no new listing activity queues those listing IDs, the stale recs stay forever.
- **Recommendation:** Add a "deactivating this criterion will stale N pending recommendations — confirm?" dialog, and run a DB update to stale those recommendations directly.

---

### UC-13 — Tweaking a thesis criterion mid-review

**Steps:** Admin clicks card → edits EBITDA range → saves.

**Works (after today's fix):** Click-to-edit now opens the form.

**Gaps:**

- Editing the keywords doesn't trigger a re-score of existing pending recommendations. Admin has to wait for the next listing-update trigger to re-queue matching listings.
- No "dry run" — show which listings would move into/out of match before saving the change.

---

### UC-14 — Cloning a thesis from one portal to another

**Steps:** Click "Clone from Portal" → select source portal → selects which criteria to import → saves.

**Works:** `CloneThesisDialog` is implemented.

**Gaps:**

- Cloning copies the `portfolio_buyer_id` — if Alpine has "HVAC with portfolio_buyer=AcmeHVAC" and you clone to a different fund, that portfolio link still points at Alpine's portco, which is meaningless for the new fund.
- No merge — cloning into a portal with existing criteria creates duplicates.

---

### UC-15 — Extracting thesis from a non-standard doc (sales deck, pitch, CIM)

**Steps:** Upload a doc that isn't a crisp investment memo — extract.

**Gaps:**

- The extraction prompt (in `extract-portal-thesis` edge function — not inspected here but implied by behavior) likely assumes thesis-memo structure. Pitch decks and CIMs would extract with very low confidence or miss key ranges.
- No fallback path: admin can manually add criteria, but there's no "extraction confidence was low — please add criteria manually" CTA pointing them to the Add flow.

---

### UC-16 — Portfolio buyer linking

**Steps:** Thesis criterion has `portfolio_buyer_id` pointing to a specific portco — used to surface deals that could be roll-ups.

**Gaps:**

- The form allows setting the portfolio but there's no autocomplete / search in the dialog — just a raw buyer_id field (likely).
- Recommendations with portfolio links don't visually distinguish themselves on the card.
- If the portco is deleted/archived, the FK is orphaned and the card still shows "Portfolio linked".

---

### UC-17 — Buyer logs into the portal for the first time

**Steps:** Receives invite email → clicks link → hits `/portal/:slug` → sees their deals.

**Gaps not verified** (didn't test live):

- Password reset flow on portal side is separate from admin side — unclear if they share the same reset template.
- "Preview as client" from admin side opens the portal in a new tab but doesn't carry any auth context — admin can see the page shell but not the data.

---

### UC-18 — Buyer views a deal memo

**Gaps:**

- `deal_snapshot.memo_html` is trusted output from the memo generator. If that generator injects arbitrary HTML, this is a stored XSS vector on the admin side (`dangerouslySetInnerHTML` at `ClientPortalDetail.tsx:566-572`). The memo generator is internal, but any future path that lets buyers contribute to memo content would be exploitable. Recommend DOMPurify on render.
- No print / export to PDF.
- No download original CIM/teaser from the memo view.

---

### UC-19 — Buyer sends a question via chat; admin responds

**Gaps:**

- No email notification to admin when buyer sends a message. The admin has to happen to be looking at the Deals tab.
- No SLA visibility — "this buyer has an unanswered question, awaiting response for 3 days".

---

### UC-20 — Admin views portal activity / analytics

**Works:** `portal_analytics` hook surfaces push count, response rate, pending/interested/passed counts.

**Gaps:**

- Analytics are org-level, not per-user. Can't answer "which of the 6 Alpine partners actually logs in and reviews?"
- No time-series. "Are response rates trending up or down this quarter?" is invisible.
- CSV export only covers activity log — not responses, not pushes.

---

### UC-21 — Auto-reminder nudges stale pending deals

**Steps:** Portal setting has `auto_reminder_enabled` + `auto_reminder_days` + `auto_reminder_max` — cron re-emails buyer when deals linger unreviewed.

**Works:** Edge function `portal-auto-reminder`.

**Gaps:**

- No unsubscribe link in the reminder (regulatory concern — even B2B reminders typically need an opt-out).
- No per-push snooze. A buyer should be able to click "snooze 2 weeks" and stop reminders on ONE deal without disabling the feature.
- No cap at the individual-deal level — max=3 at the portal level, but if a buyer gets 3 reminders on 20 deals that's still 60 emails.

---

### UC-22 — Generating a "Why didn't this deal match?" report

**Steps:** Recommendations tab → "Why Not?" button → run any listing against all theses and see scoring breakdown.

**Works:** `WhyNotDialog` is wired.

**Gaps:**

- Not prominently discoverable — this is the single best tool for diagnosing Alpine-style issues but lives behind a tertiary button.
- Doesn't explain which keywords matched WHERE (primary vs secondary). After today's scoring fix, exposing the haystack for each gate would be trivial and invaluable.
- Can't run "why not" for a SPECIFIC thesis criterion — only blanket per portal.

---

### UC-23 — Migrating an existing (CRM-tracked) buyer into a portal

**Steps:** Buyer in CRM has notes, contacts, past meetings — admin spins up a portal and wants continuity.

**Gaps:**

- Portal creation does NOT seed intelligence docs from CRM attachments.
- Past meeting transcripts (Fireflies) aren't surfaced on the portal intelligence tab even when the buyer is linked.
- Portal notes are separate from buyer notes — two places, no sync.

---

### UC-24 — Portal user deactivated but still has pending responses

**Steps:** Admin deactivates a portal user → their past responses stay in `portal_responses`.

**Gaps:**

- Deactivated user's name still shows on historical responses (correct), but there's no "user deactivated on X" indicator — a new admin wonders why they can't reach out.
- If every user is deactivated, the portal silently loses its audience but the admin can still push deals that nobody will see.

---

### UC-25 — Full cron-cycle test in a staging environment

**Steps:** Queue a batch of listings → cron runs every 5 min → check `portal_deal_recommendations` for new rows.

**Gaps:**

- The cron is protected by `requireServiceRole`. No developer-friendly "trigger recompute now for portal X" admin button. The existing test suite covers the pure planner and scoring, but the end-to-end integration (queue → process → insert → surface in UI) has no visible dashboard.
- When the cron fails (edge function errors), nothing surfaces to an admin — it's in edge function logs only.
- `portal_recommendation_queue` depth has no monitoring; if the queue grows, admins won't know until recommendations go stale.
- The migration file `20260703_portal_intelligence_audit_fixes.sql` is alluded to in code comments; worth reviewing the P0/P1/P2 list.

---

## Part 3 — Cross-cutting findings (gaps I didn't tie to a single use case)

### 3.1 Data schema

- `portal_thesis_criteria` has no unique constraint on `(portal_org_id, industry_label)` — dupes possible.
- `portal_deal_recommendations` has `status` enum but no index on `(portal_org_id, status)` that I've verified; the pending-count head query is cheap but a compound index would help.
- No audit log on thesis changes (who edited which criterion when) — important for compliance and for the AI extraction feedback loop.

### 3.2 Edge functions

- All edge functions import `@supabase/supabase-js@2` from esm.sh at runtime. If esm.sh goes down, every cron run fails. Pin to a specific minor or mirror.
- No structured logging (JSON lines) — log lines are bare `console.error` strings. Observability pipeline can't parse.
- `extract-portal-thesis` costs $0.02 per run; no rate-limit or per-doc-per-day cap. An admin clicking rapidly could rack up Gemini bills.

### 3.3 Frontend

- `PortalThesisTab` doesn't empty-state the "no summary" case distinctly from loading; the `"No active criteria"` message can flash during initial fetch.
- Several dialogs (`PushToPortal`, `CloneThesis`, `ExtractThesis`) don't share a common loading/error state pattern — each reinvents.
- `dangerouslySetInnerHTML` usage for memo rendering (see UC-18) is a latent XSS risk.
- No permission gates on the Thesis and Recommendations tabs — any admin who can reach `/admin/client-portals/:slug` can edit theses and approve pushes. Appropriate for today's team but worth a role gate before scaling.

### 3.4 Recommendation engine

- Reap logic only hits listings in the current batch. Any thesis deactivation or keyword narrowing leaves an indefinite trail of stale recs.
- No "excluded keywords" concept — today's Alpine fix shows the need for negative matches (a thesis "HVAC" should be able to exclude "auto body", "collision"). Add a `excluded_keywords: string[]` column.
- Quality-score bonus is a flat +10 at `deal_total_score >= 60`. If all deals in a region score >60, this adds no signal. Consider a normalized-within-portal ranking.
- The hard 40-point industry gate combined with partial bonuses means a moderate-industry + strong-geo + strong-size deal CAN'T beat a weak-industry + weak-everything-else deal. The weights need re-tuning based on actual admin dismissals.

### 3.5 Operational

- No one-shot "reprocess everything for portal X" admin tool. The operator has to drop rows into `portal_recommendation_queue` directly.
- Alpine's 11 stale auto/collision recommendations were manually flagged today. If this happens again with a different portal, there's no runbook.

---

## Part 4 — Prioritized remediation plan

### Ship today (P0, done or nearly)

| Item                                   | Status             |
| -------------------------------------- | ------------------ |
| Fix scoring false positives (Alpine)   | Done — code + test |
| Stale Alpine's bad auto/collision recs | Done — SQL run     |
| Click-to-edit thesis cards             | Done               |
| Fix thesis extraction dialog scroll    | Done               |

### Ship this week (P1)

- Add `"Find matching deals"` action on each ThesisCriteriaCard — runs scoring on the full active-listing set.
- Add `excluded_keywords` column and UI to `portal_thesis_criteria`; update scoring to apply as negative gate.
- Add a "Reprocess recommendations" admin action per portal (enqueues all active listings in a scoped batch).
- Make "Why Not?" dialog a primary button and expand output to show primary vs secondary haystack matches.
- Auto-stale recommendations when a criterion is deactivated (DB trigger or UI-driven update).
- Dedupe on thesis save (`industry_label` per `portal_org_id` unique).

### Ship this month (P2)

- Structured pass-reason dropdown feeding back into scoring (auto-dismiss future matches from declined keywords).
- Thesis criterion versioning + audit log.
- Per-user portal analytics and time-series.
- Rate-limit + audit extraction calls (Gemini cost control).
- DOMPurify on memo HTML.
- Bulk invite, CSV export of marketplace filtered results.
- Monitoring on queue depth + failed edge function runs.

### Architectural (P3)

- Move scoring weights into configurable table, not code constants, so portal managers can tune per portal.
- Consider a small "portal ops dashboard" separate from the per-portal detail: queue depth, last cron run, error rate, portals with 0 pending recs, portals with >100 pending recs.
- Long-term: replace keyword scoring with embedding similarity between listing text and thesis text — eliminates the keyword-boundary class of bugs entirely.

---

## Part 5 — What was verified today

- Live DB query on Alpine thesis + recommendations confirmed the exact keyword-over-prose pathology (11 rows).
- 40/40 scoring tests pass after fix.
- TypeScript compile clean after all edits.
- Did **not** verify live in browser (the dev server wasn't started). Recommend spot-check:
  1. Open `/admin/client-portals/alpine-investors` → Thesis tab → click HVAC card → form opens.
  2. Intelligence tab → extract from any PDF → scroll candidate list → should scroll smoothly.
  3. Recommendations tab → pending list no longer shows auto body / collision shops.

---

**Files changed:**

- `supabase/functions/process-portal-recommendations/scoring.ts`
- `supabase/functions/process-portal-recommendations/scoring.test.ts` (+2 regression tests)
- `src/components/portal/ThesisCriteriaCard.tsx`
- `src/components/portal/ExtractThesisDialog.tsx`

**Database changes (one-off data cleanup):**

- `UPDATE portal_deal_recommendations SET status='stale'` for 11 Alpine listings matching auto/collision/towing/tire/restoration patterns.
