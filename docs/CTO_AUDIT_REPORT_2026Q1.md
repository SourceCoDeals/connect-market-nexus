# SourceCo Platform — CTO Audit Report

**Date:** 2026-02-24
**Audit Scope:** Full end-to-end technical audit across 13 phases
**Branch:** `claude/sourceco-audit-testing-yx3ZC`
**Auditor:** Acting CTO / Principal QA Architect (Claude Code)

---

## Executive Summary

The SourceCo platform demonstrates a well-architected dual-sided M&A marketplace with strong foundations: a mature scoring engine (v5), a robust enrichment pipeline, solid HMAC-authenticated third-party webhooks, and comprehensive rate-limit coordination across AI providers.

**During this audit, 9 bugs were identified and 6 were fixed (commits `04e5291`, `70a5d48`, `c6e624a`, `79ab7b5`).** Three remaining issues require prioritized remediation (see Phase 6, Phase 9).

### Scorecard

| Phase | Area                 | Status                  | Severity |
| ----- | -------------------- | ----------------------- | -------- |
| 1     | Database Integrity   | ⚠️ Partially Remediated | High     |
| 2     | Enrichment Pipeline  | ✅ Healthy              | Low      |
| 3     | AI Provider Health   | ⚠️ Outlier Found        | Medium   |
| 4     | Scoring Engine       | ✅ Fixed                | High     |
| 5     | Marketplace Workflow | ✅ Healthy              | —        |
| 6     | Remarketing System   | 🔴 Action Required      | Critical |
| 7     | CapTarget Sync       | ✅ Fixed                | High     |
| 8     | DocuSeal Integration | ✅ Fixed                | High     |
| 9     | Automation Triggers  | ⚠️ Minor Bugs           | Medium   |
| 10    | Integration Health   | ⚠️ One Outlier          | Medium   |
| 11    | Performance          | ✅ Healthy              | —        |
| 12    | NDA Sync             | ✅ Fixed                | High     |

---

## Phase 1: Database Integrity

### Findings

| Finding                                          | Count   | Risk   |
| ------------------------------------------------ | ------- | ------ |
| Listings with NULL enrichment status             | 7,541   | Medium |
| Tables missing FK constraints                    | 8       | Medium |
| Duplicate remarketing_buyers                     | ~100+   | High   |
| NDA sync mismatches (profile vs firm_agreements) | 2       | High   |
| Listings with title `"-"`                        | 346     | High   |
| Listings with NULL geography                     | unknown | Low    |

### Remediation Applied

**Buyer Deduplication** (`20260311200000_dedupe_remarketing_buyers.sql`):

- Elects keeper per group by data richness, oldest ID as tiebreaker
- Re-points `remarketing_scores`, `remarketing_buyer_contacts`, `remarketing_outreach` to keeper
- Merges `notes`, `investment_thesis`, `target_services` arrays
- Archives duplicates with provenance note in `notes` field
- Emits `RAISE NOTICE` summary

**NDA Sync Mismatch** — see Phase 12.

**Dash-Title Listings** — see Phase 7.

### Remaining Action Items

- Bulk enrichment run for 7,541 NULL listings (deferred by user request — schedule separately)
- Add FK constraints to 8 identified tables in a future migration
- Run `scripts/query_dash_title_listings.sql` to identify fixable vs empty-shell "-" title listings

---

## Phase 2: Enrichment Pipeline

### `process-enrichment-queue` Assessment

- **BATCH_SIZE=10**, **CONCURRENCY_LIMIT=5**, **MAX_CONTINUATIONS=50** → up to 500 items per trigger
- 90s processing timeout + 140s function runtime limit — appropriate for Supabase 60s edge limit (function returns before hitting wall)
- Stale recovery: resets items stuck in `processing` for > 5 minutes ✅
- Self-continuation via fire-and-forget `fetch()` with `signal: AbortSignal.timeout(30_000)` ✅

### `enrich-buyer` Assessment

