# SourceCo Deal-Buyer Matching System — Code Audit Report v2

**Date:** 2026-02-06
**Auditor:** Claude (Automated Code Audit)
**Scope:** Complete scoring pipeline (post-rewrite), supporting edge functions, frontend, data flow
**Codebase State:** Post scoring-system-v2 implementation

---

## Executive Summary

The scoring engine (`score-buyer-deal/index.ts`, ~1500 lines) implements the design spec faithfully across all core scoring dimensions — size, geography, service, owner goals — with proper dual-gate architecture, AI + deterministic fallbacks, and composite assembly. The frontend correctly displays backend-driven scores, disqualification, and review flags.

**However**, the audit identified **5 Critical**, **7 High**, **10 Medium**, and **8 Low** severity findings. The most impactful issues are:

1. **`customInstructions` parameter is accepted but never used** in the scoring pipeline (Critical — entire custom instructions feature is inert).
2. **Standalone edge functions query wrong tables** (`deals`/`buyers` instead of `listings`/`remarketing_buyers`), making them non-functional in the current schema (Critical).
3. **Geography mode factor creates incorrect weight distribution** — the divisor doesn't adjust for reduced geography weight, systematically biasing scores downward (Critical).
4. **Two functions still use the deprecated Lovable AI Gateway**, which will break when the gateway is decommissioned (High).
5. **`recalculate-deal-weights` function does not exist**, leaving the spec's auto-weight adjustment feature unimplemented (High).

**Totals:** 5 Critical, 7 High, 10 Medium, 8 Low findings.

---

## Section A: Critical & High Findings (Full Detail)

---

### FINDING C-01: `customInstructions` Accepted But Never Applied

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-buyer-deal/index.ts` |
| **Line(s)** | 1127, 1378, 1456-1459 |
| **Severity** | **CRITICAL** |
| **Category** | Logic Bug |
| **Description** | `scoreSingleBuyer()` accepts `customInstructions?: string` at line 1127. `handleBulkScore()` passes it at line 1459. However, inside `scoreSingleBuyer()`, the parameter is **never referenced** — it is not passed to any AI prompt, not parsed into rules, and has no effect on any scoring dimension. |
| **Expected Behavior** | Custom instructions should influence scoring — either by being injected into AI prompts for service/owner-goals scoring, or by being parsed through `parse-scoring-instructions` and applied as score adjustments. |
| **Actual Behavior** | The parameter is silently discarded. The "Apply & Re-score" button on the frontend saves instructions to `deal_scoring_adjustments` and triggers a rescore, but the instructions text itself never reaches any scorer. Only pre-existing `deal_scoring_adjustments` rows of type `boost`/`penalize` are applied via `applyCustomInstructionBonus()`. |
| **Recommendation** | Either (a) inject `customInstructions` into the service-fit and owner-goals AI prompts as additional context, or (b) call `parse-scoring-instructions` to convert NL instructions into structured adjustments before scoring begins, then store as `deal_scoring_adjustments`. |

---

### FINDING C-02: `score-buyer-geography` Queries Wrong Tables

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-buyer-geography/index.ts` |
| **Line(s)** | 87-91 (deals table), 104-106 (buyers table) |
| **Severity** | **CRITICAL** |
| **Category** | Data Source Mismatch |
| **Description** | This standalone function queries `supabase.from('deals')` for deal data and `supabase.from('buyers')` for buyer data. The active schema uses `listings` and `remarketing_buyers` tables respectively. |
| **Expected Behavior** | Should query `listings` and `remarketing_buyers` tables, or be retired in favor of the inline geography scorer in `score-buyer-deal`. |
| **Actual Behavior** | Function will return 404 "Deal not found" or empty buyer results when called with remarketing IDs, since `deals` table likely has no matching data for remarketing listings. |
| **Recommendation** | Either update table references to `listings`/`remarketing_buyers`, or deprecate this function since `score-buyer-deal` has its own inline geography scorer using `geography-utils.ts`. |

---

### FINDING C-03: `find-buyer-contacts` Queries Wrong Table

