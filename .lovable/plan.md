

# Improve Lead Memo Generation: More Data Sources + Better Copy Quality

## Problem

The memo for Quality Roofing & Sheet Metal is thin (2 pages, sparse bullet points) despite the database containing significantly more information that isn't being fed to the AI. Specifically:

1. **Missing data sources in `buildDataContext`**: 13+ populated fields on this deal are never passed to Claude:
   - `financial_notes` — contains revenue/projection context and EBITDA absence note
   - `financial_followup_questions` — 5 specific questions that inform what's unverified
   - `key_quotes` — owner quotes for direct attribution
   - `scoring_notes` — scoring context
   - `competitive_position` — competitive intel about the business
   - `end_market_description` — market dynamics
   - `growth_trajectory` — growth data with revenue projections
   - `customer_types` — customer segments
   - `customer_geography` — geographic reach (Central Florida, Highlands to Volusia County)
   - `real_estate_info` — office locations (Sebring and South Daytona)
   - `technology_systems` — centralized system details
   - `revenue_source_quote` / `ebitda_source_quote` — direct quotes supporting financials
   - `special_requirements` — transition plan details (Tim and Tracy training)
   - `transition_preferences` — structured handover info

2. **Analyst notes reveal the memo quality issue**: The analyst notes correctly flag that the generated memo is thin — no customer info, no geographic detail, no management depth, no financial follow-up context. All of this data EXISTS in the database but was never passed to the AI.

3. **The prompt doesn't instruct Claude to use these richer fields for depth**: Even fields already passed (like `competitive_position`, `growth_trajectory`) aren't being leveraged because the prompt's section structure is too rigid for thin deals.

## Changes

### File: `supabase/functions/generate-lead-memo/index.ts`

**1. Expand `buildDataContext` enrichment and manual fields** (~lines 436-488)

Add these to `enrichmentFields` (already queried via `select('*')`):
- `financial_notes`
- `financial_followup_questions`
- `key_quotes`
- `scoring_notes`
- `competitive_position` (already there)
- `end_market_description`
- `growth_trajectory`
- `customer_types`
- `customer_geography`
- `real_estate_info`
- `technology_systems`
- `revenue_source_quote`
- `ebitda_source_quote`

Add these to `manualFields`:
- `special_requirements`
- `transition_preferences`
- `timeline_preference`

**2. Improve the full memo system prompt** (~lines 1141-1201)

Enhance the section definitions to instruct Claude to use available data more thoroughly:

- **COMPANY OVERVIEW**: Instruct to include customer geography, competitive positioning, and end market context when available
- **FINANCIAL SNAPSHOT**: Instruct to include revenue source quotes, financial notes context, and any projection figures (labeled as projections)
- **SERVICES AND OPERATIONS**: Instruct to include service mix breakdown, customer types, technology systems, and end market dynamics when available
- **OWNERSHIP AND TRANSACTION**: Instruct to include transition preferences, special requirements, timeline, and real estate when available
- **MANAGEMENT AND STAFFING**: Instruct to include named key personnel from transition plans
- **KEY STRUCTURAL NOTES**: Instruct to include real estate details, technology platform context

Also add a data density instruction: "When rich data is available across multiple sources, use it. A deal with competitive positioning, customer geography, financial notes, key quotes, and transition plans should produce a 900-1200 word memo — not a 300 word skeleton."

**3. Feed `key_quotes` and `financial_followup_questions` as structured context**

These are arrays. Format them as labeled blocks in the data context:
```
--- KEY QUOTES (owner statements) ---
"Austin's roofing and metal supply businesses, generating $6.25 million..."

--- FINANCIAL FOLLOW-UP QUESTIONS (known gaps) ---
- What is the current EBITDA and historical EBITDA trend?
- What are the key assumptions behind the projected $11.5M revenue?
```

The financial follow-up questions feed the analyst notes (gaps to flag), while key quotes feed the memo body (attributable facts).

**4. Improve analyst notes prompt to use `financial_followup_questions`**

The analyst notes block instruction should explicitly tell Claude to incorporate the financial follow-up questions as known data gaps, since they represent what's already been identified as missing.

## What This Fixes for Quality Roofing

With these changes, the regenerated memo would include:
- Customer geography (Central Florida, Highlands to Volusia County)
- Competitive positioning (Directorii partnership, trusted local choice)
- Real estate (offices in Sebring and South Daytona)
- End market context (roofing consolidation market)
- Transition plan details (6-month training for Tim and Tracy)
- Financial context (revenue source quote, projection context)
- Owner quotes from `key_quotes` array
- Analyst notes would flag all 5 financial follow-up questions as known gaps

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-lead-memo/index.ts` | Expand `buildDataContext` fields; enhance prompt section instructions; format arrays as structured context blocks |

## Post-Change

Edge function `generate-lead-memo` must be redeployed. Then regenerate the Quality Roofing memo to verify improvement.