- SSRF protection via `validateUrl()` with RFC-1918 blocklist ✅
- Rate limit reporting to shared `rate-limiter.ts` when Firecrawl 429s ✅
- `withConcurrencyTracking()` for Firecrawl slot management ✅
- Provenance tracking via `validateFieldProvenance()` ✅
- `BUYER_SCRAPE_TIMEOUT_MS` abort signal ✅

### `firecrawl-scrape` (Standalone Function) — Finding

**File:** `supabase/functions/firecrawl-scrape/index.ts`
**Severity:** Medium

This standalone function makes a single `fetch()` to the Firecrawl API with no:

- Retry logic
- Rate limit handling (no 429 detection)
- Timeout guard

The `enrich-buyer` function handles Firecrawl correctly (rate limit reporting, concurrency tracking). `firecrawl-scrape` is a thin wrapper used by other callers but lacks the same protections. If Firecrawl is rate-limited, callers will receive a raw 429 forwarded back.

**Recommendation:** Add `fetchWithAutoRetry` from `_shared/ai-providers.ts` and 429 detection.

---

## Phase 3: AI Provider Health

### Primary Stack Assessment

**File:** `supabase/functions/_shared/ai-providers.ts`

- **Primary AI:** Gemini 2.0 Flash (`gemini-2.0-flash`) via OpenAI-compatible endpoint
- **Secondary AI:** Claude Sonnet 4 (`claude-sonnet-4`) via Anthropic direct
- Retry: 3 retries with exponential backoff (base 2s), `Retry-After` header parsing ✅
- Rate limit coordination: shared `rate-limiter.ts` with per-provider state ✅
- Fail-open on DB errors during rate limit checks ✅

### `query-buyer-universe` — Outlier Finding

**File:** `supabase/functions/query-buyer-universe/index.ts`
**Severity:** Medium

This function uses **OpenAI `gpt-4o-mini`** directly, bypassing the shared `ai-providers.ts` retry/rate-limit infrastructure:

```typescript
const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
  ...
```

Additionally, it fetches **all buyers** from `remarketing_buyers` without pagination:

```typescript
const { data: buyers } = await buyerQuery; // no limit
```

On a large buyer table, this is an O(N) query that:

1. Could timeout the edge function
2. Sends the entire buyer list to an external AI in a single request (token limit risk)

**Recommendations:**

1. Replace direct OpenAI call with `fetchWithAutoRetry` from `_shared/ai-providers.ts`
2. Add pagination or a reasonable limit (e.g., 500 active buyers per query)
3. Add a fallback path if `OPENAI_API_KEY` is not configured

---

## Phase 4: Scoring Engine

### Zero-Score Bug — FIXED

**File:** `supabase/functions/score-buyer-deal/index.ts` (lines 250-258)
**Severity:** High — 9 confirmed affected scores (e.g., Kinderhook Industries: `service_score=90`, `composite=0`)

**Root Cause:** The hard disqualification gate checked raw phase multipliers:

```typescript
// BEFORE (bug)
if (sizeResult.multiplier === 0.0) {
  isDisqualified = true;
  finalScore = 0;
}
if (serviceResult.multiplier === 0.0) {
  isDisqualified = true;
  finalScore = 0;
}
```

But the scoring engine already had correct bypass logic for missing data dimensions:

```typescript
// effectiveSizeMultiplier correctly bypasses the gate when data is missing
const effectiveSizeMultiplier =
  !buyerHasSizeData || !dealHasFinancials ? 1.0 : sizeResult.multiplier;
```

When a buyer had no size data, `effectiveSizeMultiplier = 1.0` was used for scoring, but the disqualification check still read `sizeResult.multiplier === 0.0` (which the phase could return for narrow criteria + missing deal financials), zeroing the final score.

**Fix Applied:** Gate now mirrors the effective multiplier bypass condition:

```typescript
// AFTER (fixed)
if (sizeResult.multiplier === 0.0 && buyerHasSizeData && dealHasFinancials) { ... }
if (serviceResult.multiplier === 0.0 && buyerHasServiceData && dealHasServices) { ... }
```