| Field | Value |
|---|---|
| **File** | `supabase/functions/find-buyer-contacts/index.ts` |
| **Line(s)** | 43-47 (`buyers` table), 150 (`buyer_contacts` table) |
| **Severity** | **CRITICAL** |
| **Category** | Data Source Mismatch |
| **Description** | Queries `supabase.from('buyers')` instead of `remarketing_buyers`. Saves contacts to `buyer_contacts` instead of `remarketing_buyer_contacts`. |
| **Expected Behavior** | Should query `remarketing_buyers` and save to `remarketing_buyer_contacts`. |
| **Actual Behavior** | If a `buyerId` from the remarketing system is passed, lookup will fail or return wrong buyer data. Contacts are saved to the wrong table. |
| **Recommendation** | Update table references to use remarketing-prefixed tables. |

---

### FINDING C-04: `parse-scoring-instructions` Queries Wrong Table

| Field | Value |
|---|---|
| **File** | `supabase/functions/parse-scoring-instructions/index.ts` |
| **Line(s)** | 44-48 (`deals` table) |
| **Severity** | **CRITICAL** |
| **Category** | Data Source Mismatch |
| **Description** | Queries `supabase.from('deals')` for deal context. The scoring system uses `listings` table. |
| **Expected Behavior** | Should query `listings` table for deal context. |
| **Actual Behavior** | Deal context will be null/empty, resulting in less accurate instruction parsing. The function itself still works (it returns parsed rules), but without deal context the rules may be less specific. |
| **Recommendation** | Update to query `listings` table. |

---

### FINDING C-05: Geography Mode Factor Creates Incorrect Weight Distribution

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-buyer-deal/index.ts` |
| **Line(s)** | 1151-1156 |
| **Severity** | **CRITICAL** |
| **Category** | Formula Bug |
| **Description** | The weighted base formula is: `(size×sizeWeight + geo×geoWeight×modeFactor + service×serviceWeight + ownerGoals×ownerGoalsWeight) / 100`. When `modeFactor` < 1.0 (e.g., 0.6 for "preferred" mode), the geography contribution is reduced but the divisor remains 100. This means the total effective weights no longer sum to 100, causing a systematic downward bias on ALL scores in preferred/minimal geography mode. |
| **Expected Behavior** | Either (a) divide by the effective weight sum instead of 100, or (b) redistribute the reduced geography weight proportionally to other dimensions. |
| **Actual Behavior** | With default weights [25,25,35,15] and modeFactor=0.6: effective sum = 25 + 25×0.6 + 35 + 15 = 90, divided by 100 = 90% of true score. With modeFactor=0.25 (minimal): effective sum = 25 + 25×0.25 + 35 + 15 = 81.25, divided by 100 = ~81% of true score. All scores are systematically 10-19% lower than intended. |
| **Recommendation** | Change divisor: `const effectiveWeightSum = sizeWeight + geoWeight * modeFactor + serviceWeight + ownerGoalsWeight;` then divide by `effectiveWeightSum` instead of 100. |

---

### FINDING H-01: `score-service-fit` Uses Deprecated Lovable AI Gateway

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-service-fit/index.ts` |
| **Line(s)** | 61 |
| **Severity** | **HIGH** |
| **Category** | Deprecated Dependency |
| **Description** | Still calls `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`. Uses model name `'google/gemini-2.5-flash'` which is a gateway-specific identifier. The main scoring engine has been migrated to direct Gemini API via `ai-providers.ts`. |
| **Expected Behavior** | Should use `GEMINI_API_URL` from `ai-providers.ts` with `GEMINI_API_KEY`, model `gemini-2.0-flash`. |
| **Actual Behavior** | Falls back to keyword matching if `LOVABLE_API_KEY` is not set. Will break entirely when Lovable gateway is decommissioned. |
| **Recommendation** | Migrate to direct Gemini API or deprecate since `score-buyer-deal` has its own inline service scorer. |

---

### FINDING H-02: `find-buyer-contacts` Uses Deprecated Lovable AI Gateway

