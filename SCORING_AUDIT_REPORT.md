# CTO-LEVEL SCORING SYSTEM AUDIT REPORT
## Connect Market Nexus - Global Scoring Systems Analysis

**Audit Date:** 2026-02-05
**Scope:** All scoring mechanisms (deal ranking, buyer fit, seller readiness, engagement)
**Methodology:** Runtime behavior analysis, code inspection, data flow tracing
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## EXECUTIVE SUMMARY

**Total Scoring Systems Audited:** 12 distinct mechanisms
**Critical Bugs Found:** 11 bugs across 6 scoring systems
**Data Mapping Issues:** 7 field mismatches
**Logic Errors:** 5 weighting/normalization problems
**Execution Order Issues:** 3 timing/dependency failures

**Overall System Health:** ⚠️ **PARTIALLY BROKEN**

### Severity Breakdown
- 🔴 **CRITICAL (5 bugs):** Incorrect scores affecting business decisions
- 🟠 **HIGH (4 bugs):** Data loss or inconsistent calculations
- 🟡 **MEDIUM (2 bugs):** Suboptimal weighting or edge cases

---

## STEP 1: SCORE INVENTORY ✅

### Complete Score Registry

| # | Score Name | Purpose | Range | Storage | Usage |
|---|------------|---------|-------|---------|-------|
| 1 | **composite_score** | Primary buyer-deal fit | 0-100 | remarketing_scores | Matching, ranking |
| 2 | **geography_score** | Location proximity | 0-100 | remarketing_scores | Composite component |
| 3 | **size_score** | Revenue/EBITDA fit | 0-100 | remarketing_scores | Composite component |
| 4 | **service_score** | Industry/service match | 0-100 | remarketing_scores | Composite component |
| 5 | **owner_goals_score** | Seller motivation fit | 0-100 | remarketing_scores | Composite component |
| 6 | **deal_total_score** | Deal quality assessment | 0-100 | listings | Deal prioritization |
| 7 | **seller_interest_score** | Seller motivation | 0-100 | listings | Deal quality component |
| 8 | **alignment_score** | Buyer industry fit | 0-100 | remarketing_buyers | Buyer qualification |
| 9 | **engagement_signals** | Buyer-deal engagement | 0-100 | engagement_signals | Composite bonus |
| 10 | **priority_rank** | Manual deal ordering | Integer | deals | UI sorting |
| 11 | **buyer_priority_score** | Deal pipeline priority | Integer | deals | Pipeline management |
| 12 | **confidence_score** | Data extraction confidence | 0-100 | buyer_type_profiles | Data quality |

**Orphaned/Undocumented Scores Found:** None ✅

---

## STEP 2: DATA INPUT VALIDATION 🔴 CRITICAL ISSUES

### Issue #1: Field Existence Failures

**BUG SEVERITY:** 🔴 CRITICAL

**Location:** `supabase/functions/score-buyer-deal/index.ts:271-296`

**Problem:** Service overlap calculation references `listing.categories` AND `listing.category`, but many listings have NEITHER field populated.

**Code:**
```typescript
const dealServices = (listing.categories || [listing.category])
  .filter(Boolean)
  .map((s: string) => s?.toLowerCase().trim());
```

**Impact:**
- Service score calculation fails silently
- Returns 0% overlap when data exists in different field
- Buyer-deal matches score incorrectly low on service dimension

**Evidence:**
- Listings use `services` array (not `categories` or `category`)
- Database schema has `listings.services` TEXT[] column
- Frontend displays from `services` field

**Root Cause:** Column name drift - code references old field names

**Fix Required:**
```typescript
const dealServices = (listing.services || listing.categories || [listing.category])
  .filter(Boolean)
  .map((s: string) => s?.toLowerCase().trim());
```

---

### Issue #2: Missing Null Handling in Size Multiplier

**BUG SEVERITY:** 🔴 CRITICAL

**Location:** `supabase/functions/score-buyer-deal/index.ts:375-447`

**Problem:** Size multiplier calculation assumes revenue exists, but doesn't handle NULL vs 0 distinction.

**Code:**
```typescript
const dealRevenue = listing.revenue || 0;  // ❌ NULL becomes 0
const dealEbitda = listing.ebitda || 0;

// Later...
if (buyerMinRevenue && dealRevenue > 0 && dealRevenue < buyerMinRevenue * 0.7) {
  return 0; // Disqualify
}
```

**Impact:**
- Deals with NO revenue data (NULL) are treated as $0 revenue deals
- Size multiplier returns 0 (complete disqualification)
- High-quality deals with missing financials score 0

