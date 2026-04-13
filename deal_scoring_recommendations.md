# Deal Lead Scoring — Recommendations (All Sources)

**Date:** 2026-04-12
**Based on:** 6,682 unworked leads across 8 deal sources

---

## The Verdict

The proposed formula is a **significant improvement** over v4 for GP Partners, SourceCo, and referral leads. It correctly uses management depth, services, recurring revenue keywords, and LinkedIn employees — signals those sources actually have.

But it has **three critical problems**:

1. **Completely ignores financials** — valuation calculator leads ($50M revenue companies) score 19
2. **Still clusters 48% of CapTarget leads in one band** (11-20) — doesn't differentiate the bulk
3. **No upper-bound filter** — ranks publicly traded companies at #1

---

## Source-by-Source Verdict

| Source          | Formula Works? | Why                                                                                                        |
| --------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| **GP Partners** | **Yes**        | Management depth + services + recurring revenue keywords provide good spread (avg 30.7, range -5 to 71)    |
| **SourceCo**    | **Yes**        | Same rich data as GP Partners. Score jumped from avg 18.5 to 34.9 — was severely underscored               |
| **Referral**    | **Mostly**     | Best data, best spread. But lost the top end vs old system (66→43 avg) because old system had source bonus |
| **Marketplace** | **Yes**        | Data-rich leads, formula works (avg 40.3)                                                                  |
| **CapTarget**   | **No**         | 48% cluster at 11-20. Formula can't differentiate 4,470 leads without LinkedIn                             |
| **Val Calc**    | **Broken**     | Dropped from 90 to 14. Formula ignores their strongest signal (real financials)                            |
| **Manual**      | **Broken**     | Same — 80% have financials that the formula ignores                                                        |

---

## Revised Formula

### Size Proxy (0-45) — keep as proposed, with fixes

```
linkedin_employee_count >= 500 → 34 (cap — likely too large for LMM)
linkedin_employee_count >= 200 → 45
linkedin_employee_count >= 100 → 40
linkedin_employee_count >= 50  → 34
linkedin_employee_count >= 25  → 27
linkedin_employee_count >= 15  → 21
linkedin_employee_count >= 10  → 15
linkedin_employee_count >= 5   → 9
linkedin_employee_count >= 1   → 5

No LinkedIn fallbacks:
  number_of_locations >= 5 (capped at 50) → 22
  number_of_locations >= 3 (capped at 50) → 16
  google_review_count >= 200 AND google_rating >= 4.0 → 18
  google_review_count >= 100 AND google_rating >= 4.0 → 14
  google_review_count >= 50 → 9
  Otherwise → 0
```

### Financials Bonus (0-25) — NEW DIMENSION

```
Only applies when revenue > 0 OR ebitda > 0:
  ebitda >= 5,000,000 → 25
  ebitda >= 2,000,000 → 20
  ebitda >= 1,000,000 → 15
  ebitda >= 500,000   → 10
  revenue >= 10,000,000 (no ebitda) → 15
  revenue >= 5,000,000  (no ebitda) → 10
  revenue >= 2,000,000  (no ebitda) → 5
```

This fixes:

- Money Lion ($50M rev, $35M EBITDA) → +25 instead of 0
- Ceremony Coffee ($10M rev, $2M EBITDA) → +20 instead of 0
- Gilbert Home Comfort ($5M rev, $600K EBITDA) → +10 instead of 0

### Business Quality (0-35) — enhanced

```
number_of_locations >= 5 (cap at 50)  → +10
number_of_locations >= 3 (cap at 50)  → +6
management_depth present & != 'weak'  → +6
exec_summary has recurring/contract/maintenance/subscription keywords → +6
google_rating >= 4.5 AND google_review_count >= 50 → +6  (combined signal)
google_rating >= 4.0 AND google_review_count >= 100 → +4  (combined signal)
google_rating >= 4.5 (standalone, no reviews) → +2
google_review_count >= 100 (standalone) → +4
services array >= 3 items → +3
website present → +2
website missing → -5

NEW — CapTarget-specific:
captarget_interest_type = 'interest' → +5
captarget_interest_type = 'keep_in_mind' → +2
```

### Market / Geography (0-20) — keep as proposed

```
Major metro city → +8
Other city → +5
State present → +3
3+ locations AND state → +4
```

### Total = Size + Financials + Quality + Market (capped at 100)

---

## Impact of Revised Formula

### Valuation Calculator (was broken, now fixed)