| Field | Value |
|---|---|
| **File** | `supabase/functions/find-buyer-contacts/index.ts` |
| **Line(s)** | 27-28 (requires LOVABLE_API_KEY), 207 (calls gateway) |
| **Severity** | **HIGH** |
| **Category** | Deprecated Dependency |
| **Description** | Requires `LOVABLE_API_KEY` and calls `https://ai.gateway.lovable.dev/v1/chat/completions` for contact extraction AI. Uses gateway-specific model name `'google/gemini-2.5-flash'`. |
| **Expected Behavior** | Should use direct Gemini API via `ai-providers.ts`. |
| **Actual Behavior** | Returns error 500 "LOVABLE_API_KEY is not configured" if env var is not set. Contact extraction fails completely. |
| **Recommendation** | Migrate `extractContactsWithAI()` to use `GEMINI_API_URL` with `GEMINI_API_KEY` and `DEFAULT_GEMINI_MODEL`. |

---

### FINDING H-03: `recalculate-deal-weights` Function Does Not Exist

| Field | Value |
|---|---|
| **File** | N/A (Missing) |
| **Line(s)** | N/A |
| **Severity** | **HIGH** |
| **Category** | Missing Implementation |
| **Description** | The spec references a `recalculate-deal-weights` edge function for auto-adjusting universe weights based on learning patterns and approval/pass data. No such function exists in the codebase (`supabase/functions/recalculate-deal-weights/` directory not found). |
| **Expected Behavior** | Should exist and compute weight suggestions from `buyer_learning_history` patterns. |
| **Actual Behavior** | The `WeightSuggestionsPanel` component in the frontend allows manual weight adjustments, but the automated backend calculation does not exist. |
| **Recommendation** | Implement this function or document it as a planned future feature. |

---

### FINDING H-04: KPI Bonus Hardcoded to 0

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-buyer-deal/index.ts` |
| **Line(s)** | 1169 |
| **Severity** | **HIGH** |
| **Category** | Incomplete Implementation |
| **Description** | `const kpiBonus = 0; // TODO: implement from tracker.kpi_scoring_config if present`. The KPI bonus is declared as part of the scoring pipeline, stored in the database (`kpi_bonus` column), and included in the final score assembly, but is permanently 0. |
| **Expected Behavior** | Should calculate bonus from `tracker.kpi_scoring_config` when available, matching specific deal KPIs to tracker thresholds. |
| **Actual Behavior** | Always 0 regardless of tracker configuration or deal KPI data. |
| **Recommendation** | Either implement KPI scoring from tracker config or remove the `kpi_bonus` from the pipeline and schema to avoid confusion. |

---

### FINDING H-05: Inconsistent Geography Scores Between Functions

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-buyer-geography/index.ts` vs `supabase/functions/_shared/geography-utils.ts` |
| **Line(s)** | score-buyer-geography: 219 (exact=100), 226 (adjacent=85) vs geography-utils.ts: 155 (exact=95), 165 (adjacent=70-85) |
| **Severity** | **HIGH** |
| **Category** | Inconsistency |
| **Description** | Two different geography scoring scales exist: (1) `score-buyer-geography` standalone: exact=100, adjacent=85, regional=60, national=70, no_match=20. (2) `geography-utils.ts` (used by main scorer): exact=95, adjacent=70-85, regional=45-60, distant=20. |
| **Expected Behavior** | All geography scoring should use a single, consistent scale. |
| **Actual Behavior** | If both functions are called for the same data, they produce different scores. The standalone function gives higher scores overall. |
| **Recommendation** | Deprecate the standalone `score-buyer-geography` or align its scoring with `geography-utils.ts`. |

---

### FINDING H-06: Single Score Handler Does Not Pass `customInstructions`

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-buyer-deal/index.ts` |
| **Line(s)** | 1306-1348 |
| **Severity** | **HIGH** |
| **Category** | Logic Bug |
| **Description** | `handleSingleScore()` calls `scoreSingleBuyer()` without the `customInstructions` parameter. The `ScoreRequest` interface (line 15-19) also lacks a `customInstructions` field. Even once C-01 is fixed, single-score requests would still not include custom instructions. |
| **Expected Behavior** | Should accept and pass `customInstructions` from the single score request. |
| **Actual Behavior** | Single score requests always use default scoring without custom instructions. |
| **Recommendation** | Add `customInstructions` to `ScoreRequest` interface and pass it through `handleSingleScore`. |

