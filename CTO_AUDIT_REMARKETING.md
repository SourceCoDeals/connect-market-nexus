# CTO Audit: Remarketing & Buyer-Deal Scoring System

**Date:** 2026-02-23
**Scope:** Remarketing pipeline, buyer-deal scoring engine, enrichment functions, buyer management frontend, database schema
**System Size:** ~40 edge functions, 19 migrations, 2,158-line scoring engine, ~15 React components/pages

---

## Executive Summary

The remarketing system implements a sophisticated multi-dimensional buyer-deal matching engine with AI-augmented scoring, bulk import/export capabilities, and an enrichment pipeline. The architecture is functional but has accumulated significant technical debt, particularly around the monolithic scoring engine, inconsistent authentication patterns, and missing test coverage for critical business logic.

**One code bug was identified and fixed during this audit** (swapped geography mode constant names).

### Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 2 | Identified, 1 fixed |
| High | 10 | Identified |
| Medium | 13 | Identified |
| Low | 8 | Identified |

---

## 1. CRITICAL FINDINGS

### 1.1 [FIXED] Swapped Geography Mode Constant Names
**File:** `supabase/functions/score-buyer-deal/index.ts:160-161, 565-577`
**Status:** Fixed in this audit

The `SCORING_CONFIG` constants `GEO_MODE_CRITICAL` and `GEO_MODE_PREFERRED` had semantically inverted names:

```typescript
// BEFORE (wrong constant names):
GEO_MODE_CRITICAL: 0.6,    // Named "critical" but value is for "preferred"
GEO_MODE_PREFERRED: 0.25,  // Named "preferred" but value is for "minimal"

case 'preferred':
  modeFactor = SCORING_CONFIG.GEO_MODE_CRITICAL;   // Wrong name, right value
case 'minimal':
  modeFactor = SCORING_CONFIG.GEO_MODE_PREFERRED;  // Wrong name, right value
```

```typescript
// AFTER (correct):
GEO_MODE_PREFERRED: 0.6,
GEO_MODE_MINIMAL: 0.25,

case 'preferred':
  modeFactor = SCORING_CONFIG.GEO_MODE_PREFERRED;
case 'minimal':
  modeFactor = SCORING_CONFIG.GEO_MODE_MINIMAL;
```

**Impact:** The runtime numeric values (0.6 for preferred, 0.25 for minimal) were correct, so scoring results were unaffected. However, the naming inversion was a maintenance hazard -- any developer adjusting "the critical mode factor" would change the wrong constant.

### 1.2 No Authentication on `calculate-buyer-quality-score` and `notify-remarketing-match`
**Files:** `supabase/functions/calculate-buyer-quality-score/index.ts`, `supabase/functions/notify-remarketing-match/index.ts`

Neither function validates the caller's JWT or checks admin privileges:
- `calculate-buyer-quality-score`: Accepts any `profile_id` and computes/stores buyer quality scores with no auth
- `notify-remarketing-match`: Accepts any `score_id`/`buyer_id`/`listing_id` and sends notifications with no auth

**Risk:** Any caller who knows the function URL can trigger scoring computations or spam notifications. These endpoints use `SUPABASE_SERVICE_ROLE_KEY` internally, so they bypass RLS entirely.

**Recommendation:** Add JWT validation + admin role check, consistent with the pattern used in `chat-remarketing` (lines 33-52) and `bulk-import-remarketing`.

---

## 2. HIGH SEVERITY FINDINGS

### 2.1 Monolithic Scoring Engine (2,158 lines, single file)
**File:** `supabase/functions/score-buyer-deal/index.ts`

The entire scoring engine lives in one file containing:
- 5 scoring phases (size, geography, service, owner goals, thesis)
- AI call logic (Gemini API integration)
- Bulk scoring orchestration
- Service adjacency map (~20 families hardcoded)
- Configuration constants
- Database operations + snapshot management
- Learning penalty calculations

**Impact:**
- Impossible to unit test individual phases in isolation
- High merge conflict risk (every scoring change touches this file)
- Difficult to reason about control flow
- No separation between business logic and I/O

