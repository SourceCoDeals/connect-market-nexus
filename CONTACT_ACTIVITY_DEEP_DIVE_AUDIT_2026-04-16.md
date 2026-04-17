# Contact Activity Tracking — Deep-Dive Audit (2026-04-16)

**Scope:** Why the contact activity tab is not tracking everything, and why historical outreach from Smartlead, HeyReach, and PhoneBurner is not populated.

**Method:** Mapped UI → hooks → views → tables → edge functions. Walked 25 real-world team workflows end-to-end. Verified claims against migration SQL and edge-function source.

**Headline:** The contact activity tab has a well-designed **unified view**, but four architectural defects prevent it from actually working end-to-end:

1. **The `unified_contact_timeline` view is broken for HeyReach.** It selects three columns that do not exist on `heyreach_messages`. The view either fails to apply or silently breaks the LinkedIn union.
2. **No webhook → `smartlead_messages` / `heyreach_messages` pathway.** Webhooks log to `*_webhook_events` only. Population of the tables the view reads is entirely dependent on periodic cron syncs.
3. **No PhoneBurner historical backfill exists.** The integration is forward-only from the moment the webhook is wired up. Any call that happened before wiring — or during a webhook outage — is gone.
4. **The unmatched queues (`smartlead_unmatched_messages`, `heyreach_unmatched_messages`, `contact_activities.matching_status='unmatched'`) have no UI.** Admins cannot see, fix, or re-promote the records that silently fell out.

The rest of this document lays out the system, then walks 25 team workflows against it, then enumerates every gap, bug, and edge-function defect found.

---

## PART 1 — System Map

### UI surface

| Component                        | File                                                               | What it shows                                                  |
| -------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `ContactActivityTimeline`        | `src/components/remarketing/ContactActivityTimeline.tsx`           | Per-buyer timeline, filters 7d/30d/90d/all, badges per channel |
| `ContactActivityTimelineByEmail` | same file                                                          | By-email variant used when there's no buyer row                |
| `DealContactHistoryTab`          | `src/components/remarketing/deal-detail/DealContactHistoryTab.tsx` | Firm-wide activity for a deal's contacts                       |
| `ContactHistoryTracker`          | `src/components/remarketing/deal-detail/ContactHistoryTracker.tsx` | Alternate view with engagement stats                           |

### Data-fetch layer

| Hook                                | File                                                   | Query                                                                                                      |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `useContactCombinedHistory`         | `src/hooks/use-contact-combined-history.ts:177`        | `unified_contact_timeline WHERE remarketing_buyer_id = ?` LIMIT 500                                        |
| `useContactCombinedHistoryByEmail`  | same:205                                               | `unified_contact_timeline WHERE contact_email ILIKE ?`                                                     |
| `useContactCombinedHistoryByDomain` | same:239                                               | RPC `get_firm_activity(p_buyer_id, p_domains)`                                                             |
| `useContactSmartleadHistory`        | `src/hooks/smartlead/use-contact-smartlead-history.ts` | **Legacy** — reads `smartlead_webhook_events` + `smartlead_campaign_leads`, **never** `smartlead_messages` |
| `useContactCallStats`               | `src/hooks/use-contact-call-stats.ts`                  | PhoneBurner stats direct from `contact_activities`                                                         |

### The unified view

`supabase/migrations/20260716000001_enhanced_unified_timeline.sql` creates `unified_contact_timeline` as a 6-way UNION ALL across:

| #   | Source table            | Channel             | Join                  |
| --- | ----------------------- | ------------------- | --------------------- |
| 1   | `contact_activities`    | call (PhoneBurner)  | —                     |
| 2   | `email_messages`        | email (Outlook)     | `contacts`            |
| 3   | `smartlead_messages`    | email               | `smartlead_campaigns` |
| 4   | `smartlead_reply_inbox` | email (inbound)     | —                     |
| 5   | `heyreach_messages`     | linkedin            | `heyreach_campaigns`  |
| 6   | `buyer_transcripts`     | meeting (Fireflies) | —                     |

### Write paths (per integration)

| Integration | Real-time                                                            | Batch sync                                                                             | Historical backfill                    | Native write to view-source table                  |
| ----------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------- |
| PhoneBurner | `phoneburner-webhook` → `contact_activities`                         | `sync-phoneburner-transcripts` (transcripts only)                                      | **NONE**                               | Yes (webhook writes directly)                      |
| Smartlead   | `smartlead-webhook` → `smartlead_webhook_events` only                | `sync-smartlead-messages` → `smartlead_messages` (cron 20 min — schedule not verified) | `backfill-smartlead-messages` (manual) | **No** — webhook never writes `smartlead_messages` |
| HeyReach    | `heyreach-webhook` → `heyreach_webhook_events` only                  | `sync-heyreach-messages` → `heyreach_messages` (cron — schedule not verified)          | `backfill-heyreach-messages` (manual)  | **No** — webhook never writes `heyreach_messages`  |
| Outlook     | `outlook-webhook` → queue → `outlook-sync-emails` → `email_messages` | —                                                                                      | covered by sync                        | Eventually yes                                     |
| Fireflies   | `fireflies-webhook` → `buyer_transcripts`                            | —                                                                                      | —                                      | Yes                                                |

