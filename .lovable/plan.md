

# Memo Quality Issues + Teaser Gap

## Assessment of the Generated Memo

The data expansion worked — the memo now includes customer geography, Directorii partnership, real estate, transition plan, and Tim/Tracy details. The analyst notes are comprehensive and properly separated. However, several quality issues remain in the memo body:

### Issues Found in the Memo Body

1. **"not on file" language leaked into the memo** — violates the prompt's Rule 2 ("OMIT, DON'T APOLOGIZE"):
   - "owned vs. leased status and lease terms are not on file" (OWNERSHIP AND TRANSACTION)
   - "entity structure across locations is not on file" (KEY STRUCTURAL NOTES)
   - "Real estate ownership structure (owned vs. leased) for both offices is not on file" (KEY STRUCTURAL NOTES)
   - "No valuation expectation or asking price has been stated" (KEY STRUCTURAL NOTES)
   - "Day-to-day operational role of the owner and depth of management below Tim and Tracy are not on file" (MANAGEMENT AND STAFFING)

2. **Source conflict commentary leaked into memo body** — violates the conflict rules:
   - "LinkedIn-reported employee count: 15; full-time headcount per internal data: 25" (SERVICES AND OPERATIONS) — This is analyst-level commentary. The memo should just state "25" and move on.

3. **Seller motivation accuracy concern**: The memo states "Austin Hedrick is ready to sell immediately" — this comes from `seller_motivation` (source: `notes`, priority 80). But Call 1 transcript shows Austin denied prior contact with SourceCo and was non-committal. Call 3 was a third-party meeting with Latite Roofing, not a SourceCo engagement. The "ready to sell immediately" characterization is analyst inference, not a confirmed owner statement.

4. **"considered for partnership to resolve conflicts and enhance growth"** — This is language from the Call 3 summary (Latite Roofing meeting), attributed to Austin in the memo as if he said it to SourceCo. Context is missing.

### Root Cause

The prompt says "OMIT, DON'T APOLOGIZE" but Claude still generates "not on file" language. The post-processing validation catches `/\bnot\s*stated\b/i` and `/\bnot\s*confirm/i` but does NOT catch:
- "not on file"
- "not available"  
- "unknown"
- "not discussed"
- "not provided" (partially caught)
- Source conflict descriptions like "LinkedIn reports X; internal data shows Y"

### Teaser Coverage

The anonymous teaser already benefits from the expanded `buildDataContext` (same function feeds both memo types). The teaser prompt itself is solid — it has the same OMIT/DON'T APOLOGIZE rule and similar quality standards. No changes needed for the teaser prompt specifically.

## Changes

### File: `supabase/functions/generate-lead-memo/index.ts`

**1. Expand the post-processing validation patterns** (~line 1343-1348)

Add these patterns to `ANALYST_LANGUAGE_PATTERNS`:
- `/\bnot\s*on\s*file\b/i`
- `/\bnot\s*available\b/i`
- `/\bnot\s*discussed\b/i`
- `/\bnot\s*provided\b/i`
- `/\bis\s*unclear\b/i`
- `/\bis\s*unknown\b/i`
- `/\bLinkedIn[\s-]*reported\b/i` (catches source attribution)
- `/\bper\s*(internal|enrichment|manual)\s*data\b/i`
- `/\binternal\s*data\b/i`

**2. Add a post-processing strip step for "not on file" bullets**

After `enforceBannedWords` and `stripDataNeededTags`, add a new post-processing function `stripOmissionLanguage` that:
- Removes entire bullet lines where the primary content is an apology for missing data (e.g., lines matching "not on file", "not available", "is unknown", "is unclear", "are unknown")
- Removes source-conflict commentary lines (e.g., "LinkedIn-reported... internal data...")
- Does NOT remove lines where "not" appears in a factual context (e.g., "Owner has not pursued commercial contracts")

Heuristic: if a bullet line contains a "not on file/available/discussed/provided" phrase AND does not contain a dollar amount or percentage, strip it.

**3. Strengthen the prompt's OMIT rule** (~line 1169)

Change Rule 2 from:
```
OMIT, DON'T APOLOGIZE: When data is missing, leave it out. Never write "not provided", "not stated", "not confirmed", "not discussed", or any variation.
```
To:
```
OMIT, DON'T APOLOGIZE: When data is missing, leave it out entirely. Never write "not provided", "not stated", "not confirmed", "not discussed", "not on file", "not available", "is unknown", "is unclear", or any variation. If a bullet point would only say that something is missing, do not include that bullet point. Do not contrast data sources (e.g., "LinkedIn reports X; internal data shows Y") — pick the highest-priority figure and state it alone.
```

**4. Add source-contrast rule to conflict instructions** (~line 1182)

Add after "Do not qualify the figure":
```
Do not mention the names of data sources (LinkedIn, enrichment, internal data, manual entry) in the memo body. Present the chosen figure as a simple fact.
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-lead-memo/index.ts` | Strengthen OMIT rule in prompt; expand validation patterns; add `stripOmissionLanguage` post-processing; add source-name ban to conflict rules |

## Post-Change

Redeploy `generate-lead-memo` edge function, then regenerate the Quality Roofing memo to verify improvement.

