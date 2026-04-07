
# Add AI Executive Summary Generation

## What's needed
The `ExecutiveSummaryCard` component already has an `onGenerate` prop that triggers AI generation, but no caller passes it. We need a new edge function and to wire it up in both places the card is used.

## Plan

### 1. Create edge function `generate-executive-summary`
**File**: `supabase/functions/generate-executive-summary/index.ts`

- Accepts `{ deal_id }` via POST
- Fetches the deal record from `listings` (title, industry, revenue, EBITDA, location, services, owner_goals, description, general_notes, key_risks, growth_trajectory, customer_types, etc.)
- Also fetches any lead memo content and recent deal notes for richer context
- Calls Claude (using existing `_shared/ai-providers.ts`) with a prompt to produce a 3-5 sentence executive summary
- Returns `{ summary: string }` without saving (the caller saves via the existing `onSave` flow after user reviews)
- Uses `requireAdmin` for auth

### 2. Wire `onGenerate` in ReMarketing deal detail
**File**: `src/pages/admin/remarketing/ReMarketingDealDetail/OverviewTab.tsx` (line ~277-282)

Pass `onGenerate` to `ExecutiveSummaryCard` that calls the new edge function with the deal ID and returns the generated summary string.

### 3. Wire `onGenerate` in Pipeline deal detail
**File**: `src/components/admin/pipeline/tabs/PipelineDetailDealInfo.tsx` (line ~173-178)

Same pattern - pass `onGenerate` that invokes the edge function.

### 4. Deploy the edge function

## Technical details
- Reuses existing `_shared/ai-providers.ts` (Anthropic/Claude), `_shared/auth.ts`, `_shared/cors.ts`
- The summary is returned to the UI where the admin can review/edit before saving - matching the existing UX flow ("Generate from Deal Data" button fills the textarea)
- No database schema changes needed

| File | Change |
|------|--------|
| `supabase/functions/generate-executive-summary/index.ts` | New edge function |
| `src/pages/admin/remarketing/ReMarketingDealDetail/OverviewTab.tsx` | Pass `onGenerate` prop |
| `src/components/admin/pipeline/tabs/PipelineDetailDealInfo.tsx` | Pass `onGenerate` prop |
