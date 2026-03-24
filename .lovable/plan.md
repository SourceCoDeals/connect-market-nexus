

# Buyer/Seller Match Tool Leads — Integration Strategy

## The Problem

You have a **separate Lovable project** (the Buyer/Seller Match Tool) that captures business owner leads at varying levels of completeness:
- **Minimum**: website only (anonymous browse)
- **Mid**: website + financials (engaged but didn't submit)
- **Full**: website + financials + contact form (full lead)

You need these leads flowing into **this project** under a new Remarketing tab: **"Match Tool Leads"** (at `/admin/remarketing/leads/match-tool`), sitting alongside Valuation Leads.

---

## Recommended Architecture

### How to Connect the Two Projects

**Option A — Shared Supabase (Simplest)**
Both Lovable projects point to the **same Supabase project** (`vhzipqarkmmfuqadefep`). The match tool writes directly to a `match_tool_leads` table here. Zero middleware needed.

**To do this**: In the match tool project, set its Supabase env vars to this project's URL and anon key. Then it inserts directly into the shared table.

**Option B — Webhook (If Match Tool Has Its Own Supabase)**
Create an edge function `ingest-match-tool-lead` on this project that accepts a POST from the match tool. The match tool calls this webhook on every submission. More decoupled but adds a network hop.

**Recommendation**: Option A if the match tool doesn't already have its own Supabase with meaningful data. Option B if it does.

---

## Implementation Plan

### 1. Create `match_tool_leads` Table

New table to store all submissions with progressive enrichment:

```text
match_tool_leads
├── id (uuid, PK)
├── website (text, required)
├── business_name (text, nullable)
├── full_name / email / phone (nullable — only if form submitted)
├── revenue / ebitda / employee_count (nullable — only if financials provided)
├── industry / location (nullable)
├── submission_stage ('browse' | 'financials' | 'full_form')
├── raw_inputs (jsonb — full payload)
├── status (text, default 'new')
├── excluded / not_a_fit flags
├── pushed_to_all_deals (bool)
├── pushed_listing_id (uuid FK → listings)
├── deal_owner_id (uuid FK → profiles)
├── created_at / updated_at
```

### 2. Create Ingestion Edge Function

`ingest-match-tool-lead` — open endpoint (no JWT) that:
- Accepts the match tool payload
- Upserts into `match_tool_leads` (dedup by website + email)
- Uses Gemini to infer industry/business name from website if not provided
- Returns 200 as long as raw data is saved (bulletproof, same pattern as valuation leads)

### 3. Wire the Match Tool to Push Here

In the **match tool project**, add a fetch call on each submission stage:
```typescript
await fetch('https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/ingest-match-tool-lead', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ website, financials, contact, raw_inputs })
});
```

### 4. Build the "Match Tool Leads" Tab

New page at `src/pages/admin/remarketing/MatchToolLeads/` following the exact ValuationLeads pattern:
- `index.tsx` — main view with tabs (All / Has Contact / Website Only / Pushed / Archived)
- `types.ts` — MatchToolLead interface
- `useMatchToolLeadsData.ts` — query/mutation hooks
- `MatchToolLeadsTable.tsx` — table component
- `MatchToolLeadDetailDrawer.tsx` — detail view

### 5. Add Route & Navigation

- Route: `/admin/remarketing/leads/match-tool`
- Sidebar entry under Remarketing > Leads, below "Valuation Leads"
- Add to universal search, deal import sources, and the `deal_source` constraint

### 6. Update `deals_source_check` Constraint

Add `'match_tool'` to the permitted deal source values so leads can be pushed to Active Deals.

---

## What You Need To Do First

1. **Tell me which option** — does the match tool project already have its own Supabase, or can we point it at this one?
2. **Share the match tool's submission payload** — what fields does it currently capture at each stage? (Or give me access to the project so I can look at the code.)

Once I know this, I can build the full pipeline end-to-end.

