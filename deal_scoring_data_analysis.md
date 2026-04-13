# Deal Lead Prioritization — Real Data Analysis (All Sources)

**Date:** 2026-04-12
**Dataset:** 6,682 unworked leads across ALL sources
**Filters:** `pushed_to_all_deals = false/null`, `not_a_fit = false/null`, `remarketing_status = active/null`

---

## 1. Population Overview

| Source                 | Count | %     | Avg Old Score | Avg New Score |
| ---------------------- | ----- | ----- | ------------- | ------------- |
| CapTarget              | 6,315 | 94.5% | 25.6          | 22.0          |
| GP Partners            | 179   | 2.7%  | 24.3          | 30.7          |
| Valuation Calculator   | 75    | 1.1%  | 90.0          | 14.0          |
| SourceCo               | 37    | 0.6%  | 18.5          | 34.9          |
| Referral               | 32    | 0.5%  | 66.1          | 43.2          |
| Manual                 | 30    | 0.4%  | 60.6          | 25.8          |
| Marketplace            | 11    | 0.2%  | 61.2          | 40.3          |
| Salesforce Remarketing | 3     | 0.04% | n/a           | 5.7           |

---

## 2. Data Completeness by Source

### Signal Availability (% of leads with signal present)

| Signal             | CapTarget (6315) | GP Partners (179) | Val Calc (75) | SourceCo (37) | Referral (32) | Manual (30) | Marketplace (11) |
| ------------------ | ---------------- | ----------------- | ------------- | ------------- | ------------- | ----------- | ---------------- |
| Website            | 100%             | 95.0%             | 96.0%         | 100%          | 100%          | 100%        | 100%             |
| Enriched           | 99.95%           | 100%              | 93.3%         | 94.6%         | 100%          | 66.7%       | 100%             |
| Industry           | 99.9%            | 100%              | 100%          | 100%          | 100%          | 100%        | 100%             |
| Contact info       | 100%             | 99.4%             | 100%          | 100%          | 53.1%         | 50.0%       | 45.5%            |
| Exec summary       | 93.8%            | 100%              | 81.3%         | 97.3%         | 100%          | 73.3%       | 100%             |
| State              | 96.3%            | 96.6%             | 80.0%         | 100%          | 100%          | 63.3%       | 100%             |
| Google rating      | **75.7%**        | **91.6%**         | 0%            | **91.9%**     | **90.6%**     | 50.0%       | 90.9%            |
| Google reviews     | **42.9%**        | **91.6%**         | 0%            | **91.9%**     | **84.4%**     | 40.0%       | 90.9%            |
| Locations          | 34.3%            | **50.8%**         | 38.7%         | **75.7%**     | 53.1%         | 56.7%       | 81.8%            |
| LinkedIn employees | **29.2%**        | **39.1%**         | 0%            | **29.7%**     | **84.4%**     | 36.7%       | 90.9%            |
| Mgmt depth         | 0.02%            | **86.0%**         | 0%            | **94.6%**     | **43.8%**     | 23.3%       | 36.4%            |
| Services array     | 0.6%             | **88.8%**         | 61.3%         | **89.2%**     | 34.4%         | 73.3%       | 36.4%            |
| Financials         | 0%               | **17.3%**         | **100%**      | 18.9%         | 18.8%         | **80.0%**   | 90.9%            |
| Call notes         | 99.9%            | 1.1%              | 0%            | 0%            | 0%            | 0%          | 0%               |
| FTE                | 0%               | 8.4%              | 0%            | 13.5%         | 0%            | 0%          | 0%               |

### Key Patterns by Source

**CapTarget (6,315):** Has website + call notes + interest type on everything. Google data on ~75%. LinkedIn on only 29%. Zero financials. Zero management depth. The formula MUST work without LinkedIn and without financials for this source.