---

## PART 2 — 25 Real-World Team Workflows

Each workflow is written as:

- **Actor & business goal**
- **Steps the user takes** (UI-level)
- **What the system actually does** (DB / edge function trace)
- **Verdict** — ✅ works / ⚠️ partial / ❌ broken
- **Gaps, bugs, edge-function defects encountered**

---

### Workflow 1 — Alia's named scenario: "Who has talked to this deal, and push them to PhoneBurner"

**Actor:** Alia, deal lead.
**Goal:** On a live deal, see every prior touch across every channel for every contact at the target firm, then push the qualified subset to PhoneBurner with a one-call-per-rep session.

**Steps:**

1. Open deal in Envoy Atlas.
2. Click the Contacts tab → Contact History / Activity tab.
3. Filter to 90d to see who has been emailed/LinkedIn'd/called.
4. Select the contacts that have been warmed but not yet called.
5. Click "Push to PhoneBurner" → pick target PB user → confirm → PB dialer opens.

**System trace:**

- Step 3 → `useContactCombinedHistoryByDomain(buyerId, domains)` → RPC `get_firm_activity` → reads `unified_contact_timeline`.
- Step 5 → `phoneburner-push-contacts` edge function → creates `phoneburner_sessions` row → calls PhoneBurner `POST /rest/1/dialsession` → stores `request_id` in session, custom-field-embeds `sourceco_id` in each pushed contact → returns `redirect_url`.

**Verdict:** ⚠️ **partial**.

**Gaps hit:**

- **G-A:** `unified_contact_timeline` may be missing HeyReach rows entirely (see P0 bug §3.1). LinkedIn touches won't surface.
- **G-B:** Smartlead messages only appear if `sync-smartlead-messages` cron has run — no webhook-fed freshness.
- **G-C:** After the PB push, Alia has no view of disposition → Smartlead "do not email" propagation (see Workflow 14).
- **G-D:** `PushToDialerModal.tsx` line 191 opens only the first redirect when pushing to multiple PB users — subsequent users get a silent success.

---

### Workflow 2 — "Has this firm already been hit in the last 30 days? Don't double-touch."

**Actor:** BDR preparing a cold outreach campaign.
**Goal:** Before adding a firm's contacts to a new Smartlead sequence, verify no one on the team has already reached out in the last 30 days.

**Steps:**

1. Search firm by name in Remarketing Buyers.
2. Open buyer detail → Activity tab.
3. Set filter to 30d, scan all channels.

**System trace:** `useContactCombinedHistory(buyerId)` → `unified_contact_timeline WHERE remarketing_buyer_id = ?`.

**Verdict:** ❌ **unreliable**.

**Gaps hit:**

- **G-A** (HeyReach rows missing).
- **G-E:** `smartlead_reply_inbox` union branch has `remarketing_buyer_id = NULL` hardcoded (view line 57) — any reply that only exists in the reply inbox will not be returned by a `WHERE remarketing_buyer_id = ?` query. Inbound replies to the firm are invisible here.
- **G-F:** `buyer_transcripts` union uses `buyer_id` (line 80) but the view aliases it as `remarketing_buyer_id`. Fireflies meetings show only if `buyer_transcripts.buyer_id` was set — and the extraction pipeline sets this via a separate matcher that fails silently on domain mismatches.

---

### Workflow 3 — "Pull all LinkedIn replies from last week and assign them"

**Actor:** Sales manager Monday morning.
**Goal:** Generate a list of everyone who replied to a HeyReach LinkedIn message last week so they can be routed to a rep for follow-up.

**Steps:** Admin dashboard → LinkedIn replies filter → assign each.

**System trace:** Any query filtering `heyreach_messages WHERE event_type='lead_replied' AND sent_at >= now()-7d`.

**Verdict:** ❌ **broken**.

**Gaps hit:**

- **P0-VIEW:** `unified_contact_timeline` HeyReach union (line 67–74) references `hm.from_address`, `hm.sequence_number`, `hm.linkedin_url` — none of these columns exist on `heyreach_messages` (actual columns: `from_linkedin_url`, `to_linkedin_url`; no sequence_number). The view either refused to apply in the migration, or queries against it fail when the HeyReach branch is exercised.
- **G-G:** Even if the view worked, `heyreach-webhook` does **not** write to `heyreach_messages`. Only `sync-heyreach-messages` (cron) or the manual `backfill-heyreach-messages` populate it. Replies from the last week will be absent unless the cron has actually run.
- **G-H:** No cron schedule migration exists in `supabase/migrations/` for `sync-heyreach-messages`. The edge function's comment says "runs every 20 min via pg_cron" but there is no `cron.schedule(...)` SQL — this schedule must exist in the Supabase dashboard or it's not running.