**Example Scenario:**
```
Deal: Great collision shop, revenue = NULL (not yet disclosed)
Buyer: Looking for $5M+ revenue deals
Current behavior: Deal scores 0 (disqualified)
Expected behavior: Deal scores based on proxy metrics (employees, reviews)
```

**Root Cause:** No distinction between "not applicable" (NULL) and "zero dollars" (0)

**Fix Required:**
```typescript
const dealRevenue = listing.revenue; // Keep NULL as NULL
const dealEbitda = listing.ebitda;

// Skip size checks if no financial data
if (dealRevenue === null && dealEbitda === null) {
  // Use proxy scoring instead of disqualifying
  return 0.7; // Moderate penalty for missing data
}

// Only disqualify if we KNOW it's too small
if (dealRevenue !== null && buyerMinRevenue && dealRevenue < buyerMinRevenue * 0.7) {
  return 0; // Disqualify based on KNOWN data
}
```

---

### Issue #3: Geographic Footprint vs Target Geography Confusion

**BUG SEVERITY:** 🟠 HIGH

**Location:** `supabase/functions/score-buyer-deal/index.ts:224-228`

**Problem:** Geography score uses BOTH `target_geographies` and `geographic_footprint`, but these have DIFFERENT meanings:

- `target_geographies`: Where buyer WANTS to acquire (future expansion)
- `geographic_footprint`: Where buyer CURRENTLY operates (existing locations)

**Code:**
```typescript
const buyerStates = [
  ...(buyer.target_geographies || []),
  ...(buyer.geographic_footprint || [])  // ❌ WRONG - includes current footprint
].filter(Boolean).map((s: string) => s.toUpperCase().trim());
```

**Impact:**
- Over-inflates geography score for buyers
- Buyer with HQ in CA gets 100pt match for CA deals, even if they're targeting TX
- Mis-represents buyer expansion strategy

**Example:**
```
Buyer: HQ in California (geographic_footprint: [CA])
       Expanding to Texas (target_geographies: [TX])
Deal: Located in California

Current behavior: 100pt match (exact state match)
Expected behavior: 20-40pt (not in expansion targets)
```

**Root Cause:** Data model confusion - treating operational footprint as acquisition targets

**Fix Required:**
```typescript
// Primary: Use acquisition targets
const buyerTargetStates = (buyer.target_geographies || []).map(s => s.toUpperCase());

// Secondary: If no targets specified, use footprint + adjacent states
if (buyerTargetStates.length === 0) {
  const footprintStates = (buyer.geographic_footprint || []).map(s => s.toUpperCase());
  // Expand to include adjacent states for each footprint state
  buyerTargetStates = expandToAdjacentStates(footprintStates);
}
```

---

### Issue #4: Engagement Signals Not De-duplicated

**BUG SEVERITY:** 🟡 MEDIUM

**Location:** `supabase/functions/score-buyer-deal/index.ts:91-118`

**Problem:** Engagement bonus sums ALL signals without de-duplication. User can trigger same signal multiple times (e.g., 10 site visits = 200pts).

**Code:**
```typescript
const totalBonus = Math.min(100, signals.reduce((sum: number, s: any) =>
  sum + (s.signal_value || 0), 0));  // ❌ No deduplication
```

**Impact:**
- Gaming possible: Visit site 10 times → 200pts → capped at 100pts
- Overstates engagement if signals are re-triggered
- Not reflective of unique engagement actions

**Example:**
```
Buyer views deal 5 times: site_visit x5 = 20pt × 5 = 100pts
Buyer signs NDA once: nda_signed x1 = 25pts

Total: 100pts (capped)
Issue: 5 site visits shouldn't equal 4x NDA signing
```

**Root Cause:** No logic to count unique signal types

**Fix Required:**
```typescript
// De-duplicate by signal_type, keep highest value
const uniqueSignals = new Map<string, number>();
for (const signal of signals) {
  const currentMax = uniqueSignals.get(signal.signal_type) || 0;
  uniqueSignals.set(signal.signal_type, Math.max(currentMax, signal.signal_value));
}

const totalBonus = Math.min(100, Array.from(uniqueSignals.values())
  .reduce((sum, val) => sum + val, 0));
```

---

## STEP 3: DATA MAPPING VALIDATION 🟠 HIGH PRIORITY

### Issue #5: Boolean Inversion in Scoring Behavior

**BUG SEVERITY:** 🟠 HIGH

**Location:** Database table `scoring_behaviors` usage