**Recommendation:** Extract into modules:
```
score-buyer-deal/
  index.ts           (HTTP handler + orchestration)
  phases/
    size.ts
    geography.ts
    service.ts
    owner-goals.ts
    thesis.ts
  lib/
    adjacency-map.ts
    composite.ts
    ai-client.ts
    snapshot.ts
```

### 2.2 Pervasive `any` Typing in Scoring Engine
**File:** `supabase/functions/score-buyer-deal/index.ts` -- **55 occurrences of `: any`**

All core scoring functions use untyped parameters:
```typescript
async function calculateGeographyScore(listing: any, buyer: any, tracker: any, ...)
async function calculateServiceScore(listing: any, buyer: any, tracker: any, ...)
async function calculateSizeScore(listing: any, buyer: any, tracker: any, ...)
```

**Impact:** Misspelled field names, missing fields, or schema changes are not caught at compile time. With 5 scoring phases each reading different buyer/listing fields, a single field rename could silently break scoring without any compiler warning.

**Recommendation:** Define strict TypeScript interfaces for `Listing`, `Buyer`, `Tracker`, and `ScoreResult` types.

### 2.3 Zero Test Coverage for Server-Side Scoring Engine
**Finding:** No test files exist for `score-buyer-deal/index.ts`. The only scoring test found is `src/lib/deal-scoring-v5.test.ts`, which tests a separate client-side deal quality scorer.

The 2,158-line scoring engine with 5 phases, AI fallbacks, weight redistribution, multiplier gates, and tier determination has no automated tests.

**Impact:** Regressions in scoring logic (which directly determines which buyers see which deals) would go undetected until noticed by users.

**Recommendation:** Priority test cases:
1. Size scoring edge cases (at boundary, below range, above range)
2. Geography mode factor application (critical/preferred/minimal)
3. Weight redistribution when data is missing
4. Multiplier gate behavior (score 0 = 0x multiplier)
5. Tier determination boundaries (A/B/C/D/F)
6. AI fallback behavior (mock Gemini failures)

### 2.4 Service Key Passed in HTTP Headers Between Edge Functions
**Files:** `process-buyer-enrichment-queue/index.ts`, `process-enrichment-queue/index.ts`, `process-scoring-queue/index.ts`

Queue processors call other edge functions with the service role key as a Bearer token:
```typescript
headers: {
  'Authorization': `Bearer ${supabaseServiceKey}`,
}
```

**Risk:** If any intermediate logging, error reporting, or proxy captures these headers, the service role key (which bypasses all RLS) is exposed.

**Recommendation:** Use `supabase.functions.invoke()` which handles auth internally, or implement short-lived internal service tokens.

### 2.5 No Input Size Validation on Batch Operations
**File:** `calculate-buyer-quality-score/index.ts:308-379`

```typescript
const batchLimit = body.batch_limit || 30; // No upper bound!
```

An attacker could send `{ batch_all_unscored: true, batch_limit: 1000000 }` to cause memory exhaustion.

Similarly, `bulk-import-remarketing` accepts up to 10,000 buyers and 50,000 contacts per import with no rate limiting between imports.

**Recommendation:** Cap batch sizes (`Math.min(body.batch_limit || 30, 500)`) and add cooldown between bulk operations.

### 2.6 Race Condition in Enrichment Locking
**File:** `enrich-buyer/index.ts:264-302`

The enrichment lock uses a non-atomic read-then-write pattern:
1. Read `data_last_updated` timestamp
2. Check if within 15-second window
3. Write new timestamp to claim lock

Two concurrent requests can both read the old timestamp and both proceed, causing duplicate Firecrawl API calls (doubled cost) and non-deterministic final state.

**Recommendation:** Use atomic compare-and-set: `UPDATE ... SET data_last_updated = $new WHERE data_last_updated = $old` and check affected row count.

### 2.7 AI Fallback Frequency Not Tracked
**File:** `supabase/functions/score-buyer-deal/index.ts`

