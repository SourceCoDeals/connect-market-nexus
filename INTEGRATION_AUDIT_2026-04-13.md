# Integration Audit: SmartLead, HeyReach, PhoneBurner, Outlook

**Date:** 2026-04-13
**Scope:** All 4 outreach integrations — edge functions, database, frontend, data flows

---

## 1. Integration Map

### Component Inventory

| Component           | SmartLead          | HeyReach        | PhoneBurner | Outlook                |
| ------------------- | ------------------ | --------------- | ----------- | ---------------------- |
| Edge Functions      | 11                 | 9               | 6           | 10                     |
| DB Tables           | 7                  | 5               | 3           | 4                      |
| Frontend Hooks      | 7                  | 5               | 1           | 3                      |
| Frontend Components | 7                  | 3               | 2           | 4                      |
| Cron Jobs           | 1 (20 min sync)    | 1 (20 min sync) | 0           | 3 (token/webhook/sync) |
| Webhook Handler     | 2 (events + inbox) | 1               | 1           | 1                      |
| Push-to-Tool        | Yes                | Yes             | Yes         | Yes (send email)       |

### Data Volume (Live)

| Table                    | Rows  | Status                                  |
| ------------------------ | ----- | --------------------------------------- |
| contact_activities       | 1,894 | **Active — PhoneBurner primary source** |
| phoneburner_webhooks_log | 2,261 | Active                                  |
| phoneburner_sessions     | 31    | Active                                  |
| outlook_webhook_events   | 2,033 | Active (events arriving)                |
| email_messages           | 7     | **CRITICAL: barely populated**          |
| smartlead_reply_inbox    | 334   | Active (replies captured)               |
| smartlead_campaigns      | 0     | **NOT SYNCED**                          |
| smartlead_campaign_leads | 0     | **NOT SYNCED**                          |
| heyreach_campaigns       | 0     | **NOT ACTIVE**                          |
| heyreach_campaign_leads  | 0     | **NOT ACTIVE**                          |

---

## 2. CRITICAL FINDINGS

### C1: 92% of contact_activities are orphaned (CRITICAL)

**1,746 of 1,894 activity records** reference a `contact_email` that doesn't exist in the `contacts` table. The unified timeline is almost entirely disconnected from the contact database.

**Impact:** When a team member views a contact's timeline, they see almost nothing — the activities exist in the DB but can't be linked to the contact record they're viewing.

**Root cause:** PhoneBurner webhook logs activities with the phone number / email from the PhoneBurner contact, but those emails were never imported into the `contacts` table. The matching happens at webhook time — if the contact doesn't exist yet, the activity is logged but orphaned.

### C2: Outlook pipeline bottleneck — 2,033 events → 7 emails (CRITICAL)

2,033 Outlook webhook events have arrived but only 7 `email_messages` were created. The conversion rate is 0.3%.

**Impact:** Outlook emails are NOT appearing on contact/deal timelines despite the webhook integration being active and receiving events.

**Root cause likely:** The `outlook-sync-emails` function runs on webhook trigger but may be failing silently. The initial sync only completed for 1 connection with 365 days of history, but contact matching is failing because most email participants aren't in the `contacts` table.

### C3: SmartLead campaigns not syncing (HIGH)

`smartlead_reply_inbox` has 334 replies but `smartlead_campaigns`, `smartlead_campaign_leads`, and `smartlead_campaign_stats` are all empty. Campaign sync has never run.

**Impact:** Reply data exists without campaign context — can't see which campaign generated which reply, can't track campaign performance.

**Root cause:** The `sync-smartlead-messages` cron job may not be configured, or the SmartLead API key may not be set.

### C4: HeyReach not active (MEDIUM)

All 5 HeyReach tables are empty. The integration is fully built (9 edge functions, 5 hooks, 3 components) but has never been used.

**Impact:** No LinkedIn outreach tracking in the platform. LinkedIn activities are invisible.

---

## 3. Integration-by-Integration Audit

### SmartLead

| Check                      | Status   | Details                                                                          |
| -------------------------- | -------- | -------------------------------------------------------------------------------- |
| API key configured         | VERIFY   | `SMARTLEAD_API_KEY` env var required                                             |
| Webhook secret configured  | VERIFY   | `SMARTLEAD_WEBHOOK_SECRET` env var required                                      |
| Campaign sync cron running | **FAIL** | 0 campaigns synced — cron not running or API key missing                         |
| Webhook handler works      | PARTIAL  | Reply inbox has 334 rows (inbox webhook works), but event webhook table is empty |
| Push to SmartLead works    | PASS     | Frontend modal + edge function exist and are wired                               |
| Contact matching           | PASS     | By email, with unmatched queue fallback                                          |
| AI reply classification    | PASS     | 10 categories, Gemini-powered, with confidence scores                            |
| GP automation              | PASS     | Auto-creates deals, enriches phone, adds to calling list                         |
| Message sync               | **FAIL** | smartlead_messages table empty — sync not running                                |
| Dedup handling             | PASS     | UNIQUE constraints on campaign+email                                             |

