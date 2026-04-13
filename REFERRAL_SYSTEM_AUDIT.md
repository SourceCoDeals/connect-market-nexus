# Referral Partner System — Deep Dive Audit

**Date:** 2026-04-13
**Auditor:** Claude Code
**System:** connect-market-nexus referral partner workflow

---

## System Overview

The referral system allows external partners (brokers, advisors, deal sourcers) to submit deal opportunities to SourceCo. Partners get a password-protected tracker page showing their deals' progress. Admins review submissions, approve them into the deal pipeline, and manage the deals through buyer matching and close.

---

## 10 Real-World Use Cases

### UC-1: Giuseppe Submits 30 Deals via CSV

**Business Goal:** Giuseppe (Borno Capital Partners) has a list of 30 companies from his network. He wants to batch-submit them and track progress.

**Steps:**

1. Giuseppe logs into `/referrals/{shareToken}` with his password
2. Clicks "Import Deals (CSV)" button
3. Uploads a CSV with columns: Company Name, Website, Industry, Revenue, EBITDA, Location, Contact Name, Contact Phone
4. System parses the CSV, validates fields, creates 30 `referral_submissions` with status `pending`
5. Giuseppe sees 30 "Pending" entries in his tracker

**System Test:**

- Rate limit: 50/hour → 30 submissions is under the limit. PASS
- CSV max: 100 per request → 30 is under. PASS
- Current DB: Giuseppe has 0 submissions (his 195 deals were imported directly as listings, not via the submission flow). His deals use `deal_source = 'manual'` not `'referral'` for most.

**ISSUE FOUND:** Giuseppe's 44 active listings were imported directly into the listings table (not via referral_submissions). This bypasses the submission→approval workflow. The tracker shows these as listings, but the status labels are raw internal values (`pending_referral_review`, `active`) — not partner-friendly.

---

### UC-2: Admin Approves a Referral Submission

**Business Goal:** Admin sees Giuseppe's submission for "Acme Roofing" and wants to approve it into the deal pipeline.

**Steps:**

1. Admin opens `/admin/remarketing/referral-partners/{id}`
2. Sees pending submission in the queue
3. Clicks "Approve"
4. `approve-referral-submission` edge function creates a listing with `deal_source = 'referral'`, `status = 'active'`, `referral_partner_id = {id}`
5. Listing queued for enrichment
6. Partner deal_count incremented

**System Test:**

- The listing gets `is_internal_deal: true` and `referral_partner_id` set. PASS
- Enrichment is queued if website exists. PASS
- `deal_source` is set to `'referral'`. PASS

**ISSUE FOUND:** The `approve-referral-submission` function sets `deal_source: 'referral'` (line 130), but many of Giuseppe's deals have `deal_source = 'manual'` because they were imported directly. This means reporting by deal_source would miss these referral deals.

---

### UC-3: Partner Checks Status — "Unable to Reach Owner"

**Business Goal:** Giuseppe submitted "Pella Windows (WI Dealer)". SourceCo tried to contact the owner but couldn't reach them. Giuseppe needs to see this so he can help facilitate the introduction.

**Current System State:**

- `needs_owner_contact = false` for this listing
- `main_contact_phone = null`, `main_contact_email = null`
- Status shows as raw `pending_referral_review`

**What Giuseppe Sees:** "pending_referral_review" badge — meaningless to him.

**What Giuseppe Should See:** "Unable to Reach Owner" or "Awaiting Contact" — he'd know to provide the owner's number.

**ISSUE FOUND:** The `needs_owner_contact` flag is `false` for ALL of Giuseppe's deals (even ones with no contact info). This flag isn't being set by the approval flow or enrichment process. 15 of his 37 pending deals have no contact info at all (no email AND no phone), yet `needs_owner_contact` is false.

---

### UC-4: Deal Pushed to Active — Connecting with Buyers