---

### FINDING H-07: Upsert Conflict Key Missing Universe ID

| Field | Value |
|---|---|
| **File** | `supabase/functions/score-buyer-deal/index.ts` |
| **Line(s)** | 1353 (single), 1474 (bulk) |
| **Severity** | **HIGH** |
| **Category** | Data Integrity |
| **Description** | Score upsert uses `onConflict: "listing_id,buyer_id"`. The `universe_id` is not part of the conflict key. If the same buyer is scored for the same listing in two different universes, the second score overwrites the first. |
| **Expected Behavior** | Each (listing, buyer, universe) combination should produce a separate score row. |
| **Actual Behavior** | Only the most recent universe's score is kept. Switching universe view after scoring both shows the same scores. |
| **Recommendation** | Change conflict key to `"listing_id,buyer_id,universe_id"` and ensure the database unique constraint matches. |

---

## Section B: Medium & Low Findings (Table Format)

### Medium Severity

| ID | File | Line(s) | Category | Description |
|---|---|---|---|---|
| M-01 | `score-buyer-deal/index.ts` | 362 | Data Parsing | Deal state extracted via regex `dealLocation.match(/,\s*([A-Z]{2})\s*$/i)` — fails for locations like "Dallas, Texas" (full state name), "Denver, CO 80202" (with zip code), or "Multi-city, CA/NV" (multi-state). Should use `normalizeStateCode()` from `geography-utils.ts` as a fallback. |
| M-02 | `score-buyer-deal/index.ts` | 491-492 | Null Safety | `listing.services || listing.categories || [listing.category]` — if ALL are null/undefined, produces `[null]`. The subsequent `.filter(Boolean)` handles this, but `[listing.category]` with a null category creates a single-element array that gets filtered to empty, which is correct. However, the `.map((s: string) => s?.toLowerCase().trim())` on line 492 could fail if a non-null but non-string value slips through (e.g., a number). |
| M-03 | `score-buyer-deal/index.ts` | 688-696 | Fragile Matching | `calculateServiceOverlap()` has hardcoded synonym pairs (`collision`↔`body`, `auto`↔`automotive`, `restoration`↔`restoration`). These should be in the adjacency map, not inline. The `restoration`↔`restoration` check is a tautology (already covered by `includes` check). |
| M-04 | `score-buyer-deal/index.ts` | 1233-1235 vs BuyerMatchCard.tsx:205-211 | Inconsistent Thresholds | Backend `fitLabel` uses thresholds: "Strong fit" >= 70, "Moderate" >= 55, "Weak" < 55. Frontend `getFitLabel()` uses: "Strong fit" >= 80, "Good fit" >= 65, "Fair fit" >= 50, "Poor fit" < 50. Users see different labels for the same score depending on whether they read `fit_reasoning` (backend label) or the colored header (frontend label). |
| M-05 | `geography-utils.ts` | 11-12 | Stale Cache | Module-level `adjacencyCache` and `regionCache` are process-lifetime singletons with no TTL. If `geographic_adjacency` data changes, the cache is never invalidated. In Deno edge functions with isolate reuse, this cache could persist for hours. |
| M-06 | `score-buyer-deal/index.ts` | 208 | Falsy Zero Bug | `if (!buyerMinRevenue && !buyerMaxRevenue && !buyerMinEbitda && !buyerMaxEbitda)` — `!0` evaluates to `true`, so if a buyer has `target_revenue_min: 0` (legitimate value meaning "no minimum"), this condition fires, returning a neutral score (60) with multiplier 1.0 instead of evaluating against the zero minimum. |
| M-07 | `score-buyer-deal/index.ts` | 1276-1278 | Hardcoded Defaults | `acquisition_score: 50`, `portfolio_score: 50`, `business_model_score: 50` are always 50. These secondary scores are stored in the DB and shown in the frontend's "Advanced Scoring Factors" collapsible (`ScoreBreakdown.tsx:51-55`), but are never actually calculated. Users see "50" for all three and may think they're real scores. |
| M-08 | `BuyerMatchCard.tsx` | 95-100 | Threshold Mismatch | `isDisqualified()` falls back to `composite_score < 35` when `is_disqualified` is null. This means old scores created before the v2 migration (which added the `is_disqualified` column) with scores between 0-34 are retroactively shown as "Disqualified" even if they weren't flagged by the original scoring logic. |
| M-09 | `ReMarketingDealMatching.tsx` | 440-446 | Feature Gap | `handleBulkScore()` sends `customInstructions` to the edge function and shows success messages like "Scored N buyers", but per C-01 the instructions have no effect on scores. Users believe their instructions were applied when they weren't. |
| M-10 | `score-buyer-deal/index.ts` | 1416-1419 | Missing Universe Filter | When checking existing scores for skip-logic, the query filters by `listing_id` only, not `universe_id`. If a buyer was scored in Universe A, they'll be skipped when scoring Universe B (unless `rescoreExisting` is true). This means the first universe scored gets all buyers, but subsequent universes appear empty. |