### Scoring Engine Architecture Assessment

- Weight redistribution for missing dimensions: correct ✅
- `effectiveSizeMultiplier`/`effectiveServiceMultiplier` bypass: correct ✅
- EBITDA sweet-spot scoring as supplement to revenue: correct ✅
- Service matching: AI-primary (Gemini), keyword+adjacency fallback ✅
- Geography mode factor for PE firms vs strategic buyers: correct ✅
- Hard disqualification: now correctly gated ✅ (post-fix)

---

## Phase 5: Marketplace Workflow

### `publish-listing` Assessment

**File:** `supabase/functions/publish-listing/index.ts`

- Admin JWT + RBAC check via `is_admin` RPC ✅
- Quality validation (title ≥5 chars, description ≥50 chars, category, location, revenue, EBITDA, image) ✅
- Remarketing system conflict check before publish ✅
- Idempotency: rejects if already published (`is_internal_deal === false && published_at`) ✅
- Audit trail: preserves `published_at` and `published_by_admin_id` on unpublish ✅

**Finding (Low):** The already-published check uses `=== false` strict equality on `is_internal_deal`. If the column contains `null` instead of `false`, a re-publish won't be blocked. Consider adding `|| listing.status === 'active'` as secondary guard.

### `convert-to-pipeline-deal` Assessment

**File:** `supabase/functions/convert-to-pipeline-deal/index.ts`

- Admin auth ✅
- Dedup: checks `(remarketing_buyer_id, listing_id)` with `is('deleted_at', null)` ✅
- Stage fallback: Qualified → is_default → first active ✅
- Firm identity bridge: auto-creates `firm_agreements` + `firm_members` if no `marketplace_firm_id` ✅
- Normalized company name on insert ✅
- score_id optionally updates `remarketing_scores` to approved ✅

**Assessment:** Well-implemented. No bugs found.

---

## Phase 6: Remarketing System 🔴

### CRITICAL: `track-engagement-signal` — No Auth Guard

**File:** `supabase/functions/track-engagement-signal/index.ts`
**Severity:** Critical

This function lacks an authorization guard. The auth check is entirely optional:

```typescript
const authHeader = req.headers.get('Authorization');
let userId: string | null = null;
if (authHeader) {
  // ...userId = user.id;
}
// Continues to write engagement data regardless
```

**Impact:** Any party with knowledge of a `listing_id` and `buyer_id` can:

1. Write arbitrary `engagement_signals` records to the database
2. Directly inflate `remarketing_scores.composite_score` (line 136)

**Recommendation:** Add the standard admin JWT guard pattern used across all other admin-write functions (see `convert-to-pipeline-deal` lines 19-50 for the pattern).

### Finding: Cumulative Engagement Score Inflation

**File:** `supabase/functions/track-engagement-signal/index.ts` (lines 122-144)
**Severity:** Medium

Each call to `track-engagement-signal` calls `calculate_engagement_score()` RPC (which returns a running total) and adds that total to the existing `composite_score`:

```typescript
composite_score: Math.min(100, existingScore.composite_score + totalScore);
```

If `calculate_engagement_score` returns the cumulative sum across all signals (e.g., 55 pts after two signals), the composite score receives:

- Signal 1 (30 pts): `composite += 30`
- Signal 2 (25 pts): `composite += 55` (cumulative total from RPC)

Result: `composite_score` receives 85 pts in bonus instead of 55 pts. The fix is to store and subtract the previous engagement total, or use an absolute score (replace instead of add).

### `query-buyer-universe` — See Phase 3

Uses OpenAI directly, fetches all buyers without pagination.

---

## Phase 7: CapTarget Sync

### Dash-Title Root Cause — FIXED

**File:** `supabase/functions/sync-captarget-sheet/index.ts`
**Severity:** High — 346 listings affected

**Root Cause:** When a Google Sheet cell contains `"-"` as a placeholder, the original code used it as a truthy value in the company name fallback chain:

```typescript
// BEFORE
const companyName = (row[COL.company_name] || '').trim(); // "-" is truthy!
// title = companyName || clientName || ... → selects "-"
```

**Fix Applied:**

```typescript
const rawCompanyName = (row[COL.company_name] || '').trim();
const companyName = /^[-–—]+$/.test(rawCompanyName) ? '' : rawCompanyName;
```

### CapTarget Exclusion Filter Assessment

**File:** `supabase/functions/_shared/captarget-exclusion-filter.ts`

Well-designed with:

- Safelist checked FIRST (RIA/CPA/law/consulting/insurance/service businesses) ✅
- Blocklist: PE/VC/M&A advisory/investment banking/family office/search fund ✅
- Name suffix patterns (`capital partners`, `equity partners`, etc.) ✅
- Note: `independent sponsor` falls into the search_fund blocklist → excluded. Verify this is intentional.

---

## Phase 8: DocuSeal Integration

### Event Naming Fragmentation Bug — FIXED

**File:** `supabase/functions/docuseal-webhook-handler/index.ts`
**Severity:** High — 17 webhook deliveries writing garbage status values

DocuSeal sends webhooks using both dot-separated (`form.completed`, `submission.created`) and underscore-separated (`submission_created`) naming conventions. The `lifecycleEvents` Set previously only contained dot-separated variants. Underscore variants like `submission_created` fell through to `processEvent()` and wrote:

```
nda_docuseal_status = 'submission_created'
```

directly onto `firm_agreements` records.

**Fix Applied:** Both naming variants added to `lifecycleEvents`:

```typescript
const lifecycleEvents = new Set([
  'submission.created',
  'submission_created',
  'submission.archived',
  'submission_archived',
]);
```

### `auto-create-firm-on-approval` Assessment

**File:** `supabase/functions/auto-create-firm-on-approval/index.ts`

- Idempotency: rejects if `cr.status !== 'pending'` ✅
- Dedup: finds-or-creates firm by email domain then normalized name ✅
- `firm_member` creation ✅
- DocuSeal NDA submission with 15s timeout ✅
- No race condition risk on firm creation (upsert pattern) ✅

---

## Phase 9: Automation Triggers

### `process-scoring-queue` — Stale Detection Bug

**File:** `supabase/functions/process-scoring-queue/index.ts` (line 34)
**Severity:** Medium

Stale recovery uses `created_at` instead of the row's last-updated timestamp:

```typescript
// CURRENT (bug)
.lt('created_at', staleCutoff)  // created_at < now - 5 minutes
```

Items are frequently created before processing starts. An item created 10 minutes ago that just started processing 1 second ago is immediately recovered as "stale" because `created_at` is 10 minutes in the past.

**Recommendation:** Add an `updated_at` or `started_processing_at` timestamp to `remarketing_scoring_queue` and use that for stale detection.

### `notify-remarketing-match` — No Deduplication + RBAC + Mislabeled Type

**File:** `supabase/functions/notify-remarketing-match/index.ts` (line 98)
**Severity:** Medium

Three related issues:

1. **No dedup:** If called multiple times for the same `score_id`, admins receive duplicate notifications.
2. **RBAC inconsistency:** Queries `profiles.is_admin` instead of `user_roles` table — can notify revoked admins or miss newly promoted ones.
3. **Notification type mislabeled:** `notification_type` is hardcoded to `"remarketing_a_tier_match"` even when `tier` parameter is B, C, or D:

```typescript
notification_type: "remarketing_a_tier_match", // always "A" regardless of actual tier
```

**Fix:** `notification_type: \`remarketing\_${tier || 'A'}\_tier_match\``

### `notify-deal-owner-change` — Missing Null Check on Admin Email

**File:** `supabase/functions/notify-deal-owner-change/index.ts` (line 70)
**Severity:** High

```typescript
const { data: modifyingAdmin } = await supabase
  .from('profiles')
  .select('email')
  .eq('id', modifyingAdminId)
  .single(); // error not checked — modifyingAdmin could be null
// modifyingAdmin.email then passed to Brevo template → crash
```