| Company              | Revenue | EBITDA | Old New Score | Revised Score       |
| -------------------- | ------- | ------ | ------------- | ------------------- |
| Money Lion           | $50M    | $35M   | 19            | 44 (+25 financials) |
| Ceremony Coffee      | $10M    | $2M    | 55            | 75 (+20 financials) |
| Watts Vault          | $5.8M   | $1.1M  | 45            | 60 (+15 financials) |
| Gilbert Home Comfort | $5M     | $600K  | 19            | 29 (+10 financials) |

### CapTarget (better differentiation)

Adding interest_type (+5 for "interest") gives the 4,117 interested no-LinkedIn leads a boost, pulling them from 12-17 to 17-22 range. Combined with the improved Google composite signal, the 11-20 cluster should shrink from 48% to ~30%.

### GP Partners (already works well, minor improvement)

Combined Google signal (rating + reviews together) slightly improves ranking of leads like Bug Busters (622 reviews, 4.8 rating) over leads with a 5.0 rating and 1 review.

---

## Concrete Action Plan

### Phase 1: Immediate (this week)

1. **Add financials bonus** to scoring formula — fixes val calc and manual leads
2. **Cap locations at 50** — fixes Davis Roofing (811), Scientific Technologies (75K) enrichment errors
3. **Flag/cap leads with 500+ LinkedIn employees** — removes public company noise from rankings
4. **Add interest_type to quality score** — instant differentiation for 4,470 CapTarget leads

### Phase 2: Next sprint

5. **Switch Google rating to combined signal** (rating + reviews together)
6. **Add source-aware weighting** — don't score val calc leads the same way as CapTarget leads
7. **Bulk-mark ~950 unscorable leads** (no website, no Google, no LinkedIn, no state) as low priority

### Phase 3: Medium-term

8. **NLP on executive summaries** — 93.8% of CapTarget leads have them, but we only check 5 keywords. An AI classifier could extract owner age, recurring revenue %, growth trajectory, customer concentration
9. **NLP on call notes** — 95.5% of CapTarget leads have call notes. These contain real intel from CapTarget callers about the owner's interest level, timeline, and business quality

---

## The Real Top 20 Across All Sources (Revised Formula)

What the ranking SHOULD look like with financials bonus + interest type + caps:

| #   | Company               | Source      | Industry          | Key Signals                                  | Est. Revised Score |
| --- | --------------------- | ----------- | ----------------- | -------------------------------------------- | ------------------ |
| 1   | Ceremony Coffee       | Val Calc    | Coffee Roaster    | $10M rev, $2M EBITDA, 6 locations            | ~75                |
| 2   | Piper Fire Protection | CapTarget   | Fire Protection   | 113 employees, 5 locations, 832 reviews, 4.9 | ~72                |
| 3   | GC Northwest LLC      | GP Partners | Restoration       | 351 employees, $5M EBITDA, recurring rev     | ~71                |
| 4   | Onspring              | GP Partners | SaaS (GRC)        | 112 employees, $30M rev, $6M EBITDA          | ~86                |
| 5   | Peters Body & Fender  | GP Partners | Auto Body         | 121 employees, 90 reviews, 4.7 rating        | ~69                |
| 6   | Spin! Pizza           | CapTarget   | Restaurant        | 209 employees, 13 locations, 853 reviews     | ~75                |
| 7   | Smart Parking         | CapTarget   | Parking Solutions | 181 employees, 7 locations, 4.8 rating       | ~71                |
| 8   | MKB Construction      | Referral    | Construction      | 122 employees, Tempe AZ                      | ~64                |
| 9   | Pella Windows & Doors | Referral    | Window/Door Sales | 80 employees, 3 locations, 520 reviews       | ~62                |
| 10  | Watts Vault           | Val Calc    | Burial Vault Mfg  | $5.8M rev, $1.1M EBITDA, 4 locations         | ~60                |

**Key difference from proposed formula:** Onspring (GP Partners, $30M revenue, $6M EBITDA, 112 employees) now scores ~86 instead of 61. Companies with real financials surface properly.

---

## Summary

| Question                                        | Answer                                                |
| ----------------------------------------------- | ----------------------------------------------------- |
| Does the proposed formula work for GP Partners? | **Yes** — good spread, uses their data well           |
| Does it work for SourceCo?                      | **Yes** — much better than old system                 |
| Does it work for Referrals?                     | **Mostly** — good spread but compresses the top end   |
| Does it work for CapTarget?                     | **No** — 48% still cluster in one band                |
| Does it work for Val Calc?                      | **Broken** — scores $50M companies at 19              |
| What's the #1 fix?                              | **Add a financials bonus dimension**                  |
| What's the #2 fix?                              | **Add CapTarget interest_type to quality score**      |
| What's the #3 fix?                              | **Cap locations at 50, flag 500+ employee companies** |