**GP Partners (179):** Much richer data — 92% have Google, 86% have management depth, 89% have services, 39% have LinkedIn. BUT only 17% have financials. This source benefits most from the proposed quality scoring (management depth + services + recurring revenue keywords).

**Valuation Calculator (75):** 100% have financials (revenue + EBITDA) — they submitted them via the calculator. But 0% have LinkedIn, 0% have Google data. The proposed formula completely ignores their strongest signal (financials) and scores them at avg 14. The old system hardcoded them at 90. **Both are wrong** — these leads have real financials that should be scored.

**Referral (32):** Best enrichment across the board — 84% LinkedIn, 84% Google reviews. These score highest with the proposed formula (avg 43.2). This makes sense — referral leads tend to be better vetted.

**SourceCo (37):** Similar richness to GP Partners. Well-enriched. Proposed formula scores them well (avg 34.9, up from 18.5 old).

**Manual (30):** 80% have financials but old system scored them at avg 60.6, proposed drops to 25.8. Same problem as valuation calculator — formula ignores financials.

**Marketplace (11):** Small but data-rich (91% LinkedIn, 91% Google). Formula works well here.

---

## 3. Score Comparison: Old vs New by Source

| Source      | Old Avg | Old Median | New Avg | New Median | New Min | New Max | Verdict                                    |
| ----------- | ------- | ---------- | ------- | ---------- | ------- | ------- | ------------------------------------------ |
| CapTarget   | 25.6    | 20         | 22.0    | 17         | 2       | 78      | Slightly worse spread                      |
| GP Partners | 24.3    | 16         | 30.7    | 29         | -5      | 71      | **Better — uses mgmt depth & services**    |
| Val Calc    | 90.0    | 0          | 14.0    | 13         | 0       | 55      | **Broken — ignores financials**            |
| SourceCo    | 18.5    | 14         | 34.9    | 36         | 10      | 57      | **Much better — was severely underscored** |
| Referral    | 66.1    | 65         | 43.2    | 47         | 13      | 64      | Reasonable but lost the top end            |
| Manual      | 60.6    | 0          | 25.8    | 25         | 2       | 61      | **Broken — ignores financials**            |
| Marketplace | 61.2    | 75         | 40.3    | 41         | 14      | 62      | Compressed range                           |

---

## 4. Top 15 GP Partners Leads (Proposed Score)

| #   | Company                    | Industry         | Employees | Locations | Reviews | Rating | Revenue  | Mgmt Depth | Old | New |
| --- | -------------------------- | ---------------- | --------- | --------- | ------- | ------ | -------- | ---------- | --- | --- |
| 1   | GC Northwest LLC           | Restoration      | 351       | 1         | 1       | 5.0    | —        | $5M EBITDA | 94  | 71  |
| 2   | Peters Body & Fender       | Auto Body        | 121       | 1         | 90      | 4.7    | —        | Yes        | 58  | 69  |
| 3   | Ray's Auto Body Crafters   | Auto Body        | 251       | 1         | 63      | 4.7    | —        | Yes        | 64  | 68  |
| 4   | Onspring                   | SaaS (GRC)       | 112       | 0         | 2       | 4.0    | $30M rev | Yes        | 94  | 61  |
| 5   | Bug Busters Pest Control   | Pest Control     | 25        | 0         | 622     | 4.8    | —        | Yes        | 46  | 60  |
| 6   | Randy Hall                 | Vacation Rentals | 60        | 1         | 5       | 3.4    | —        | Yes        | 52  | 59  |
| 7   | JC Beal Construction       | Construction     | 46        | 0         | 18      | 4.8    | —        | Yes        | 49  | 59  |
| 8   | Jerry's Auto Build         | Collision Repair | 62        | 1         | 31      | 4.6    | $1M rev  | Yes        | 24  | 57  |
| 9   | Road Art Paint & Collision | Auto Body        | 73        | 1         | 25      | 5.0    | —        | Yes        | 52  | 57  |
| 10  | Davis Roofing              | Roofing          | 13        | 811\*     | 61      | 4.8    | —        | Yes        | 64  | 55  |