### HeyReach

| Check                     | Status      | Details                                       |
| ------------------------- | ----------- | --------------------------------------------- |
| API key configured        | VERIFY      | `HEYREACH_API_KEY` env var required           |
| Webhook secret configured | VERIFY      | `HEYREACH_WEBHOOK_SECRET` env var required    |
| Integration active        | **FAIL**    | All tables empty — never used                 |
| Push to HeyReach works    | PASS (code) | Frontend modal + edge function exist          |
| LinkedIn URL requirement  | PASS        | Correctly skips contacts without LinkedIn URL |
| Contact matching          | PASS (code) | By LinkedIn URL primary, email fallback       |
| Message sync              | NOT TESTED  | No data to verify                             |

### PhoneBurner

| Check                 | Status  | Details                                                  |
| --------------------- | ------- | -------------------------------------------------------- |
| Token configured      | PASS    | 3 tokens in phoneburner_oauth_tokens                     |
| Manual token model    | PASS    | OAuth removed, manual tokens work                        |
| Push to dialer works  | PASS    | 31 sessions created, contacts pushed                     |
| Webhook handler works | PASS    | 2,261 events processed                                   |
| Contact matching      | PARTIAL | **92% orphaned** — matching fails when contact not in DB |
| Call data syncs       | PASS    | Disposition, duration, recording URL captured            |
| Session tracking      | PASS    | session_contacts JSONB stores mapping                    |
| Idempotency           | PASS    | event_id unique constraint prevents duplicates           |

### Outlook

| Check                | Status      | Details                                         |
| -------------------- | ----------- | ----------------------------------------------- |
| OAuth configured     | PASS        | Microsoft secrets set, 1 connection active      |
| Token refresh        | PASS        | Cron runs every 30 min, encrypted storage       |
| Webhook subscription | PASS        | 2,033 events received                           |
| Email sync           | **FAIL**    | Only 7 emails materialized from 2,033 events    |
| Contact matching     | **FAIL**    | Most email participants not in contacts table   |
| Unmatched queue      | PASS (code) | Queue exists but 0 rows — may not be triggering |
| Backfill mechanism   | PASS        | 1yr/3yr/5yr/10yr presets, admin UI              |
| Send from platform   | PASS (code) | outlook-send-email function exists              |
| Deal matching        | PARTIAL     | Resolves most recent deal per contact only      |

---

## 4. Use Case Results

### UC1: New Buyer → Full Outreach Sequence

- Step 1 (create contact): PASS
- Step 2 (push to SmartLead): PASS (code exists)
- Step 3 (push to HeyReach): PASS (code exists, requires LinkedIn URL)
- Step 4 (SmartLead sends → shows on contact): **FAIL** — campaign sync not running, no email timeline data
- Step 5 (HeyReach sends → shows on contact): **FAIL** — HeyReach not active
- Step 6 (reply captured): PARTIAL — reply inbox captures replies, but no campaign context
- Step 7 (LinkedIn reply): **FAIL** — HeyReach not active
- Step 8 (unified timeline): **FAIL** — 92% of activities orphaned from contact records

### UC2: SmartLead → Outlook Handoff

- Steps 1-2 (SmartLead sends/captures reply): PARTIAL — reply captured but no message history
- Steps 3-4 (Outlook reply tracked): **FAIL** — only 7 emails materialized
- Steps 5-6 (unified view): **FAIL** — data gaps on both sides

### UC3: PhoneBurner Call → Outlook Follow-up

- Steps 1-2 (call made, results sync): PASS — PhoneBurner is working
- Steps 3-4 (Outlook email tracked): **FAIL** — Outlook sync not materializing emails
- Step 5 (chronological timeline): **FAIL** — Outlook data missing

### UC4: Duplicate Contact Across Tools

- **FAIL** — No cross-tool deduplication. Each tool matches independently by different identifiers. No merge mechanism.

### UC5: Contact Linked to Multiple Deals

- SmartLead: emails linked to campaign, not specific deal (unless custom field set)
- PhoneBurner: session can store listing_id but webhook matching is by phone, not deal
- Outlook: resolves most recent deal only — **multi-deal attribution not supported**

### UC6: Bounced Email Handling

- SmartLead webhook captures bounce events (BOUNCED type)
- Bounce stored in smartlead_campaign_leads status
- **No cross-tool bounce flag** — contact isn't flagged in contacts table
- No warning when re-adding bounced contact to new campaign