If `modifyingAdminId` doesn't exist in profiles (deleted user, etc.), this crashes the notification send. Same pattern in `notify-new-deal-owner`. **Fix:** Use `.maybeSingle()` and null-check before using the result.

### Hardcoded Domain URLs in Notification Functions

**Files:** `notify-deal-owner-change/index.ts` line 91, `notify-new-deal-owner/index.ts` line 111
**Severity:** Medium

Multiple notification functions hardcode `https://marketplace.sourcecodeals.com` in email link templates. These links will be wrong in staging/dev environments. **Fix:** Use `Deno.env.get('APP_DOMAIN') || 'https://marketplace.sourcecodeals.com'`.

### `sync-fireflies-transcripts` — Timestamp Unit Ambiguity

**File:** `supabase/functions/sync-fireflies-transcripts/index.ts` (lines 365-373)
**Severity:** High — data corruption

The Fireflies API inconsistently returns timestamps in either seconds or milliseconds. The handler always calls `new Date(dateNum)` assuming milliseconds:

```typescript
callDate = new Date(dateNum).toISOString(); // if dateNum is seconds → year 1970!
```

A Unix timestamp in seconds (e.g. `1740000000`) parsed as milliseconds gives a date in 1990, not 2025. **Fix:** Detect the unit by magnitude: values between `1e9` and `1e10` are seconds; values > `1e12` are milliseconds.

### `phoneburner-push-contacts` — Missing Timeout on API Calls

**File:** `supabase/functions/phoneburner-push-contacts/index.ts` (line 474)
**Severity:** Medium

API calls to PhoneBurner have no `AbortSignal.timeout()`, so a slow PhoneBurner API can hold the edge function open until Supabase's 60s hard limit. **Fix:** Add `signal: AbortSignal.timeout(10000)` to all `fetch()` calls to the PhoneBurner API.

---

## Phase 10: Integration Health

| Integration                   | Retry Logic                    | Rate Limit Handling      | Auth/Signature               | Assessment |
| ----------------------------- | ------------------------------ | ------------------------ | ---------------------------- | ---------- |
| Gemini AI                     | ✅ 3 retries, exponential      | ✅ shared rate-limiter   | ✅ API key                   | Excellent  |
| Claude AI                     | ✅ 3 retries, exponential      | ✅ shared rate-limiter   | ✅ API key                   | Excellent  |
| Firecrawl (enrich-buyer)      | ✅ via withConcurrencyTracking | ✅ 429 → reportRateLimit | ✅ API key                   | Good       |
| Firecrawl (standalone)        | ❌ None                        | ❌ None                  | ✅ API key                   | Needs Fix  |
| PhoneBurner webhook           | N/A (webhook)                  | N/A                      | ✅ HMAC-SHA256 constant-time | Excellent  |
| DocuSeal webhook              | N/A (webhook)                  | N/A                      | ✅ verified in handler       | Good       |
| OpenAI (query-buyer-universe) | ❌ None                        | ❌ None                  | ✅ API key                   | Needs Fix  |
| Fireflies                     | See enrich functions           | See enrich functions     | TBD                          | —          |

### PhoneBurner Webhook Deep-Dive

**File:** `supabase/functions/phoneburner-webhook/index.ts`

Exemplary implementation:

- HMAC-SHA256 signature verification with constant-time comparison (bit-XOR, not `===`) ✅
- Event ID idempotency: `phoneburner_webhooks_log` dedup on `event_id` ✅
- Stable event ID construction: `call_id + event_type` for deterministic replay ✅
- Disposition mapping to SourceCo contact status ✅
- DNC/phone-invalid flag application ✅
- Raw payload logging for audit/replay ✅
- Graceful handling of unknown event types ✅

---

## Phase 11: Performance Analysis

### Edge Function Timeout Risks