When AI scoring (Gemini) fails, the system silently falls back to rules-based scoring with only a `console.warn`. There is no persistent record of how often AI fallback occurs, which phase failed, or whether fallback frequency is increasing.

**Impact:** Systematic AI unavailability would degrade scoring quality without any alerting.

**Recommendation:** Record AI fallback events in the `enrichment_events` table or a dedicated metrics table.

---

## 3. MEDIUM SEVERITY FINDINGS

### 3.1 Legacy Table Duplication
**File:** `supabase/migrations/20260206170000_scoring_system_v2_schema.sql`

The migration adds scoring v2 columns to both `remarketing_scores` AND `buyer_deal_scores` (annotated as "legacy" in migration comments). Both tables carry the same columns, creating ambiguity about which is the source of truth.

### 3.2 Hardcoded Service Adjacency Map
**File:** `supabase/functions/score-buyer-deal/index.ts`

The service adjacency map (~20 service families) is hardcoded as a constant, while the schema supports per-universe custom adjacency maps via `tracker.service_adjacency_map`. Adding/modifying adjacency relationships requires a code deployment.

### 3.3 Overpermissive CORS Pattern for Lovable Previews
**File:** `supabase/functions/_shared/cors.ts:35`

```typescript
if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/.test(origin)) return true;
```

Allows ANY Lovable preview domain, not just this project's previews. Lower risk since most endpoints require authentication, but weakens defense in depth.

### 3.4 Console Logging of Sensitive Data in Production
**Files:** `score-buyer-deal/index.ts` (23 console.log/warn), `enrich-deal/index.ts`, `enrich-buyer/index.ts`

Production edge functions log full AI responses including extracted PII, buyer geographic details, service matches, and error stack traces with database column names.

### 3.5 No Dead Letter Queue for Failed Scoring Jobs
**File:** `supabase/functions/process-scoring-queue/index.ts`

Failed scoring queue items have no maximum retry limit. A persistently failing score will be retried indefinitely on each queue run.

### 3.6 Enrichment Timeout Budget Mismatch
**File:** `enrich-buyer/index.ts`

Firecrawl scrape timeout (120s) + AI processing leaves only 20s headroom within the 140s function max runtime. If scraping takes close to its timeout, AI processing will fail, leaving the buyer partially enriched.

### 3.7 No Audit Trail for Destructive Bulk Operations
**File:** `bulk-import-remarketing/index.ts:156-254`

The `clear` action deletes ALL remarketing data with only a console log. No audit table entry records who cleared, when, or why.

### 3.8 Sensitive Data in Bulk Import Error Responses
**File:** `bulk-import-remarketing/index.ts:689-691`

Error responses include raw validation messages containing buyer names, field names, and database constraint details.

---

## 4. LOW SEVERITY FINDINGS

### 4.1 Silent JSON Parsing in Bulk Import
`parseJson()` silently returns `null` on parse failure. Users won't know their JSONB fields were silently dropped.

### 4.2 PII in Notification Response Body
`notify-remarketing-match` response includes `buyer.company_name`, `listing.title`, and `composite_score`.

### 4.3 Rate Limit Implementation Uses Row Counting
Rate limiting counts rows in `user_activity` (up to 500 per check). A counter-based approach would be more efficient.

### 4.4 Queue Self-Continuation Skipped on Rate Limit
When Gemini is rate-limited, the queue processor stops without scheduling delayed self-continuation. Pending items wait for the next external trigger.

### 4.5 Inconsistent Error Response Schema
Edge functions use at least 3 different error response formats across the codebase.

### 4.6 Missing Structured Types for Enrichment Sources
The `extraction_sources` JSONB column on buyers has no schema validation, allowing arbitrary shapes that may not round-trip correctly.

---

## 5. FRONTEND FINDINGS

### 5.1 [HIGH] N+1 Query Pattern in use-deals.ts
**File:** `src/hooks/admin/use-deals.ts` (1,008 lines)

After fetching connection_requests in batches of 100, performs 3 sequential query phases (connection_requests -> user_ids -> profiles) plus additional batch queries for memo_distribution_log and data_room_documents. With 1,000+ deals, this causes 3-5 sequential queries per data fetch and risks connection pool exhaustion.