**Business Goal:** "Mike Hess Brewing" was approved and pushed to active deals. SourceCo is now matching it with buyers. Giuseppe wants to see this progress.

**Current System State:**

- `status = 'active'`, `pushed_to_all_deals = true`
- 8 buyer introductions exist, 0 pipeline deals
- Revenue: $12.5M, EBITDA: $4.875M

**What Giuseppe Sees:** "Active" badge — doesn't tell him buyers are being engaged.

**What Giuseppe Should See:** "Connecting with Buyers" — he'd know SourceCo is actively working the deal.

---

### UC-5: Deal in Pipeline with a Buyer — In Diligence

**Business Goal:** "Mason's Famous Lobster Rolls" has a buyer in the pipeline. This is the furthest along of Giuseppe's deals. He needs to know it's progressing.

**Current System State:**

- `status = 'active'`, `pushed_to_all_deals = true`
- 1 pipeline deal, 1 buyer introduction
- Revenue: $5.5M, EBITDA: $2M, Quality Score: 74

**What Giuseppe Sees:** "Active" badge — same as every other active deal.

**What Giuseppe Should See:** "In Diligence" — he'd know a buyer is engaged and the deal is moving.

---

### UC-6: Deactivated Partner Tries to Access Tracker

**Business Goal:** "John Paulson & Jacob Taylor" partnership ended. Their tracker should be inaccessible.

**Current System State:**

- `is_active = false`
- 0 deals, 0 submissions

**System Test:**

- `validate-referral-access` checks `is_active` on line 67-72. If false, returns `{ valid: false }`. PASS
- Partner can't login, can't submit, can't view. PASS

---

### UC-7: Lawrence (Inactive Partner with Active Deal)

**Business Goal:** Lawrence Ullman has 1 active listing but no submissions. What happens if his partner status is changed?

**Current System State:**

- `is_active = true`
- 1 listing, 0 pushed, 0 in pipeline

**ISSUE FOUND:** If Lawrence were deactivated, his 1 active listing would remain in the marketplace with no automatic cleanup. There's no mechanism to archive/flag deals when a partner is deactivated.

---

### UC-8: Partner Submits Duplicate Company

**Business Goal:** Giuseppe accidentally submits "Omega Services & Supply" twice (once via the form, once via CSV).

**Current System State:**

- There are ACTUALLY 2 listings for "Omega Services & Supply" in the DB:
  - `ccc185cf...` (score 37, created Feb 24)
  - `16567602...` (score 40, created Feb 10)
- Both have `status = 'pending_referral_review'`

**ISSUE FOUND:** No duplicate detection. The system created two separate listings for the same company. Neither the submission flow nor the approval flow checks for existing listings with the same company name from the same partner.

---

### UC-9: High-Value Deal Goes Through Full Lifecycle

**Business Goal:** Track "Saks Metering" (Alec Almond) from referral to buyer engagement — $12M revenue, $2.3M EBITDA, score 87.

**Current System State:**

- `status = 'active'`, `pushed_to_all_deals = true`
- 20 buyer introductions (most of any Giuseppe deal!)
- 0 pipeline deals yet
- Score: 87 (high quality)

**What the System Does Well:**

- Deal was enriched (enriched_at is set)
- Quality score computed (87 — strong)
- 20 buyers have been matched and introduced
- Deal is visible to partner in tracker

**What's Missing:**

- Giuseppe sees "Active" — doesn't know 20 buyers are engaged
- No visibility into which buyers are interested vs passed
- No commission tracking despite this being a high-value deal

---

### UC-10: Partner Wants to Know Overall Portfolio Performance

**Business Goal:** Giuseppe wants a summary: "How are my 44 deals doing? How many are actively being worked? How many are stuck?"

**Current System State:**

- 37 deals in `pending_referral_review` — stuck, not being actively worked
- 6 deals `active` + `pushed_to_all_deals = true` — being matched with buyers
- 1 deal `active` but not pushed — unclear status
- 1 deal in pipeline with a buyer
- 5 deals have buyer introductions
- 15 deals have no contact info at all

