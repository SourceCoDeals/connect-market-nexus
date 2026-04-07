

# Memo v5 Assessment: Almost There — One Issue Remains

## What's Correct (verified against all sources)

| Data Point | Memo Value | Source | Verdict |
|---|---|---|---|
| Revenue | $6,250,000 | Call 3 transcript + enrichment | Correct |
| EBITDA | $650,000 | Enrichment/general_notes | Correct (analyst notes flag as unverified) |
| EBITDA Margin | 10.4% | Calculated ($650K/$6.25M) | Correct — better than using enrichment's 10.83% |
| Google Rating | 4.7 (46 reviews) | listings.google_rating | Correct — NEW, wasn't in v4 |
| Founded | 1999 | listings.founded_year | Correct |
| Locations | 2 (Sebring, South Daytona) | listings.number_of_locations + real_estate_info | Correct |
| Growth Drivers | Geographic, commercial, Directorii | listings.growth_drivers | Correct — NEW |
| Certified Valuation | Mentioned | listings.general_notes | Correct — NEW |
| Transition Plan | Tim and Tracy, 6 months | Call 3 transcript | Correct |
| Directorii Partnership | Mentioned | listings.competitive_position | Correct |
| Services | Roofing + metal supply | Call 3 + enrichment | Correct |
| No omission language | — | — | Fixed — no "not on file" in memo body |
| No third-party platform language | — | — | Fixed — no Latite/Sun Capital/centralized system |

## One Remaining Issue

**"Headcount: 25 full-time employees; 15 per LinkedIn employee count"** — This line in MANAGEMENT AND STAFFING still contrasts two data sources. The prompt rule says "pick the highest-priority figure and state it alone." It should just say "25 full-time employees."

### Root Cause

The phrase "per LinkedIn employee count" doesn't match the current `SOURCE_CONTRAST_PATTERNS`. The only LinkedIn pattern is `/\bLinkedIn[\s-]*report/i` which catches "LinkedIn-reported" but NOT "per LinkedIn employee count." The line also survives the source-contrast check in the semicolon splitter because "15 per LinkedIn employee count" matches neither pattern.

## Analyst Notes Assessment: Excellent

The analyst notes correctly:
- Flag EBITDA as unverified (only in enrichment, not owner-confirmed)
- Note revenue is from Call 3 third-party meeting context
- Flag the 1-location vs 2-location conflict in general_notes vs enrichment
- Flag key quotes as third-party characterizations
- Note the EBITDA margin discrepancy (10.83% stored vs 10.4% calculated)
- List all known data gaps accurately

One minor note: the analyst notes say "Enrichment data lists 25 full-time employees" — but `full_time_employees: 25` is on the listings table directly (the enrichment source), while `linkedin_employee_count: 15` is a separate field. Both are correct characterizations.

## Fix

### File: `supabase/functions/generate-lead-memo/index.ts`

**1. Broaden LinkedIn source-contrast pattern** (line 812)

Change `/\bLinkedIn[\s-]*report/i` to a broader pattern that catches all LinkedIn source references:
```
/\bLinkedIn\b/i
```

This catches "LinkedIn-reported", "per LinkedIn employee count", "LinkedIn data", etc. There is no legitimate reason for the word "LinkedIn" to appear in an investor-facing memo.

**2. Add "per [source]" pattern**

Add a new pattern to catch "per LinkedIn", "per enrichment", "per internal data" etc.:
```
/\bper\s+LinkedIn\b/i
```

Actually the broad `/\bLinkedIn\b/i` pattern above covers this. One pattern suffices.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-lead-memo/index.ts` | Broaden LinkedIn pattern from `/\bLinkedIn[\s-]*report/i` to `/\bLinkedIn\b/i` |

## Post-Change
Redeploy edge function. Regenerate memo to verify the headcount line shows only "25 full-time employees" without the LinkedIn contrast.