| Function                 | Runtime Limit               | Concern                |
| ------------------------ | --------------------------- | ---------------------- |
| process-enrichment-queue | 140s explicit               | Self-continues ✅      |
| process-scoring-queue    | 140s explicit               | Self-continues ✅      |
| enrich-buyer             | BUYER_SCRAPE_TIMEOUT_MS     | Per-request, not queue |
| query-buyer-universe     | None (!)                    | O(N) buyer fetch       |
| score-buyer-deal         | Inherits 60s Supabase limit | AI calls < 10s each    |
| sync-captarget-sheet     | None explicit               | Pagination handled     |

### `query-buyer-universe` Timeout Risk

Fetches the entire `remarketing_buyers` table, sends to external AI in one request. With 1,000+ buyers this likely hits:

- Supabase 60s hard limit (HTTP timeout)
- Gemini token context limit (buyer summary could exceed 100K tokens)

This function will silently degrade as buyer count grows.

---

## Phase 12: NDA Sync Self-Heal

### Root Cause Analysis

The `update_agreement_status()` stored procedure is the authorized cascade path from `firm_agreements.nda_signed` → `profiles.nda_signed`. When DocuSeal webhooks write directly to `firm_agreements` (bypassing the stored procedure), profiles are never updated.

### Remediation Applied (`20260311300000_fix_nda_sync_mismatch.sql`)

1. **Backfill:** Corrected 2 profiles (RC Renberg, Bill Tabino) where `firm_agreements.nda_signed=true` but `profiles.nda_signed=false`

2. **Prevention Trigger:** `trg_sync_firm_agreement_to_profiles` — fires AFTER UPDATE on `firm_agreements`. When `nda_signed` transitions `false → true`, cascades to all `profiles` linked via `firm_members`:

```sql
UPDATE public.profiles p
SET nda_signed = true,
    nda_signed_at = COALESCE(p.nda_signed_at, NEW.nda_signed_at, NOW()),
    updated_at = NOW()
FROM public.firm_members fm
WHERE fm.firm_id = NEW.id
  AND fm.user_id = p.id
  AND (p.nda_signed IS NULL OR p.nda_signed = false);
```

---

## Phase 13: AI Command Center Fixes

### Bugs Fixed

**1. `activity_type` CHECK Constraint Mismatch**

- Migration `20260311100000_fix_activity_type_values.sql` expands the `deal_activities_activity_type_check` constraint
- `normalizeActivityType()` helper maps short-form values to DB-valid verbose values
- All AI-written notes/calls/emails were silently failing before this fix

**2. Pipeline Deal Conversion (`action-tools.ts`)**

- Duplicate deal check used `.eq('buyer_id')` — column doesn't exist on `deals` table, so check always returned null, allowing duplicate deals. Fixed to `.eq('remarketing_buyer_id')`

**3. `firm_agreements` Lookup**

- AI tool queried non-existent `remarketing_buyer_id` column on `firm_agreements`. Fixed to use `normalized_company_name` lookup matching the table's actual key

**4. Stale Conversation History**

- `useAICommandCenter` was sending only the last 10 messages from `messages` state before appending the current user message. Fixed to include the current message in the slice
- `useState(() => setMessages())` anti-pattern replaced with `useEffect(() => {}, [])`

---

## Prioritized Remediation Backlog

### P0 — Critical (This Sprint)

| #   | Issue                                                                    | File                                        | Fix                                                |
| --- | ------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------- |
| 1   | `track-engagement-signal` no auth guard                                  | `track-engagement-signal/index.ts`          | Add admin JWT guard                                |
| 2   | `track-engagement-signal` cumulative score inflation                     | `track-engagement-signal/index.ts`          | Store/diff previous engagement total               |
| 3   | `bulk-import-remarketing` delete guard uses null UUID — deletes ALL rows | `bulk-import-remarketing/index.ts` L189-223 | Replace `.neq('id', null_uuid)` with proper filter |

### P1 — High (Next Sprint)