**Recommendation:** Use a single joined query or a database view that pre-joins connection_requests -> profiles.

### 5.2 [HIGH] No Virtualization in Large Lists
**Files:** `AllBuyers.tsx`, `BuyerTableEnhanced.tsx`, `ReMarketingDealMatching.tsx`

`AllBuyers.tsx` loads 2,000 buyers with `.limit(2000)` and renders all at once. No react-window or TanStack Virtual implementation. DOM tree with 2,000+ rows causes 8-12s render time and 500MB+ memory usage.

**Recommendation:** Implement react-window or TanStack Virtual with a 50-item window.

### 5.3 [HIGH] Type Coercion with `as any` Throughout Frontend Data Layer
**File:** `src/hooks/admin/use-deals.ts` (20+ instances)

Multiple `(row: any)`, `(r: any)`, `(p: any)` assertions and `.rpc(...) as any` calls that bypass type definitions, making refactoring impossible and hiding real type errors.

**Recommendation:** Generate proper types from Supabase introspection. Enable `noImplicitAny: true`.

### 5.4 [MEDIUM] Password Hash Field Exposed in Frontend Types
**File:** `src/types/remarketing.ts:371`

```typescript
share_password_hash: string | null;
```

Password hashes should never appear in frontend type definitions. Even if not transmitted, this signals an architectural issue and risks accidental exposure.

**Recommendation:** Remove from frontend types; use a `password_verified: boolean` flag instead.

### 5.5 [MEDIUM] Incomplete Error Handling in Data Fetching
**Files:** `use-buyer-engagement-history.ts`, `use-deals.ts`

Multiple sequential queries with no error checks -- if any query fails silently, incomplete data is returned with no indication to the user.

### 5.6 [MEDIUM] Weak CSV Import Validation
**File:** `src/components/remarketing/BuyerCSVImport.tsx`

`normalizeDomain()` doesn't validate URL format. No max file size check. No column header validation before mapping.

### 5.7 [MEDIUM] Fake Progress Bar in Bulk Scoring
**File:** `src/components/remarketing/BulkScoringPanel.tsx`

```typescript
setProgress(prev => prev + Math.random() * 15); // Simulated, not real
```

Progress bar uses random increments rather than tracking actual server-side progress. Users see 100% while the operation may still be running or may have failed.

### 5.8 [MEDIUM] No Error Boundaries for Scoring/Matching Components
**Files:** `ReMarketingDealMatching.tsx`, `BulkScoringPanel.tsx`

A single component error crashes the entire deal matching page. No fallback UI when scoring fails.

### 5.9 [MEDIUM] Unsafe URL Construction
**File:** `src/lib/buyer-metrics.ts:142-144`

LinkedIn URL construction doesn't validate the stored value, which could contain `javascript:` protocol URLs leading to XSS if rendered as a link.

### 5.10 [LOW] Missing Pagination for AllBuyers
**File:** `src/pages/admin/ma-intelligence/AllBuyers.tsx:43`

```typescript
supabase.from("remarketing_buyers").select("*").limit(2000)
```

Arbitrary 2,000 limit with no cursor-based pagination. Should use infinite scroll or page-by-page loading.

### 5.11 [LOW] Orphaned Console Logs in Production
29 `console.error`/`console.warn`/`console.log` statements across remarketing components, some containing operation IDs and user identifiers.

---

## 6. SCORING ALGORITHM OVERVIEW

### 6.1 Architecture

The system uses a **5-phase weighted composite scoring** approach:

| Phase | Weight (default) | Method | Fallback |
|-------|-----------------|--------|----------|
| Size | 30% | Deterministic range matching | N/A (always available) |
| Geography | 20% | Deterministic + AI thesis parsing | State matching |
| Service/Category | 45% | AI semantic + keyword tokenization | Adjacency map |
| Owner Goals | 5% | AI alignment scoring | Buyer-type norm table |
| Thesis Bonus | +0-20 pts | AI thesis analysis | Keyword pattern matching |