\*Davis Roofing 811 locations is clearly bad data — enrichment error.

**GP Partners assessment:** The formula works reasonably well here. It correctly ranks larger companies with strong reviews higher. Management depth bonus (+6) helps differentiate since 86% of GP leads have it. Jerry's Auto Build jumped from 24 to 57 — the old system undersold a 62-employee company with real financials.

---

## 5. Top 15 Referral Leads (Proposed Score)

| #   | Company                  | Industry                | Employees | Locations | Reviews | Rating | Old | New |
| --- | ------------------------ | ----------------------- | --------- | --------- | ------- | ------ | --- | --- |
| 1   | MKB Construction         | Construction            | 122       | 0         | 5       | 4.2    | 74  | 64  |
| 2   | Pella Windows & Doors WI | Window/Door Sales       | 80        | 3         | 520     | 4.8    | 80  | 62  |
| 3   | Hansen-Rice Inc.         | Industrial Design-Build | 142       | 0         | 7       | 4.4    | 73  | 61  |
| 4   | All Trades Mechanical    | Mechanical Services     | 46        | 1         | 2       | 5.0    | 62  | 56  |
| 5   | Radius Track Corp        | Construction            | 121       | 1         | 10      | 4.1    | 74  | 55  |
| 6   | Juel Group               | Waste Management        | 37        | 5         | 35      | 4.7    | 67  | 55  |
| 7   | Phillips Companies       | Construction Materials  | 37        | 5         | 37      | 4.4    | 62  | 53  |

**Referral assessment:** Scores compressed vs the old system (avg 66 → 43). The old system gave referrals a source-based bonus that the proposed formula removes. The relative ranking within referrals is still sensible — Pella Windows (80 employees, 3 locations, 520 reviews) ranks near the top.

---

## 6. Valuation Calculator Problem (CRITICAL)

The proposed formula scores valuation calculator leads at avg **14.0** — down from the old hardcoded 90. This is because:

- 0% have LinkedIn employees → size_score = 0
- 0% have Google reviews → no Google signal
- No management depth, no services
- Only get points for: locations (38.7%), website (+2), city/state

But these leads have **actual financials**:

| Company                   | Revenue | EBITDA | Locations | New Score |
| ------------------------- | ------- | ------ | --------- | --------- |
| Ceremony Coffee           | $10M    | $2M    | 6         | 55        |
| Watts Vault               | $5.8M   | $1.1M  | 4         | 45        |
| Sims Funerals             | $1.5M   | $330K  | 4         | 45        |
| Money Lion                | $50M    | $35M   | —         | 19        |
| Land Scape Garden Centers | $10M    | $600K  | 1         | 19        |
| Gilbert Home Comfort      | $5M     | $600K  | 1         | 19        |

**Money Lion ($50M revenue, $35M EBITDA) scores 19.** That's absurd. A company self-reporting $50M revenue should score higher than a CapTarget lead with 5 LinkedIn employees and no financials.

**The formula MUST include a financials dimension** for leads that have it. Proposed fix:

```
FINANCIALS BONUS (0-25, only when revenue or ebitda present):
  ebitda >= 5M → +25
  ebitda >= 2M → +20
  ebitda >= 1M → +15
  revenue >= 10M → +15
  revenue >= 5M → +10
  revenue >= 2M → +5
```

This applies to val calc (100%), manual (80%), GP Partners (17%), and marketplace (91%).

---

## 7. Score Distribution — Proposed Formula (All Sources)