**What Giuseppe Sees:** A flat list of 44 deals with cryptic status badges. No summary, no grouping, no progress indicators.

**What Giuseppe Should See:** A dashboard summary:

- "37 In Review, 6 Connecting with Buyers, 1 In Diligence"
- Deals needing his help (no contact info) highlighted

---

## Status Mapping Findings

### Current Status Values in Giuseppe's Deals

| Status                  | pushed_to_all_deals | Count | What Partner Sees                    | What It Actually Means                               |
| ----------------------- | ------------------- | ----- | ------------------------------------ | ---------------------------------------------------- |
| pending_referral_review | false               | 37    | Raw string "pending_referral_review" | Admin hasn't reviewed yet OR reviewed but not pushed |
| active                  | true                | 6     | "Active"                             | Pushed to marketplace, matching with buyers          |
| active                  | false               | 1     | "Active"                             | Approved but not yet pushed                          |

### What the Derived Status SHOULD Show

| Condition                                | Derived Status         | Color   | Count |
| ---------------------------------------- | ---------------------- | ------- | ----- |
| Pipeline deal exists                     | In Diligence           | Emerald | 1     |
| Has buyer intros but no pipeline         | Connecting with Buyers | Green   | 4     |
| Active + pushed, no buyer activity       | Connecting with Buyers | Green   | 1     |
| Active, not pushed                       | In Review              | Amber   | 1     |
| pending_referral_review, has contact     | In Review              | Amber   | 22    |
| pending_referral_review, NO contact info | Unable to Reach Owner  | Red     | 15    |

---

## Critical Issues Summary

| #   | Severity   | Issue                                                                                                 |
| --- | ---------- | ----------------------------------------------------------------------------------------------------- |
| 1   | **HIGH**   | Partner sees raw internal statuses (`pending_referral_review`, `active`) instead of meaningful labels |
| 2   | **HIGH**   | `needs_owner_contact` flag is false for all deals, even 15 with NO contact info — flag not being set  |
| 3   | **HIGH**   | No buyer engagement visibility — partner can't tell if buyers are looking at their deals              |
| 4   | **HIGH**   | No pipeline/diligence visibility — partner can't tell if a buyer is actively pursuing a deal          |
| 5   | **MEDIUM** | Duplicate company detection missing — "Omega Services & Supply" appears twice                         |
| 6   | **MEDIUM** | Commission tracking not implemented — fields exist but unused                                         |
| 7   | **MEDIUM** | 36 of 37 pending deals have no email — partner can't be notified of status changes                    |
| 8   | **LOW**    | Deactivated partner's deals not auto-archived                                                         |
| 9   | **LOW**    | `deal_source` inconsistency — most of Giuseppe's deals are 'manual' not 'referral'                    |
| 10  | **LOW**    | No portfolio summary/dashboard for partners                                                           |

---

## Recommendations

### Immediate (implement now)

1. **Add derived status logic to ReferralTrackerPage** — compute from listing status + pipeline presence + buyer intros + contact info
2. **Update validate-referral-access edge function** — return `needs_owner_contact`, pipeline deal count, and buyer intro count per listing
3. **Fix `needs_owner_contact`** — set to true when listing has no contact email AND no contact phone

### Short-term

4. **Add portfolio summary** — top-of-page stats showing deal count by derived status
5. **Duplicate detection** — check for existing listings with same company name from same partner before creating
6. **Backfill deal_source** — update Giuseppe's 'manual' deals to 'referral' where referral_partner_id is set

### Medium-term

7. **Commission tracking** — wire up the existing schema fields, add UI to set rates, track payouts
8. **Partner notifications** — email partner when deal status changes (requires partner email addresses)
9. **Auto-archive on deactivation** — when partner is deactivated, archive their non-pipeline deals