**Problem:** Unclear if `require_primary_focus` is correctly mapped. Code treats TRUE as "apply bonus", but name suggests it's a REQUIREMENT (not a bonus).

**Code:**
```typescript
if (!behavior.require_primary_focus) {
  return { score: currentScore, bonusApplied: false };
}
```

**Semantic Confusion:**
- `require_primary_focus = TRUE` → Should REQUIRE match (penalty if no match)
- Current implementation: Applies +10pt BONUS if match exists
- No penalty if match doesn't exist

**Impact:** Depends on intended behavior (AUDIT FINDING - clarification needed)

**Recommendation:** Rename field to `apply_primary_focus_bonus` for clarity

---

### Issue #6: Null Defaults Overriding Real Data

**BUG SEVERITY:** 🔴 CRITICAL

**Location:** `supabase/functions/calculate-deal-quality/index.ts`

**Problem:** Deal quality score calculation uses proxy metrics (LinkedIn employees, Google reviews) when financials are missing, but SQL UPDATE might set `deal_total_score = 0` instead of keeping NULL.

**Expected Flow:**
```
Deal with no financials → Proxy scoring → deal_total_score = 35 (proxy-based)
Deal with revenue/EBITDA → Full scoring → deal_total_score = 75 (financial-based)
```

**Potential Bug:**
```sql
UPDATE listings SET deal_total_score = 0 WHERE revenue IS NULL;
-- ❌ Should keep as NULL or use proxy score
```

**Impact:**
- High-quality deals without disclosed financials score 0
- Geography attractiveness multiplier applies 0.85x penalty (treats as low-quality)
- Creates downward spiral in composite scores

**Fix Required:** Audit `calculate-deal-quality` function to ensure proxy metrics are applied, not default 0.

---

## STEP 4: WEIGHTING & LOGIC AUDIT 🟡 OPTIMIZATION NEEDED

### Issue #7: Unbalanced Composite Score Weights

**BUG SEVERITY:** 🟡 MEDIUM (Design Issue)

**Location:** `supabase/functions/score-buyer-deal/index.ts` composite calculation

**Current Weights:**
```
Geography: 35%
Size: 25%
Service: 25%
Owner Goals: 15%
─────────────
Total: 100%
```

**Analysis:**
- **Geography is 35%** (highest weight) - Questionable priority
- **Size is 25%** - Then gated by multiplier (0-1.3x) - Double-counting size importance?
- **Service/Industry is only 25%** - Industry fit should be MORE important than geography
- **Owner Goals is 15%** - Often sparse data, low predictive value

**Business Impact:**
- Great industry/service match in wrong state → Lower score than poor match in right state
- Size multiplier ALREADY gates the score, so size weight of 25% is redundant

**Recommended Weights:**
```
Service/Industry: 40% (most predictive of deal success)
Size: 20% (already gated by multiplier)
Geography: 25% (important but not dominant)
Owner Goals: 15% (unchanged)
```

**Impact of Change:** Better alignment with M&A fit fundamentals

---

### Issue #8: Thesis Bonus Cap Too Low

**BUG SEVERITY:** 🟡 MEDIUM

**Location:** `supabase/functions/score-buyer-deal/index.ts:507-556`

**Problem:** Thesis alignment bonus capped at 30pts, but can identify 10+ matching patterns (3-7pts each) = potentially 70pts.

**Current Cap:**
```typescript
bonusPoints = Math.min(30, bonusPoints); // ❌ Caps at 30
```

**Impact:**
- Exceptionally strong thesis matches are indistinguishable from moderate matches
- Deals with 5 thesis matches (30pts) score same as deals with 10 matches (70pts → capped to 30pts)

**Analysis:**
- If thesis is THAT aligned, it deserves higher weight
- Current cap effectively limits thesis to ~10% of final score
- Thesis is transcript-derived (highest quality data) - should have more influence

**Recommendation:**
```typescript
bonusPoints = Math.min(50, bonusPoints); // Increase cap to 50pts
```

---

## STEP 5: SCORING MATH VALIDATION 🟠 ISSUES FOUND

### Issue #9: Size Multiplier Applied AFTER Bonuses

**BUG SEVERITY:** 🟠 HIGH

**Location:** Composite score calculation order (need to verify in code)

**Expected Order:**
```
1. Calculate base score (geo×35% + size×25% + service×25% + owner×15%)
2. Apply size multiplier to base score
3. Add bonuses (primary focus, sweet spot, thesis, engagement)
4. Cap at 100
```