### Low Severity

| ID | File | Line(s) | Category | Description |
|---|---|---|---|---|
| L-01 | `score-buyer-deal/index.ts` | 152-155 | Missing Fallback | If `GEMINI_API_KEY` is not set, the entire function throws immediately with no graceful degradation. Unlike individual AI calls (service fit, owner goals) that have deterministic fallbacks, the top-level handler has an all-or-nothing dependency on Gemini. |
| L-02 | `score-buyer-deal/index.ts` | 821 | Threshold | Thesis bonus requires `thesis.length > 50` to proceed. Short but valid theses (e.g., "Roll-up platform targeting Southeast restoration" = 49 chars) get 0 bonus evaluation. |
| L-03 | `score-service-fit/index.ts` | 153 | Division Denominator | `matchRatio = matches.length / Math.max(dealKeywords.length, 1)` — uses only deal keywords as denominator. A deal with 1 keyword matching 1 of 20 buyer keywords gets 100% ratio, overstating the match. |
| L-04 | `ScoringInsightsPanel.tsx` | 139 | CSS Layout | The decisions dropdown `CollapsibleContent` uses `className="absolute"` which may clip, overflow, or overlay other content depending on the parent's positioning context. |
| L-05 | `ScoreBreakdown.tsx` | 93, 138 | Falsy Zero Rendering | `{thesisBonus && thesisBonus > 0 && ...}` — if `thesisBonus` is exactly `0`, the `&&` short-circuits to `0`, which React renders as the literal text "0" in the DOM. Should use `{thesisBonus != null && thesisBonus > 0 && ...}`. |
| L-06 | `BuyerMatchCard.tsx` | 193-198 | Formatting | `formatCurrency()` returns `$1M` for 1,000,000 but `$500K` for 500,000. Values under $1000 show raw like `$999`. The `$0` case returns `null` but `$0.00` values would show `null` due to `if (!value)` falsy check. |
| L-07 | `score-buyer-deal/index.ts` | 700 | Division Denominator | `calculateServiceOverlap()` uses `Math.max(dealServices.length, buyerServices.length, 1)` as denominator (line 699). This correctly prevents division by zero but may undercount overlap when buyer has many more services than deal (or vice versa). |
| L-08 | `extract-buyer-criteria/index.ts` | 11 | Env at Module Level | `ANTHROPIC_API_KEY` is read at module level. In Deno edge functions this works for cold starts but won't pick up runtime env changes during warm function reuse. |

---

## Section C: Architecture Gaps