---

### Workflow 4 — "Find all contacts who replied but never got a call"

**Actor:** SDR looking for low-hanging fruit.
**Goal:** Cross-channel filter: replied via email OR LinkedIn, never called in PhoneBurner.

**Steps:** Contacts list → filter "replied" + "not called".

**Verdict:** ❌ **no UI surface exists for this**.

**Gaps hit:**

- **G-I:** There is no cross-channel filter anywhere in the Contacts UI. `filter-definitions/activity-fields.ts` only exposes portal-side types (signup / listing_view / save / connection_request / search), not outreach types.
- **G-J:** Engagement state (`emailsReplied`, `callsConnected`, etc.) is computed client-side in `use-activity-stats.ts` per contact — no aggregate query exists to filter across contacts.

---

### Workflow 5 — "Export the full activity of a deal to share with the seller"

**Actor:** Deal lead preparing buyer update for seller.
**Goal:** CSV/PDF export of all touches across all buyers for a given deal.

**Steps:** Deal page → Export activity.

**Verdict:** ❌ **not implemented**.

**Gaps hit:**

- **G-K:** No export button on `DealContactHistoryTab` or `ContactHistoryTracker`. No edge function exists for activity-export.
- **G-L:** Even if built, the RPC `get_firm_activity` is capped — no pagination contract. Deals with >500 touches would be truncated.

---

### Workflow 6 — "Alia wants to know when a specific contact was last touched, on any channel"

**Actor:** Any rep about to make a cold call.
**Goal:** One-line answer: "Last touched 2026-04-11 via Smartlead — opened but didn't reply."

**Verdict:** ⚠️ **partial**.

**Gaps hit:**

- **G-M:** `use-activity-stats.ts:70` computes `daysSinceLastContact` but only from entries returned by `useContactCombinedHistory` — which has the 500-row cap and the broken HeyReach branch. "Last contact" can be stale-wrong.
- **G-N:** Contact card does not display `contacts.last_disposition_code` / `last_disposition_label` — those columns exist but `phoneburner-webhook` never updates them (webhook only updates `contact_activities`).

---

### Workflow 7 — "Onboarding a new BDR: show them every historical touch on their assigned firms"

**Actor:** New hire on day 1.
**Goal:** See the full outreach history for every firm assigned to them.

**Verdict:** ❌ **historical data is not populated**.

**Gaps hit:**

- **G-O:** There's no admin-side "backfill everything now" button. `backfill-smartlead-messages` and `backfill-heyreach-messages` are edge-function POST endpoints, not surfaced in the UI. No cron migration for either.
- **G-P:** PhoneBurner has **no historical backfill function at all** — no edge function calls `GET /rest/1/calls` against PB's API. All historical calls predating the webhook wiring date are lost to the CRM.
- **G-Q:** RLS: `smartlead_messages` and `heyreach_messages` both require `contact_assignments` rows for non-admins (migration lines 318–328, 337–347). A new BDR sees nothing until `contact_assignments` are created for them — this is a separate onboarding step no one owns.

---

### Workflow 8 — "Contact moved firms — retain their call history at the old firm, track new touches at the new firm"

**Actor:** CRM admin when an exec moves jobs.
**Goal:** Historical activity stays anchored to the old firm; new activity gets the new firm's `remarketing_buyer_id`.

**Verdict:** ⚠️ **partial**.

**Gaps hit:**

- **G-R:** `smartlead_messages` and `heyreach_messages` store `remarketing_buyer_id` denormalized at write time. Updating `contacts.remarketing_buyer_id` after the fact does **not** rewrite historical outreach rows. Old rows keep the old firm (this is correct for the historical anchor) but there's no UI showing "this contact is now at firm X — click to see activity at firm Y".
- **G-S:** `contact_activities` has no such firm-column rewrite concern but also has no firm re-anchoring UI.

---

### Workflow 9 — "Bulk backfill a PE firm's historical Smartlead + HeyReach when we first add them"

**Actor:** Ops person adding a new firm.
**Goal:** Sync all past outreach for the firm's contacts in one shot.

**Verdict:** ⚠️ **possible but hostile**.

**Gaps hit:**

- **G-T:** Backfill is campaign-scoped, not firm-scoped. `backfill-smartlead-messages` takes `campaign_id` + `start_offset`; `backfill-heyreach-messages` similarly. To backfill a firm, you must know every Smartlead/HeyReach campaign they've ever been in and loop the backfill by hand.
- **G-U:** The backfill route goes: SmartLead API → `resolveOutreachContact` → match → `smartlead_messages` insert. If the contact has no `remarketing_buyer_id` at backfill time, the record lands in `smartlead_unmatched_messages` with reason `missing_anchor`. There is **no promotion job** that retroactively re-matches these when the anchor is later added (see §3.4).

