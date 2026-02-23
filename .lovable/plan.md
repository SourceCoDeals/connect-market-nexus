

## Restructure Remarketing Workflow: Approved -> Interested -> Pipeline

### The Problem
Currently the workflow conflates "approving a buyer as a fit" with "confirming they are interested." The user wants a clear 3-stage funnel:

1. **All Buyers** - scored buyers, pending review
2. **Approved** - admin approves the buyer as a good fit (what was previously called "Interested")
3. **Interested** - buyer confirms interest (typically after receiving the lead memo) -- this is a NEW stage
4. When a buyer is marked "Interested," they automatically convert to a pipeline deal

### Changes

**1. Add a new `interested` status to the remarketing_scores workflow**

Currently `remarketing_scores.status` uses: `pending`, `approved`, `passed`. We need to add `interested` as a status value (no schema change needed since the column is text).

**2. Rename tabs and actions back to proper labels**

| Current Label | New Label | DB Status |
|---|---|---|
| "Interested" (bulk + toggle) | **Approved** | `approved` |
| NEW action on Approved tab | **Interested** | `interested` |
| "Not Interested" | **Not Interested** | `passed` |

Tabs become:
- All Buyers
- Approved (count)
- Interested (count) -- NEW tab
- Not Interested (count)
- In Outreach (count)

**3. Auto-convert to pipeline on "Interested" action**

When a buyer is marked as "Interested" (the new stage), the system will automatically call the existing `convert-to-pipeline-deal` edge function, creating a deal card in the pipeline. This reuses the existing `handleMoveToPipeline` logic.

**4. UI flow for the new "Interested" action**

On cards in the "Approved" tab, add an "Interested" button (or keep the toggle). When clicked:
- Update `remarketing_scores.status` to `interested`
- Set `interested = true` and `interested_at = now()`
- Call `convert-to-pipeline-deal` to create the pipeline deal
- Show a toast with a "View in Pipeline" action link

### Technical Details

**File: `src/pages/admin/remarketing/ReMarketingDealMatching.tsx`**

- Update `FilterTab` type: add `'interested'` value
- Add stats counter for `interested` status
- Add tab filter for `interested` status
- Rename bulk approve back to "Approved" terminology
- Rename `handleToggleInterested` to `handleToggleApproved` (toggles `approved` status)
- Add new `handleMarkInterested` function that:
  1. Updates score status to `interested` + sets `interested`/`interested_at`
  2. Calls `handleMoveToPipeline` to auto-create the pipeline deal
- Add new bulk "Mark Interested" handler for bulk operations on approved buyers

**File: `src/components/remarketing/BulkActionsToolbar.tsx`**

- Rename "Interested" button back to **"Approve Fit"**
- The "Not Interested" button stays
- Add context-aware behavior: when viewing the Approved tab, show an **"Interested"** button instead of "Approve Fit"
- OR: Add a new prop to control which actions are shown based on the active tab

**File: `src/components/remarketing/BuyerMatchCard.tsx`**

- Rename the "Interested" badge back to **"Approved"** for `status === 'approved'`
- Add a new **"Interested"** badge for `status === 'interested'` (different color, e.g., blue)
- On approved cards, show a prominent "Mark Interested" button that triggers pipeline conversion
- On interested cards, show a "View in Pipeline" link

**File: `supabase/functions/convert-to-pipeline-deal/index.ts`**

- No changes needed -- it already handles everything including setting `interested = true` and `interested_at` on the score

### Workflow Summary

```text
All Buyers --> [Approve Fit] --> Approved tab
Approved   --> [Interested]  --> Interested tab + auto-creates pipeline deal
Any stage  --> [Not Interested / Pass] --> Not Interested tab
```