| # | Gap | Impact | Recommendation |
|---|---|---|---|
| AG-01 | **`recalculate-deal-weights` does not exist** | Auto weight adjustment per learning patterns is unimplemented. The `WeightSuggestionsPanel` frontend component has no backend computation endpoint. | Implement or defer to Phase 2 with documentation. |
| AG-02 | **Engagement bonus is disabled** | `fetchEngagementBonus()` exists but is disabled and returns 0. The spec says "scoring happens pre-engagement" so this is intentional, but the infrastructure (function, column, ScoredResult field) carries dead weight. | Document as intentionally deferred. Consider removing dead engagement columns if not planned for activation. |
| AG-03 | **Standalone scoring functions vs. inline scoring** | `score-buyer-geography` and `score-service-fit` are standalone functions with their own scoring logic, but `score-buyer-deal` has inline equivalents (`calculateGeographyScore`, `callServiceFitAI`). Two codepaths for the same concept create drift risk (as evidenced by H-05). | Deprecate standalone functions or refactor to share code from `_shared/` modules. |
| AG-04 | **No rate limiting or circuit breaker on AI calls** | Each buyer scoring makes up to 3 sequential AI calls (service fit, owner goals, thesis). For 100 buyers that's up to 300 API calls. Only mitigation is 300ms inter-batch delay and 10-second timeouts. No exponential backoff on AI failures, no circuit breaker to stop calling after repeated failures. | Add circuit breaker pattern: after N consecutive failures, skip AI and use fallbacks for remaining buyers in batch. |
| AG-05 | **Custom instructions flow is broken end-to-end** | Frontend saves instructions → sends to bulk scorer → parameter accepted → parameter silently ignored. Meanwhile, `parse-scoring-instructions` exists as a standalone function but is never called from the scoring pipeline. | Wire up the full flow: call `parse-scoring-instructions` at start of bulk scoring → generate adjustments → apply during scoring. Or inject raw instructions into AI prompts. |
| AG-06 | **No score versioning** | When the scoring algorithm changes, old scores become incomparable to new ones. No `algorithm_version` or `scoring_version` field is stored with scores. | Add `scoring_algorithm_version` column to `remarketing_scores`. Populate on each score write. Allows filtering/comparing scores across algorithm versions. |

---

## Section D: Dead Code & Unused Exports

| # | File | Line(s) | Description |
|---|---|---|---|
| DC-01 | `score-buyer-deal/index.ts` | 1104-1111 | `fetchEngagementBonus()` — full function exists, accepts supabase/listingId/buyerId params, but always returns `{ bonus: 0, reasoning: '' }`. Never called from `scoreSingleBuyer()`. |
| DC-02 | `score-service-fit/index.ts` | Entire file | Standalone service scoring function. Not called by `score-buyer-deal` (which has its own `callServiceFitAI()` + `calculateServiceOverlap()`). May still be invoked from other frontend paths — verify before removing. |
| DC-03 | `score-buyer-geography/index.ts` | Entire file | Standalone geography scoring function. Not called by `score-buyer-deal` (which uses `geography-utils.ts`). May still be invoked from other frontend paths — verify before removing. |
| DC-04 | `ai-providers.ts` | 12 | `OPENAI_API_URL` — exported constant, never imported or used anywhere in the codebase. |
| DC-05 | `ai-providers.ts` | 18-20 | `getGeminiApiUrl()` — exported function that just returns `GEMINI_API_URL`. Never called — callers import the constant directly. |
| DC-06 | `ai-providers.ts` | 30-36 | `GEMINI_MODEL_MAP` — maps old Lovable gateway model names to native names. Only used by `getGeminiModel()` which itself is not called from the scoring pipeline. |
| DC-07 | `score-buyer-deal/index.ts` | 1276-1278 | `acquisition_score`, `portfolio_score`, `business_model_score` — always set to 50, never calculated. Stored in DB and displayed in frontend but carry zero information. |

---

## Section E: Quick Wins (Low-Effort, High-Impact Fixes)

| # | Finding | Effort | Impact | Fix |
|---|---|---|---|---|
| QW-01 | L-05: Falsy zero renders "0" in ScoreBreakdown | 5 min | UI correctness | Change `{thesisBonus && thesisBonus > 0 && ...}` to `{thesisBonus != null && thesisBonus > 0 && ...}` on ScoreBreakdown.tsx lines 93 and 138. |
| QW-02 | M-06: Falsy zero in size scoring | 5 min | Score accuracy | Change `!buyerMinRevenue` checks to `buyerMinRevenue == null` at line 208 to handle legitimate zero values. |
| QW-03 | M-04: fitLabel threshold alignment | 10 min | UX consistency | Align backend fitLabel breakpoints (lines 1233-1235) with frontend `getFitLabel` breakpoints (80/65/50) in `BuyerMatchCard.tsx:205-211`. |
| QW-04 | M-01: Deal state parsing improvement | 15 min | Score accuracy | After regex extraction on line 362, pass result through `normalizeStateCode()` from geography-utils. Also add a second-pass regex for patterns like "City, State Name" using the stateNames map. |
| QW-05 | H-04: Remove KPI TODO or implement | 10 min | Code clarity | Either implement basic KPI scoring from tracker config or replace with explicit `0` and add a clear comment that this is intentionally disabled (not a TODO). |
| QW-06 | M-10: Add universe_id to existing-score filter | 10 min | Correct behavior | Add `.eq("universe_id", universeId)` to the existing score check at line 1417 so buyers are properly scored per-universe. |
| QW-07 | L-01: Graceful GEMINI_API_KEY fallback | 15 min | Reliability | Instead of throwing at line 152-155, allow scoring to proceed using all deterministic fallbacks when GEMINI_API_KEY is absent. |

