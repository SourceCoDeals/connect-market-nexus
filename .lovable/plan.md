

# Fix Remaining Memo Quality Issues (Round 4)

## Problems Found (verified against all data sources)

### Still broken from previous rounds

**1. Post-processing only filters bullet lines** — Root cause of two persistent issues:
- "owned vs. leased status has not been established" survives because it's a plain line, not a bullet (`- ` prefix)
- "integration into a broader roofing platform with centralized back-office support" survives for the same reason
- Line 829: `if (!/^[-*•]\s/.test(trimmed)) return true;` skips ALL non-bullet content

**2. Claude ignoring prompt instructions** despite correct data in context:
- Google rating (4.7, 46 reviews) — in enrichment context but not in memo
- EBITDA margin (10.4%) — prompt says to include, not shown
- Certified business valuation — `general_notes` says "business valuation done by certified appraiser, Documents ready to go" — prompt says to include, not shown
- Growth drivers (geographic expansion, commercial contracts, Directorii) — in context, not in memo

### Analyst notes quality: GOOD
The analyst notes are comprehensive, accurate, and properly separated. No changes needed there.

### What's correct in the memo
- Revenue $6.25M — correct, matches enrichment + Call 3
- EBITDA $650K — correctly sourced from enrichment (analyst notes properly flag as unverified)
- Employee count 25 — correct per priority rules
- Customer geography — correct
- Directorii partnership — correct
- Transition plan (Tim and Tracy, 6 months) — correct
- Two locations (Sebring, South Daytona) — correct
- Founded 1999 — correct per enrichment

## Changes

### File: `supabase/functions/generate-lead-memo/index.ts`

**1. Expand `stripOmissionLanguage` to process ALL lines, not just bullets** (~line 826-836)

Change the filter logic: instead of skipping non-bullet lines, apply omission and source-contrast checks to ALL lines. The "has factual data" exception (dollar amounts, percentages) still applies to prevent stripping lines like "Revenue: $6,250,000".

For non-bullet lines: if the entire line matches an omission or source-contrast pattern and contains no factual data, strip it. For semicolon-joined content (bullet or not), strip only the offending fragment.

**2. Strengthen prompt with more forceful language for underused fields**

Claude is ignoring soft instructions like "When available, include..." — change to mandatory-style:
- "You MUST include google_rating and google_review_count in the Company Overview if they appear in the data context."
- "You MUST include EBITDA Margin as a line in the Financial Snapshot when EBITDA and Revenue are both present. Calculate it: (EBITDA / Revenue) * 100."
- "You MUST check general_notes for mentions of a completed business valuation or appraisal and include it in Ownership and Transaction."
- "You MUST include growth_drivers as bullet points in a relevant section (Company Overview or Services and Operations) when present."

**3. Add explicit EBITDA margin calculation instruction**

Don't rely on a separate `ebitda_margin` field — tell Claude to calculate it from EBITDA/Revenue when both are present. This guarantees it appears.

**4. Expand third-party context patterns**

Add patterns for phrases that appear without bullet markers:
- `/\bdiscussions?\s*regarding\s*integration\b/i`
- `/\bcompeting\s*buyers?\b/i`
- `/\bacquisition\s*platform\b/i`

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-lead-memo/index.ts` | Remove bullet-only restriction in `stripOmissionLanguage`; strengthen prompt to MUST-include for google rating, EBITDA margin, valuation, growth drivers; add EBITDA margin calculation instruction; expand third-party patterns |

## Post-Change
Redeploy edge function. Regenerate Quality Roofing memo to verify: (1) no omission language on any line, (2) no third-party platform language, (3) Google 4.7-star rating present, (4) EBITDA margin shown, (5) certified valuation mentioned, (6) growth drivers included.