| Score Band | CapTarget | GP Partners | Val Calc  | SourceCo | Referral | Manual |
| ---------- | --------- | ----------- | --------- | -------- | -------- | ------ |
| 0-10       | 15.1%     | 10.6%       | 42.7%     | 0%       | 0%       | 16.7%  |
| 11-20      | **48.0%** | 19.0%       | **37.3%** | 10.8%    | 6.3%     | 30.0%  |
| 21-30      | 13.2%     | 15.1%       | 9.3%      | 16.2%    | 6.3%     | 16.7%  |
| 31-40      | 10.7%     | 18.4%       | 4.0%      | 29.7%    | 15.6%    | 6.7%   |
| 41-50      | 8.1%      | 18.4%       | 5.3%      | 29.7%    | 28.1%    | 16.7%  |
| 51-60      | 3.7%      | 12.8%       | 1.3%      | 13.5%    | 28.1%    | 10.0%  |
| 61-70      | 0.8%      | 3.4%        | 0%        | 0%       | 15.6%    | 3.3%   |
| 71-80      | 0.2%      | 2.2%        | 0%        | 0%       | 0%       | 0%     |

**CapTarget:** Still clusters at 11-20 (48%). The formula doesn't differentiate the bulk of leads.

**GP Partners:** Best spread — relatively even distribution from 11 to 60. The management depth, services, and recurring revenue keyword signals work well here.

**Val Calc:** 80% score 0-20. Completely broken — ignores their financials.

**SourceCo:** Good spread (11-57), concentrates in 31-50 range. Formula works well.

**Referral:** Best scoring source — good spread from 13-64, concentration in 41-60. These are the best-vetted leads with the most data.

---

## 8. Failure Modes Identified

### 1. Financials Blindspot (CRITICAL)

The formula has zero weight for revenue/EBITDA. This means:

- 75 valuation calculator leads with real financials score 14 avg
- Money Lion ($50M rev) scores 19
- Matrix Basements ($90M rev, $5M EBITDA) scores 48
- Meanwhile a CapTarget lead with 10 LinkedIn employees and no financials scores 15+

**Fix: Add financials bonus tier (0-25 points).**

### 2. CapTarget Bulk Clustering

48% of CapTarget leads (3,031) score 11-20. These are leads with:

- A website (+2)
- A city (+5) and state (+3)
- Maybe a Google rating 4.0+ (+2)
- No LinkedIn, no notable reviews, no locations
  Total: ~12-17 points. There's nothing to differentiate them.

**Fix: For CapTarget specifically, use interest_type (+5 for "interest") and call_notes NLP to add 5-10 points of spread.**

### 3. Location Data Errors

Several leads have obviously wrong location counts:

- Scientific Technologies: 75,000 locations
- Davis Roofing: 811 locations
- Soloinsight: 411 locations

These are enrichment artifacts. The formula needs a sanity cap on locations (e.g., cap at 50).

### 4. Public Company Contamination

Top ranks include Startek (21K employees), SpartanNash (4.2K), Curtiss-Wright (5.7K), Capgemini (335K). These aren't LMM targets.

**Fix: Flag or cap at 500 employees.**

### 5. Source-Specific Data Patterns Ignored

Each source has different data strengths:

- CapTarget: call notes + interest type (99.9% coverage) — ignored
- GP Partners: management depth + services (86-89%) — used, works well
- Val Calc: revenue + EBITDA (100%) — completely ignored
- Referral: LinkedIn (84%) — used, works well

**The formula should adapt scoring weights based on which signals are present**, not use a one-size-fits-all approach.

---

## 9. What Percentage of Leads Are Scorable?

| Level                               | Count | %     | Description                                          |
| ----------------------------------- | ----- | ----- | ---------------------------------------------------- |
| Has at least 1 proxy signal         | 5,732 | 85.8% | LinkedIn OR Google reviews OR rating OR 2+ locations |
| Has a strong differentiating signal | 2,766 | 41.4% | LinkedIn employees OR 50+ reviews OR 3+ locations    |
| Has financials                      | 153   | 2.3%  | Revenue > 0 or EBITDA > 0                            |
| Truly unscorable                    | ~950  | 14.2% | No proxy signals at all                              |