**Composite Formula:**
```
weightedBase = (size*sW + geo*gW*modeFactor + service*svW + owner*oW) / effectiveWeightSum
gatedScore = weightedBase * sizeMultiplier * serviceMultiplier
finalScore = clamp(0, 100, gatedScore + thesisBonus + dataQualityBonus + customBonus - learningPenalty)
```

**Key design principle:** Rules are comprehensive enough to score 100% of deals even without AI. AI improves accuracy when available but is never a hard dependency.

### 6.2 Tier Mapping
- **A Tier:** 80-100 (strong match)
- **B Tier:** 65-79 (good match)
- **C Tier:** 50-64 (moderate match)
- **D Tier:** 35-49 (weak match)
- **F Tier:** 0-34 or disqualified

### 6.3 Score Evolution & Audit Trail

The `score_snapshots` table captures all dimension scores, weights, multipliers, bonuses, tier, data completeness, trigger type, and scoring version at each event. A `deal_snapshot` JSONB column enables stale detection when deal fields change.

### 6.4 Learning Feedback Loop

The `buyer_learning_history` table tracks every approve/pass/hidden decision with all dimension scores at decision time. The `calculateLearningPenalty()` function applies a -5 to +25 point adjustment based on historical approval rate and pass categories (portfolio_conflict, geography_constraint, size_mismatch, service_mismatch).

---

## 7. RECOMMENDATIONS BY PRIORITY

### Immediate (Week 1)
1. **Add authentication to `calculate-buyer-quality-score` and `notify-remarketing-match`** -- Critical auth gaps
2. **Cap batch sizes** on all unbounded queries
3. **Remove service key from HTTP headers** in queue processors
4. **Remove `share_password_hash` from frontend types** -- Low effort, high signal

### Short Term (Weeks 2-3)
5. **Add unit tests for scoring engine** -- Focus on the 6 areas listed in Finding 2.3
6. **Fix enrichment locking** to use atomic compare-and-set
7. **Fix N+1 queries in use-deals.ts** -- Replace sequential queries with joined query
8. **Add list virtualization** to AllBuyers, BuyerTableEnhanced (react-window)
9. **Track AI fallback frequency** in a persistent table
10. **Standardize error responses** across all edge functions

### Medium Term (Weeks 4-6)
11. **Break up scoring engine** into modular files by phase
12. **Add TypeScript interfaces** to replace `any` types (both backend and frontend)
13. **Add dead letter queue** handling for scoring and enrichment queues
14. **Add audit logging** for destructive bulk operations
15. **Complete migration** away from legacy `buyer_deal_scores` table
16. **Add Error Boundaries** to remarketing pages
17. **Implement cursor-based pagination** for AllBuyers

### Long Term
18. **Move service adjacency map** to database-configurable with code fallback
19. **Replace row-counting rate limiter** with counter-based approach
20. **Implement structured logging** with redaction across all edge functions
21. **Add integration tests** for the enrichment pipeline end-to-end
22. **Replace fake progress bars** with real server-side progress tracking

---

## 8. BUG FIX APPLIED

### Geography Mode Constant Names (score-buyer-deal/index.ts)

**Lines changed:** 160-161 (constant definitions), 566-571 (switch statement)

**Before:**
```typescript
GEO_MODE_CRITICAL: 0.6,
GEO_MODE_PREFERRED: 0.25,

case 'preferred': modeFactor = SCORING_CONFIG.GEO_MODE_CRITICAL;
case 'minimal':   modeFactor = SCORING_CONFIG.GEO_MODE_PREFERRED;
```

**After:**
```typescript
GEO_MODE_PREFERRED: 0.6,
GEO_MODE_MINIMAL: 0.25,

case 'preferred': modeFactor = SCORING_CONFIG.GEO_MODE_PREFERRED;
case 'minimal':   modeFactor = SCORING_CONFIG.GEO_MODE_MINIMAL;
```

**Impact:** No behavioral change -- numeric values remain the same. This is a correctness fix for code maintainability.
