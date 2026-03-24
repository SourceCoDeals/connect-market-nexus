
# Fix “No enrichment data available” for leads that already have intel

## What the issue actually is
Do I know what the issue is? Yes.

This is primarily a UI state bug, not an enrichment-generation bug for this lead.

I checked the database and `spotlightreporting.com` already has `enrichment_data` saved on its `match_tool_leads` row. But the panel stores a stale `selectedLead` object in local state, so after enrichment finishes and the list refetches, the open panel still renders the old lead object without the new `enrichment_data`.

That’s why the DB has intel, but the panel still says “No enrichment data available.”

## Plan

### 1. Fix the stale lead state in the dashboard
**File:** `src/pages/admin/remarketing/MatchToolLeads/index.tsx`

- Stop storing the full lead object in state
- Store only `selectedLeadId`
- Derive `selectedLead` from the latest `leads` query result on every render:
  - `const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null`
- This ensures the panel always receives the freshest row after React Query invalidates/refetches

This is the main fix.

### 2. Make the panel enrichment trigger smarter
**File:** `src/pages/admin/remarketing/MatchToolLeads/MatchToolLeadPanel.tsx`

- Keep the auto-enrich-on-open behavior, but only trigger when:
  - the panel is open
  - the lead exists
  - `lead.enrichment_data` is actually missing
- Update the effect dependencies so it reacts correctly to refreshed lead data
- Add a better temporary loading state message like:
  - “Generating company intel…”
  instead of falling straight to “No enrichment data available”

### 3. Surface real enrichment failures clearly
**Files:**
- `src/pages/admin/remarketing/MatchToolLeads/useMatchToolLeadsData.ts`
- optionally `MatchToolLeadPanel.tsx`

- Add `onError` toast handling for the `enrichLead` mutation
- If the edge function returns an error, show the actual reason instead of silently failing
- This helps distinguish:
  - stale UI bug
  - scraping failure
  - AI response failure
  - rate limit / credit issues

### 4. Improve the empty state so it’s actionable
**File:** `src/pages/admin/remarketing/MatchToolLeads/MatchToolLeadPanel.tsx`

Replace the generic “No enrichment data available” with clearer states:
- **Loading:** “Generating company intel…”
- **Failed:** “Couldn’t generate intel for this website yet”
- **Empty after retry:** show a small retry button or muted hint

This makes the panel feel intentional instead of broken.

## Expected result
After this change:
- if enrichment already exists in the database, the panel will show it immediately
- if enrichment is generated while the panel is open, the panel will update automatically
- if enrichment truly fails, the user will see a real error instead of a misleading empty state

## Files to change
- `src/pages/admin/remarketing/MatchToolLeads/index.tsx`
- `src/pages/admin/remarketing/MatchToolLeads/MatchToolLeadPanel.tsx`
- `src/pages/admin/remarketing/MatchToolLeads/useMatchToolLeadsData.ts`