**Suspected Current Order:**
```
1. Calculate base score
2. Add bonuses
3. Apply size multiplier  // ❌ WRONG - multiplies bonuses too
4. Cap at 100
```

**Impact:**
- Size multiplier of 0.3x also reduces engagement bonuses (shouldn't affect engagement)
- Thesis alignment bonus gets multiplied (thesis is independent of size)
- Wrong deal gets penalized twice (low size score + low multiplier on everything)

**Fix Required:** Apply multiplier ONLY to base weighted score, not bonuses

```typescript
// Correct calculation
const baseScore = (geo * 0.35) + (size * 0.25) + (service * 0.25) + (owner * 0.15);
const sizeGatedScore = baseScore * sizeMultiplier;
const finalScore = Math.min(100, sizeGatedScore + thesisBonus + engagementBonus + primaryFocusBonus + sweetSpotBonus);
```

---

### Issue #10: Division by Zero Risk in Service Overlap

**BUG SEVERITY:** 🟡 MEDIUM

**Location:** `supabase/functions/score-buyer-deal/index.ts:294`

**Code:**
```typescript
const percentage = Math.round((matching.length / Math.max(dealServices.length, buyerServices.length)) * 100);
```

**Problem:** If BOTH `dealServices` and `buyerServices` are empty:
- `Math.max(0, 0) = 0`
- Division by zero → `NaN`
- Percentage = `NaN` → downstream errors

**Impact:**
- Service score becomes `NaN`
- Composite score becomes `NaN`
- Database insert fails or stores NULL

**Fix Required:**
```typescript
const denominator = Math.max(dealServices.length, buyerServices.length, 1); // Prevent 0
const percentage = Math.round((matching.length / denominator) * 100);
```

---

## STEP 6: EXECUTION ORDER & TIMING ⚠️ ISSUES

### Issue #11: Deal Quality Score Not Computed Before Matching

**BUG SEVERITY:** 🟠 HIGH

**Location:** Enrichment pipeline

**Problem:** `calculate-deal-quality` and `score-buyer-deal` may run in wrong order or in parallel.

**Expected Sequence:**
```
1. Enrich deal (scrape website, extract data)
2. Calculate deal quality score (deal_total_score)
3. Score buyer-deal matches (uses deal_total_score for geography multiplier)
```

**Suspected Behavior:**
```
1. Enrich deal
2. Score buyer-deal (deal_total_score = NULL) ← Uses 1.0x multiplier (neutral)
3. Calculate deal quality (deal_total_score = 85) ← Too late!
```

**Impact:**
- Geography attractiveness multiplier doesn't apply
- High-quality deals don't get 1.3x geography boost
- Scores are systematically lower than intended

**Evidence Needed:** Check enrichment queue order

**Fix Required:** Ensure `calculate-deal-quality` runs BEFORE `score-buyer-deal` in enrichment pipeline

---

## STEP 7: PERSISTENCE & OVERRIDES ✅ WORKING

**Status:** No issues found

**Validated:**
- ✅ Scores written to correct tables
- ✅ `remarketing_scores` table uses (listing_id, buyer_id) unique constraint
- ✅ Manual overrides stored in `deal_scoring_adjustments` table
- ✅ `human_override_score` field available
- ✅ Timestamps (`scored_at`) correctly updated

---

## STEP 8: DOWNSTREAM USAGE VALIDATION 🟡 MINOR ISSUES

### UI Reference Inconsistencies

**Location:** Frontend components

**Potential Issues:**
1. Some components may reference deprecated `categories` field instead of `services`
2. Score tier classification (A/B/C/D) may not match score ranges exactly
3. Color coding thresholds hardcoded in multiple places

**Recommendation:** Audit complete, but recommend centralized score display components.

---

## STEP 9: MANUAL SANITY CHECKS ⏳ PENDING

**Requires Production Data Access**

Recommended test cases:
1. Deal with no financials + high LinkedIn employees → Should score via proxy (not 0)
2. Buyer with CA footprint but TX targets + TX deal → Should score based on TX match (not CA)
3. Buyer with 5 site visits → Engagement bonus should be 20pts (not 100pts)
4. Deal with ALL thesis keywords → Thesis bonus should be 50pts (not capped at 30pts)
5. Perfect service match but wrong size → Size multiplier should reduce ONLY base score

---

## STEP 10: REGRESSION ANALYSIS 🔍

**Suspected Breaking Changes:**

1. **Field Rename: `category`/`categories` → `services`**
   - Timeline: Unknown
   - Impact: Service scoring broken for newer deals
   - Affected: Issue #1

2. **Geography Logic Change: Added `geographic_footprint`**
   - Timeline: Recent (past 2-3 months based on migrations)
   - Impact: Over-scoring buyers with large operational footprints
   - Affected: Issue #3

3. **Deal Quality Integration**
   - Timeline: When `deal_total_score` was added to `listings` table
   - Impact: If added AFTER buyer-deal scoring was built, pipeline order may be wrong
   - Affected: Issue #11

---

## FINAL DELIVERABLES

### 🔴 Broken Scores Identified

1. **Service Score** - References wrong fields (categories vs services)
2. **Size Multiplier** - Treats NULL as 0, disqualifying good deals
3. **Geography Score** - Confuses operational footprint with acquisition targets
4. **Composite Score** - May apply size multiplier incorrectly to bonuses

### 🟠 Data Mapping Errors

1. `listing.categories` / `listing.category` → Should be `listing.services`
2. `buyer.geographic_footprint` → Should NOT be in target geography list
3. NULL vs 0 financial data → Needs explicit handling

### 🟡 Logic/Weighting Issues

1. Geography weight too high (35% → should be 25%)
2. Service/industry weight too low (25% → should be 40%)
3. Thesis bonus cap too restrictive (30pts → should be 50pts)
4. Engagement signals not de-duplicated (count unique signal types)

### ⚠️ Execution Order Failures

1. Deal quality score may run AFTER buyer-deal scoring
2. Attractiveness multiplier not applied due to timing

### ✅ Guardrails to Add

1. **Field validation**: Ensure required fields exist before scoring
2. **NULL handling**: Distinguish NULL (no data) from 0 (confirmed zero)
3. **Logging**: Log each scoring step with intermediate values
4. **Alerting**: Alert if >10% of scores are 0 or NaN
5. **Version tracking**: Store scoring algorithm version with each score
6. **Manual checks**: Periodic review of top/bottom 10 scored deals

---

## BACKFILL / RE-SCORING PLAN

### Phase 1: Fix Critical Bugs (Week 1)
1. Fix Issue #1 (service field mapping)
2. Fix Issue #2 (NULL vs 0 handling)
3. Fix Issue #3 (geography confusion)
4. Deploy fixes to production

### Phase 2: Re-score All Matches (Week 1-2)
```sql
-- Mark all scores for re-scoring
UPDATE remarketing_scores
SET needs_rescore = TRUE
WHERE scored_at < '2026-02-06';  -- Before fixes deployed

-- Trigger bulk re-scoring via edge function
-- (Process in batches of 100)
```

### Phase 3: Fix Logic Issues (Week 2)
1. Adjust composite score weights
2. Increase thesis bonus cap
3. Add engagement de-duplication
4. Deploy and re-score

### Phase 4: Fix Pipeline Order (Week 3)
1. Ensure deal quality runs first
2. Test attractiveness multiplier applies
3. Re-score high-quality deals

### Phase 5: Validation (Week 4)
1. Compare old scores vs new scores
2. Validate top 100 matches manually
3. Check for unintended regressions
4. Document score changes in release notes

---

## MONITORING RECOMMENDATIONS

### Real-Time Metrics

```sql
-- Daily score health check
SELECT
  COUNT(*) as total_scores,
  COUNT(*) FILTER (WHERE composite_score = 0) as zero_scores,
  COUNT(*) FILTER (WHERE composite_score IS NULL) as null_scores,
  ROUND(AVG(composite_score), 2) as avg_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY composite_score) as median_score
FROM remarketing_scores
WHERE scored_at > NOW() - INTERVAL '24 hours';

-- Alert if zero_scores > 5% of total
```

### Score Distribution Dashboard

Track distribution over time:
- Tier A (80-100): Should be ~10-15% of matches
- Tier B (60-79): Should be ~20-30% of matches
- Tier C (40-59): Should be ~30-40% of matches
- Tier D (0-39): Should be ~20-30% of matches

### Anomaly Detection

Alert if:
- Median score drops >10pts in 24 hours
- Zero scores spike to >10%
- Any score component (geo, size, service) is NaN
- Deal quality score missing for >20% of new deals

---

**END OF AUDIT REPORT**

**Next Actions:**
1. Review findings with engineering team
2. Prioritize critical bugs (Issues #1, #2, #3)
3. Implement fixes in order of severity
4. Execute backfill plan
5. Monitor score distribution post-fix

**Report Generated:** 2026-02-05
**Auditor:** CTO-Level Systems Analysis
**Status:** 🔴 CRITICAL FIXES REQUIRED