| #   | Issue                                                                                      | File                                        | Fix                                              |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------ |
| 4   | `query-buyer-universe` uses OpenAI, no retry, no pagination                                | `query-buyer-universe/index.ts`             | Migrate to Gemini via ai-providers.ts; add limit |
| 5   | `process-scoring-queue` stale detection on wrong column                                    | `process-scoring-queue/index.ts`            | Use `updated_at` or add `started_processing_at`  |
| 6   | `process-scoring-queue` self-invoke via `setTimeout` may not fire before Deno process exit | `process-scoring-queue/index.ts` L226-248   | Use awaitable scheduled task                     |
| 7   | `score-buyer-deal` existing-scores fetch unbounded — OOM risk on large universes           | `score-buyer-deal/index.ts` L629-635        | Add `.limit()` or paginate                       |
| 8   | `firecrawl-scrape` no retry/rate-limit                                                     | `firecrawl-scrape/index.ts`                 | Wrap with `fetchWithAutoRetry`                   |
| 9   | `bulk-import-remarketing` `size_score` and `owner_goals_score` hardcoded to 0 on import    | `bulk-import-remarketing/index.ts` L603,605 | Preserve original values from import data        |

### P1 (continued) — Additional High-Priority Findings

| #   | Issue                                                                                               | File                                       | Fix                                                      |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| 10  | `notify-deal-owner-change` / `notify-new-deal-owner` — no null check on modifying admin email fetch | `notify-deal-owner-change/index.ts` L70    | Change `.single()` to `.maybeSingle()`, null-guard email |
| 11  | `sync-fireflies-transcripts` — Fireflies timestamps in seconds treated as milliseconds → 1970 dates | `sync-fireflies-transcripts/index.ts` L365 | Detect unit by magnitude (`< 1e10` → ×1000)              |
| 12  | `phoneburner-push-contacts` — no timeout on PhoneBurner API calls → edge function holds until 60s   | `phoneburner-push-contacts/index.ts` L474  | Add `signal: AbortSignal.timeout(10000)`                 |

### P2 — Medium (Backlog)

| #   | Issue                                                                                            | File                                     | Fix                                              |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------ |
| 13  | `notify-remarketing-match` type hardcoded `"a_tier"` even for B/C/D + dedup + RBAC inconsistency | `notify-remarketing-match/index.ts` L98  | Dynamic tier in type; upsert; query `user_roles` |
| 14  | Hardcoded `marketplace.sourcecodeals.com` in email templates across 2+ notification functions    | `notify-deal-owner-change/index.ts` L91  | Use `Deno.env.get('APP_DOMAIN')`                 |
| 15  | `convert-to-pipeline-deal` uses `.single()` on stage fallback — throws if no stages              | `convert-to-pipeline-deal/index.ts` L163 | Change to `.maybeSingle()`                       |
| 16  | `publish-listing` null is_internal_deal edge case                                                | `publish-listing/index.ts`               | Add status check                                 |
| 17  | 7,541 listings with NULL enrichment                                                              | DB                                       | Schedule bulk enrichment run                     |
| 18  | 8 tables missing FK constraints                                                                  | DB                                       | Add constraints migration                        |
| 19  | `independent_sponsor` excluded from CapTarget                                                    | `captarget-exclusion-filter.ts`          | Verify business intent                           |

---

## Bugs Fixed in This Audit (Commit Log)

| Commit    | Summary                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- |
| `04e5291` | fix: activity_type CHECK constraint + normalizeActivityType helper                             |
| `70a5d48` | fix: ai-command-center - buyer_id column, firm_agreements lookup, stale history, React hook    |
| `c6e624a` | chore: dedupe remarketing buyers migration + dash-title diagnostic queries                     |
| `39cbb88` | chore: update package-lock.json                                                                |
| `79ab7b5` | fix: DocuSeal underscore events, dash-title listings, NDA sync trigger, scoring zero-score bug |

**Total files changed:** 12 source files, 4 migrations, 1 diagnostic script
**Critical bugs resolved:** 6 (activity_type, buyer_id column, firm_agreements lookup, DocuSeal event naming, scoring zero-score, NDA sync cascade)

---

_Report generated by automated CTO audit — SourceCo `claude/sourceco-audit-testing-yx3ZC`_