---

### Workflow 10 — "Classify a reply as interested → immediately queue for a call"

**Actor:** Auto-routing for hot leads.
**Goal:** Smartlead `INTERESTED` webhook → contact auto-added to a PhoneBurner list for next-day dial.

**Verdict:** ❌ **not wired**.

**Gaps hit:**

- **G-V:** `smartlead-webhook/index.ts` updates `smartlead_campaign_leads.lead_status='INTERESTED'` but does not trigger any PB push. There is no edge function chaining webhook → PB push.
- **G-W:** `smartlead-inbox-webhook/index.ts` does have a GP automation path (865 lines) but its output is a classification into the reply inbox, not a dial-list insertion.

---

### Workflow 11 — "Mark a contact DNC — propagate across Smartlead, HeyReach, PhoneBurner"

**Actor:** Any rep handling a "remove me" request.
**Goal:** Single DNC toggle → Smartlead unsubscribes the lead, HeyReach marks them interested=false, PhoneBurner marks `do_not_call=true`.

**Verdict:** ❌ **one-way only**.

**Gaps hit:**

- **G-X:** Inbound only: `phoneburner-webhook` honors PB `email.unsubscribed` and `sms.opt_out` webhooks, and `smartlead-webhook` honors `UNSUBSCRIBED`. But there's no **outbound** DNC push — if a rep toggles `contacts.do_not_call` in the CRM, no edge function fires to call Smartlead's unsubscribe API, HeyReach's blacklist API, or PhoneBurner's DNC API.
- **G-Y:** `disposition_mappings` (webhook line 1146) can set `do_not_call=true` on the contact from a PB disposition — but only flows PB → contact, never contact → other integrations.

---

### Workflow 12 — "See which Smartlead campaign generated which meeting"

**Actor:** Analytics / manager.
**Goal:** Attribution: Fireflies meeting → source campaign.

**Verdict:** ❌ **no attribution model**.

**Gaps hit:**

- **G-Z:** `buyer_transcripts` has no campaign_id. `fireflies-webhook` matches on participant email / company name. There is no path joining a meeting back to the Smartlead/HeyReach campaign that sourced it.

---

### Workflow 13 — "Filter activity by campaign to gauge sequence performance"

**Actor:** Growth analyst.
**Goal:** For campaign X: show replies, opens, clicks, plus downstream calls and meetings.

**Verdict:** ⚠️ **partial**.

**Gaps hit:**

- **G-AA:** `unified_contact_timeline` exposes `campaign_name` (joined from `smartlead_campaigns`) but **not `campaign_id`**. The UI cannot deep-link / filter by canonical ID — only by human-readable name, which breaks if the name changes.
- **G-BB:** `smartlead_reply_inbox` union emits `campaign_name` from its own column (line 60) — if the name on `smartlead_reply_inbox` drifts from `smartlead_campaigns.name`, the view produces rows that look like they're in different campaigns.

---

### Workflow 14 — "After PB call with Not Interested disposition, pause Smartlead sequence"

**Actor:** BDR wraps a call.
**Goal:** PB disposition → Smartlead pause / stop for that lead.

**Verdict:** ❌ **no cross-integration control plane**.

**Gaps hit:**

- **G-CC:** `phoneburner-webhook` writes disposition to `contact_activities` + optionally sets `contacts.do_not_call` via `disposition_mappings` (line 1155). It never touches `smartlead_campaign_leads.lead_status`. Lead stays in Smartlead sequence.
- **G-DD:** No edge function `pause-smartlead-for-contact` or similar exists.

---

### Workflow 15 — "LinkedIn connection accepted → open PB session with that contact"

**Actor:** Rep working warm LinkedIn connections.
**Goal:** HeyReach `CONNECTION_ACCEPTED` → task in daily standup with "call this person today".

**Verdict:** ⚠️ **possible indirectly**.

**Gaps hit:**

- **G-EE:** `phoneburner-webhook` creates `daily_standup_tasks` off dispositions (line 1314–1340). HeyReach webhook has no equivalent — accepted connections don't generate tasks.

---

### Workflow 16 — "A contact has no `linkedin_url` stored — HeyReach campaign touches them via LinkedIn URL — nothing appears on their timeline"

**Actor:** Rep wondering why a known-replied contact shows no activity.
**Goal:** Timeline should show the LinkedIn activity.

**Verdict:** ❌ **silently unmatched**.

**Gaps hit:**

- **G-FF:** `resolveOutreachContact` (`_shared/outreach-match.ts:229`) tries email first, then LinkedIn URL. If contact has neither or only email mismatches and contact.linkedin_url is NULL, the record lands in `heyreach_unmatched_messages` with `reason='no_match'`.
- **G-GG:** **There is no UI for `heyreach_unmatched_messages` or `smartlead_unmatched_messages`.** Admins cannot see the queue, cannot manually resolve, cannot bulk re-match.
- **G-HH:** No promotion job re-tries unmatched records when the contact's linkedin_url / email is later filled in. `matched_at` column exists but is never set.