---

## Section F: Recommended Implementation Order

### Priority 1 — Must Fix (Scoring Correctness)

1. **C-05**: Fix geography mode factor divisor (formula bug affecting all non-critical mode scores)
2. **C-01**: Wire `customInstructions` through to AI prompts or `parse-scoring-instructions`
3. **H-07 + M-10**: Fix upsert conflict key and existing-score filter to include `universe_id`
4. **QW-01 through QW-06**: Quick fixes for null safety, threshold alignment, state parsing, KPI cleanup

### Priority 2 — Should Fix (Functionality & Compatibility)

5. **C-02, C-03, C-04**: Update standalone functions to use correct tables (or formally deprecate)
6. **H-01, H-02**: Migrate remaining functions off Lovable AI Gateway to direct Gemini API
7. **H-05**: Align geography scoring scales across functions (or deprecate standalone)
8. **H-06**: Pass `customInstructions` in single score handler
9. **M-04**: Align backend/frontend fitLabel thresholds

### Priority 3 — Should Build (Architecture)

10. **H-03 / AG-01**: Implement `recalculate-deal-weights` function
11. **AG-04**: Add circuit breaker / retry logic for AI calls
12. **AG-06**: Add scoring algorithm version tracking
13. **M-05**: Add TTL-based cache invalidation for geography adjacency
14. **M-07**: Either calculate secondary scores or remove from pipeline/frontend

### Priority 4 — Cleanup

15. Remove dead code (DC-01 through DC-07)
16. Deprecate standalone scoring functions (AG-03)
17. Clean up unused AI provider exports (DC-04, DC-05, DC-06)

---

## Appendix: Files Audited

| File | Lines | Status |
|---|---|---|
| `supabase/functions/score-buyer-deal/index.ts` | 1502 | Full audit |
| `supabase/functions/_shared/geography-utils.ts` | 271 | Full audit |
| `supabase/functions/_shared/ai-providers.ts` | 267 | Full audit |
| `supabase/functions/score-service-fit/index.ts` | 197 | Full audit |
| `supabase/functions/score-buyer-geography/index.ts` | 240 | Full audit |
| `supabase/functions/parse-scoring-instructions/index.ts` | 138 | Full audit |
| `supabase/functions/find-buyer-contacts/index.ts` | 263 | Full audit |
| `supabase/functions/extract-buyer-criteria/index.ts` | ~300+ | Partial (first 100 lines) |
| `supabase/functions/extract-buyer-transcript/index.ts` | ~300+ | Partial (first 100 lines) |
| `src/pages/admin/remarketing/ReMarketingDealMatching.tsx` | 1176 | Full audit |
| `src/components/remarketing/BuyerMatchCard.tsx` | 692 | Full audit |
| `src/components/remarketing/ScoreTierBadge.tsx` | 147 | Full audit |
| `src/components/remarketing/ScoreBreakdown.tsx` | 185 | Full audit |
| `src/components/remarketing/ScoringInsightsPanel.tsx` | 335 | Full audit |
| `src/types/remarketing.ts` | 363 | Full audit |
| `supabase/migrations/20260206170000_scoring_system_v2_schema.sql` | — | Checked |
| `supabase/functions/recalculate-deal-weights/index.ts` | — | **DOES NOT EXIST** |

---

**END OF AUDIT REPORT**