### UC7: Outlook Token Expiry Mid-Sync

- Token refresh runs every 30 min (proactive)
- 3-failure threshold before marking as error
- Admin notification on error
- **PASS** — well-handled

### UC8: High-Volume SmartLead Campaign

- **Cannot verify** — campaign sync not running, no data

### UC9: HeyReach Multi-Step Sequence

- **Cannot verify** — HeyReach not active

### UC10: Pre-Deal Outreach → Deal Link

- Outlook: unmatched emails queue for later matching (**PASS** in theory, 0 rows in practice)
- SmartLead/HeyReach: no retroactive deal linking mechanism

### UC11: Team Member Leaves

- Outlook: disconnect revokes webhooks but preserves email history (**PASS**)
- PhoneBurner: activities stored with user_id, persist after deactivation (**PASS**)
- SmartLead: campaign data persists (**PASS**)

### UC12: SmartLead + Outlook Simultaneous

- **Cannot verify end-to-end** — both have data gaps

### UC13: PhoneBurner Sync Recovery

- Webhook events logged before processing (idempotent)
- event_id unique constraint prevents duplicates
- **PASS** — recovery mechanism solid

### UC14: Contact Data Mismatch

- **FAIL** — No email alias tracking. If contact's email changes, old SmartLead outreach won't match.
- Phone normalization exists (last 10 digits) but email normalization is exact match only.

### UC15: Full Lifecycle Cold → Closed

- **FAIL** — Too many gaps in SmartLead sync and Outlook pipeline to complete this flow

---

## 5. Gap Analysis — What's Missing Entirely

| Gap                                           | Impact                                                                            | Severity |
| --------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| **Unified timeline DB view**                  | No single query to get all activities for a contact across all channels           | HIGH     |
| **Cross-tool contact deduplication**          | Same person can exist as 3 separate records across tools                          | HIGH     |
| **Email alias/history tracking**              | Email changes break SmartLead matching forever                                    | MEDIUM   |
| **Cross-channel outreach conflict detection** | No warning when same person is targeted by multiple reps/campaigns simultaneously | HIGH     |
| **Engagement scoring**                        | No computed score based on cross-channel activity                                 | MEDIUM   |
| **Bounce propagation**                        | Email bounce in SmartLead doesn't flag contact in other tools                     | MEDIUM   |
| **Deal-level outreach attribution**           | SmartLead/HeyReach outreach is contact-level, not deal-level                      | MEDIUM   |
| **Unmatched message retry**                   | No automated job to reattempt matching as contacts are added                      | HIGH     |
| **Sync status dashboard**                     | No UI showing when each integration last synced successfully                      | MEDIUM   |
| **Campaign sync for SmartLead**               | Campaign/lead/stats tables all empty                                              | CRITICAL |
| **Any HeyReach data**                         | Entire integration unused                                                         | HIGH     |

---

## 6. Fix Priority List

### CRITICAL (fix immediately)

1. **Fix orphaned contact_activities** — 1,746 activities not linked to contacts. Either import the missing contacts or build a matching job that runs periodically to link activities to newly-created contacts.

2. **Fix Outlook email materialization** — 2,033 webhook events → 7 emails. Investigate why `outlook-sync-emails` is not processing events. Check logs, verify the function is being triggered, verify contact matching isn't filtering everything out.

3. **Enable SmartLead campaign sync** — Verify `SMARTLEAD_API_KEY` is set. Verify the `sync-smartlead-messages` cron is configured and running. If not, add the cron job.

### HIGH (fix this sprint)

4. **Build a contact-activity re-matching job** — Scheduled job that scans `contact_activities` where `contact_id IS NULL` and attempts to match by email/phone against current contacts table. Same for `outlook_unmatched_emails`.

5. **Create unified timeline DB view** — A single SQL view or RPC that UNIONs contact_activities, email_messages, smartlead_messages, heyreach_messages with consistent columns.

6. **Enable HeyReach** — If LinkedIn outreach is planned, verify API key is set, configure webhooks, run a test campaign.

7. **Add sync status indicators** — Show "Last synced: X min ago" on each integration's admin page.

### MEDIUM (fix next sprint)

8. **Cross-channel conflict detection** — Before pushing contacts to any tool, check all activity tables for recent touches within 14 days.

9. **Email alias tracking** — Store previous email addresses on contacts so SmartLead outreach from old emails still matches.

10. **Bounce propagation** — When SmartLead reports a bounce, flag the contact's email in the contacts table.

11. **Multi-deal attribution for Outlook** — Resolve all active deals per contact, not just most recent.

### LOW (backlog)

12. Engagement scoring across all channels
13. PDF export of cross-channel reports
14. Recording URL validation (check if PhoneBurner URLs expire)
15. Contact fatigue detection across tools