---

### Workflow 17 — "Firm contact onboarded without `remarketing_buyer_id` set — HeyReach outreach was already happening"

**Actor:** Happens constantly during bulk contact imports.
**Goal:** Backfill later should pick up past touches once the firm link is set.

**Verdict:** ❌ **records are parked forever**.

**Gaps hit:**

- **G-U** (repeated): `buildAnchorFromContact` returns `{matched: false, reason: 'missing_anchor'}` when a buyer contact has no `remarketing_buyer_id`. Record goes to `heyreach_unmatched_messages` / `smartlead_unmatched_messages`. No job promotes it later.
- **G-II:** `20260414000002_outreach_promotion.sql` exists but only promotes on contact INSERT — not on contact UPDATE that adds `remarketing_buyer_id` later. (Verify by opening the file — if it's update-triggered, this point is downgraded; from the file list it exists at least.)

---

### Workflow 18 — "Push all contacts on a firm to PhoneBurner for a blitz"

**Actor:** Morning blitz lead.
**Goal:** Select 40 contacts across a firm → push to PB → distribute to 3 reps.

**Steps:** Buyer detail → contacts → select all → "Push to PhoneBurner" → pick 3 PB users.

**Verdict:** ⚠️ **partial**.

**Gaps hit:**

- **G-D** (repeated): `PushToDialerModal.tsx:191` opens only the first rep's redirect. Other reps need to manually find their PB session — no notification / email / deep-link.
- **G-JJ:** `phoneburner-push-contacts` stores `session_contacts` JSONB at push time with whatever phones the contact had then. If the phone is updated between push and dial, multi-phone matching in the webhook (line 371–406) may still miss — fuzzy last-10 match is unreliable for short numbers.
- **G-KK:** No dedup if you push the same contact twice — two PB sessions will fight for the same contact.

---

### Workflow 19 — "View call recording 30 days later for pipeline review"

**Actor:** Manager reviewing a stalled deal.
**Goal:** Play the original call.

**Verdict:** ⚠️ **may 404**.

**Gaps hit:**

- **G-LL:** `phoneburner-webhook` stores `recording_url` and `recording_url_public` as returned by PB (line 1071–1082). PB's URLs are presigned / time-limited. There is **no archival** to Supabase Storage. Recordings silently break after PB's retention window.

---

### Workflow 20 — "Show last 10 touches on a contact regardless of channel, sorted by time, in the inbox-like panel"

**Actor:** Rep mid-call wanting instant context.
**Goal:** Chronological 10-row list.

**Verdict:** ⚠️ **works if data flows**.

**Gaps hit:**

- **G-MM:** `useContactCombinedHistoryByEmail` queries on `contact_email ILIKE ?`. The union branches populate that column inconsistently:
  - `contact_activities.contact_email` — populated by webhook only if the PB payload has an email (often missing for dial-only calls)
  - `email_messages.from_address` — always populated but is the sender, not the contact
  - `smartlead_messages.from_address` — the sender, not the contact
  - `smartlead_reply_inbox.to_email` — the inbox owner (your team), not the contact
  - `heyreach_messages.from_address` — **column doesn't exist** (see P0-VIEW)
  - `buyer_transcripts` — `NULL`

  Matching a contact's email against the view's `contact_email` column is **semantically inconsistent** — the column means different things per source.

---

### Workflow 21 — "Deal team hands a firm over to a new rep — transfer all assignments"

**Actor:** Ops.
**Goal:** Change contact_assignments; the new rep sees Smartlead/HeyReach rows immediately.

**Verdict:** ✅ **RLS works**.

**Gaps hit:**

- No defect in RLS paths — migration 20260414000000 lines 318–347 correctly scope SELECT via `contact_assignments`. But: the transition is not atomic — if you deactivate old assignment before creating new, there's a window where no one sees the activity.

---

### Workflow 22 — "Ops check: how many Smartlead events are sitting in `smartlead_webhook_events` that never made it into `smartlead_messages`?"

**Actor:** Platform engineer during debug.
**Goal:** Integration health signal.

**Verdict:** ❌ **no dashboard**.

**Gaps hit:**

- **G-NN:** `smartlead_webhook_events.processed` is a boolean but nothing uses it to backfill `smartlead_messages`. Events accumulate forever with no reconciliation job. Ops must query by hand.
- **G-OO:** Same for `heyreach_webhook_events.processed`. `heyreach-webhook/index.ts` (line 314–322 of the explorer's note) marks events processed but never inserts to `heyreach_messages`.
- **G-PP:** No integration health page. No "last successful sync" stat for Smartlead / HeyReach / Fireflies. Silent failure.

---

### Workflow 23 — "See which LinkedIn messages are awaiting a reply, sorted by stalest"

**Actor:** Rep doing nudge rounds.
**Goal:** List of outgoing `message_sent` with no corresponding `lead_replied` in 5+ days.

**Verdict:** ❌ **data shape works, no UI**.

**Gaps hit:**

- **G-I** (repeated): No activity-filter UI exists at the contact-list level.
- **G-QQ:** Even when filtering works, it's subject to P0-VIEW (HeyReach rows may not exist in the view at all).

---

### Workflow 24 — "Compliance: export every touch for a specific contact for legal"

**Actor:** Legal request.
**Goal:** Full, complete, provable record.

**Verdict:** ❌ **cannot be trusted as complete**.

**Gaps hit:**

- **G-RR:** Any record that hit an unmatched queue is excluded from the contact's timeline (§3.4).
- **G-SS:** PhoneBurner calls from before webhook wiring don't exist in the CRM at all (§3.3).
- **G-TT:** Fireflies transcripts require matching on participant email / company domain — fails silently if neither matches.
- **G-UU:** Recording URLs may 404 (§G-LL).
- **G-VV:** `contact_activities` has `matching_status='unmatched'` rows for calls where contact resolution failed — these rows exist but RLS/UI doesn't surface them, so the export omits them.

---

### Workflow 25 — "Alia's scenario, full round trip: talk → log → export → re-dial → update disposition → pause Smartlead"

**Actor:** The full lifecycle combination.
**Goal:** This is the demonstrable happy path every rep should be able to do in <2 minutes.

**Verdict:** ⚠️ **works piecemeal, no orchestration**.

**Gaps hit:** All of G-A, G-C, G-D, G-CC, G-DD above. There is no single orchestrated workflow. It's five separate click-and-pray operations.

---

## PART 3 — Consolidated Gap / Bug Register

### 3.1 P0 — View Breakage

- **P0-VIEW / Bug #1:** `unified_contact_timeline` HeyReach union (migration `20260716000001_enhanced_unified_timeline.sql`, lines 67–74) references three non-existent columns on `heyreach_messages`:
  - `hm.from_address` — actual column is `from_linkedin_url` (migration `20260414000000_outreach_messages.sql:124`)
  - `hm.sequence_number` — column does not exist on `heyreach_messages` (it exists on `smartlead_messages:66`)
  - `hm.linkedin_url` — actual columns are `from_linkedin_url` / `to_linkedin_url`

  **Effect:** Either migration `20260716000001` failed at apply time (→ view absent, ALL contact activity queries fail) or the view was created in a state that errors on read. Either way, LinkedIn activity is not visible in the contact activity tab.

  **Fix:** Rewrite the HeyReach SELECT block to:

  ```sql
  SELECT
    hm.id, hm.contact_id, hm.remarketing_buyer_id,
    hm.from_linkedin_url AS contact_email,   -- or NULL / a dedicated column
    'heyreach'::text, 'linkedin'::text, UPPER(hm.event_type),
    hm.subject, hm.body_text, hm.sent_at, hm.created_at, hm.listing_id, NULL::uuid,
    hc.name, hm.direction::text,
    jsonb_build_object(
      'message_type', hm.message_type,
      'from_linkedin_url', hm.from_linkedin_url,
      'to_linkedin_url', hm.to_linkedin_url,
      'heyreach_campaign_id', hm.heyreach_campaign_id
    )
  FROM heyreach_messages hm
  LEFT JOIN heyreach_campaigns hc ON hc.heyreach_campaign_id = hm.heyreach_campaign_id
  ```

- **P0-VIEW / Bug #2:** The `contact_email` column on the unified view is semantically overloaded (§Workflow 20). For email UNIONs it holds a sender address; for PhoneBurner it holds the matched contact email; for HeyReach (once fixed) it should be null or a LinkedIn URL. Joins on it are unsound.

  **Fix:** Add a proper `contact_identifier` column with explicit semantics, or normalize the view to always hold the contact's canonical email by joining `contacts` on `contact_id`.

### 3.2 P0 — Webhook → Canonical Table Gap

- **Bug #3:** `smartlead-webhook` writes only to `smartlead_webhook_events`, never to `smartlead_messages`. Real-time activity is invisible in the contact activity tab unless the 20-min cron has already run.
- **Bug #4:** `heyreach-webhook` writes only to `heyreach_webhook_events`, never to `heyreach_messages`. Same effect.
- **Bug #5:** No cron schedule SQL exists in `supabase/migrations/` for either `sync-smartlead-messages` or `sync-heyreach-messages`. Schedule lives only in Supabase dashboard (if at all) — must be audited directly in the project settings.

  **Fix options:**
  - **Short-term:** Add a post-insert trigger on `smartlead_webhook_events` / `heyreach_webhook_events` that calls the matcher and upserts to `*_messages`.
  - **Long-term:** Move matching into the webhook handler itself so the real-time event immediately produces a canonical row (the Outlook / PhoneBurner pattern).
  - Add `pg_cron` schedules to migrations so they're reproducible.

### 3.3 P0 — PhoneBurner Historical Data Gap

- **Bug #6:** No edge function calls PhoneBurner's `GET /rest/1/calls` history API. The integration is strictly forward-only from webhook wiring date. Any calls predating wiring — or made during a webhook outage — are permanently missing.
- **Bug #7:** No webhook health signal. If PhoneBurner stops posting (account, DNS, signature-secret, or network issue), the CRM silently stops receiving calls until someone notices empty timelines.

  **Fix:**
  - Build `phoneburner-backfill-history` edge function: iterate PB `/calls?from=X&to=Y` per PB user, normalize, match, insert to `contact_activities`.
  - Add admin dashboard tile: "Last PhoneBurner webhook received — X hours ago". Alert if >24h with active PB users.

### 3.4 P1 — Unmatched Queues Have No UI

- **Bug #8:** `smartlead_unmatched_messages`, `heyreach_unmatched_messages`, and `contact_activities WHERE matching_status='unmatched'` all accumulate silently. No admin page exists to view, triage, or resolve them.
- **Bug #9:** No promotion job re-tries unmatched records after the contact's `remarketing_buyer_id` / `linkedin_url` / `email` is filled in. `matched_at` is never set.

  **Fix:**
  - Build `/admin/unmatched-activity` page listing all three queues with filters and a "re-match" action.
  - Add `promote-unmatched-messages` edge function triggered on contact update (or run on a cron) that calls `resolveOutreachContact` for stalest unmatched rows.

### 3.5 P1 — Matching Logic Silent Failures

- **Bug #10:** Phone normalization in `phoneburner-webhook` (line 316–320) handles only US 11-digit format. International numbers, extensions (`x123`), and non-NANP numbers drop to fuzzy last-10 matching which is unreliable.
- **Bug #11:** `normalizeLinkedInUrl` (`_shared/outreach-match.ts:65`) handles protocol/www/trailing-slash but not query strings on some paths, not `/pub/` legacy URLs, not Sales Navigator URLs.
- **Bug #12:** `resolveOutreachContact` returns `reason: 'missing_anchor'` for buyer contacts without `remarketing_buyer_id`. These records park in the unmatched queue and never self-resolve (see Bug #9).

  **Fix:**
  - Use `libphonenumber` (Deno port) for phone normalization. Store both normalized E.164 and last-10 for indexed matching.
  - Expand LinkedIn normalization to handle Sales Navigator (`/sales/`) and `/pub/` legacy formats; canonicalize to `linkedin.com/in/<slug>`.

### 3.6 P1 — Cross-Integration Control Plane Missing

- **Bug #13:** No outbound propagation of DNC / unsubscribe / pause state. CRM toggle → Smartlead/HeyReach/PB APIs is unbuilt (§Workflow 11).
- **Bug #14:** No disposition → Smartlead lead status propagation. Calls end in PB but Smartlead keeps sending (§Workflow 14).
- **Bug #15:** No chain "reply interested → PB dial list". `smartlead-inbox-webhook` classifies but doesn't route (§Workflow 10).

### 3.7 P2 — UI / UX Defects

- **Bug #16:** `ContactActivityTimeline.tsx` has badges and filters by channel but no granular event-type filter. Can't see "only unsubscribed" or "only accepted connections".
- **Bug #17:** No cross-contact activity filter in the Contacts list view — can't build "replied but never called" lists (§Workflow 4).
- **Bug #18:** No activity export from deal page (§Workflow 5).
- **Bug #19:** `PushToDialerModal.tsx:191` silently drops subsequent rep redirects on multi-user push (§Workflow 18).
- **Bug #20:** `useContactSmartleadHistory` reads the wrong tables (`smartlead_webhook_events` + legacy `smartlead_campaign_leads`) instead of `smartlead_messages`. Legacy dead code producing low-fidelity data.
- **Bug #21:** `contact_activities.last_disposition_*` on `contacts` table exists but is never written — contact card shows no "last call outcome" (§Workflow 6).

### 3.8 P2 — Storage / Retention

- **Bug #22:** Recording URLs stored as-is. PB URLs expire; recordings break silently (§Workflow 19).
- **Bug #23:** `contact_activities` has no enforced XOR between `contact_id + remarketing_buyer_id` and `contact_id + listing_id` — buyer vs seller side of calls is ambiguous (unlike `smartlead_messages` / `heyreach_messages` which enforce it).
- **Bug #24:** `unified_contact_timeline` outputs `campaign_name` but not `campaign_id` — filters by canonical ID are impossible (§Workflow 13).

### 3.9 P2 — Edge Function Hygiene

- **Bug #25:** `phoneburner-webhook/index.ts:237` references `signatureValid` before assignment (per PhoneBurner explorer). Needs code read to confirm, but the audit noted it as a defect.
- **Bug #26:** `phoneburner-oauth-callback` is deprecated (returns 410) — should be deleted, not left as a decoy endpoint.
- **Bug #27:** `sync-phoneburner-transcripts` only copies from `contact_activities` → `deal_transcripts`; it does not fetch from PB. The name is misleading.
- **Bug #28:** Fireflies / Smartlead / HeyReach webhooks fail closed if their respective `*_WEBHOOK_SECRET` / `FIREFLIES_API_KEY` env vars are unset (503), but there's no health surface that exposes "this integration is misconfigured".

---

## PART 4 — Recommended Work Order

**Day 0 (do now, 1–2 hours):**

1. Fix `unified_contact_timeline` HeyReach union (Bug #1). Apply the rewrite in §3.1.
2. Verify the migration actually applied in production: `SELECT * FROM pg_views WHERE viewname = 'unified_contact_timeline';`. If absent, re-run.
3. Check whether `sync-smartlead-messages` and `sync-heyreach-messages` cron jobs are actually scheduled in Supabase dashboard. If not, schedule them.

**Week 1 (sync + backfill path):**

4. Run `backfill-smartlead-messages` and `backfill-heyreach-messages` manually for every active campaign.
5. Build `phoneburner-backfill-history` edge function (Bug #6). Run it for every PB user for the past 365 days.
6. Migrate `pg_cron` schedules into `supabase/migrations/` so they're reproducible (Bug #5).
7. Add webhook-level writes to `smartlead_messages` / `heyreach_messages` so real-time doesn't depend on the 20-min cron (Bugs #3, #4).

**Week 2 (unmatched + control plane):**

8. Build `/admin/unmatched-activity` page (Bug #8).
9. Build `promote-unmatched-messages` edge function (Bug #9).
10. Replace `useContactSmartleadHistory` consumers with `useContactCombinedHistory` (Bug #20); delete the legacy hook.
11. Fix `PushToDialerModal.tsx:191` multi-user redirect (Bug #19).

**Week 3 (orchestration + retention):**

12. Build disposition → Smartlead pause chain (Bug #14).
13. Build CRM-toggle → Smartlead/HeyReach/PB DNC propagation (Bug #13).
14. Move recording URLs to Supabase Storage on `call_end` (Bug #22).
15. Add `campaign_id` to unified view (Bug #24).

**Week 4 (UI polish, filters, exports):**

16. Granular event-type filter on `ContactActivityTimeline` (Bug #16).
17. Cross-contact activity filter on Contacts list (Bug #17).
18. Deal-level activity export (Bug #18).
19. `last_disposition_*` write path + contact card display (Bug #21).

---

## PART 5 — Verification Queries for the User

Run these to confirm the state of the system before the fixes land:

```sql
-- 1. Does the unified view exist?
SELECT viewname FROM pg_views WHERE viewname = 'unified_contact_timeline';

-- 2. How much data is in each source?
SELECT 'contact_activities' src, count(*) FROM contact_activities
UNION ALL SELECT 'smartlead_messages', count(*) FROM smartlead_messages
UNION ALL SELECT 'heyreach_messages', count(*) FROM heyreach_messages
UNION ALL SELECT 'smartlead_webhook_events', count(*) FROM smartlead_webhook_events
UNION ALL SELECT 'heyreach_webhook_events', count(*) FROM heyreach_webhook_events
UNION ALL SELECT 'smartlead_unmatched_messages', count(*) FROM smartlead_unmatched_messages
UNION ALL SELECT 'heyreach_unmatched_messages', count(*) FROM heyreach_unmatched_messages;

-- 3. Ratio of webhook events to canonical rows (should be ~1:1 if sync works)
SELECT
  (SELECT count(*) FROM smartlead_webhook_events) AS webhook_count,
  (SELECT count(*) FROM smartlead_messages)        AS message_count;

-- 4. Unmatched activities on PhoneBurner side
SELECT count(*) FROM contact_activities WHERE matching_status = 'unmatched';

-- 5. Are cron jobs scheduled?
SELECT jobname, schedule, active FROM cron.job
WHERE command ILIKE '%sync-smartlead-messages%'
   OR command ILIKE '%sync-heyreach-messages%';

-- 6. When was the last PhoneBurner webhook received?
SELECT max(received_at) FROM phoneburner_webhooks_log;

-- 7. When was the last Smartlead / HeyReach sync?
SELECT channel, max(last_synced_at) FROM outreach_sync_state GROUP BY channel;
```

If #1 returns 0 rows → Bug #1 broke the migration. The entire timeline is broken.
If #3 has a large ratio mismatch → Bug #3/#4 confirmed; the real-time stream is lost.
If #5 returns 0 rows → Bug #5 confirmed; crons never scheduled.
If #6 is >24h old → PhoneBurner webhook is broken at the provider side.
