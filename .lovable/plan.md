

# Restructure Pipeline Detail Panel Tabs

## Summary
Replace the current 5-tab layout (Overview, Messages, Data Room, Tasks, Activity) with a new 5-tab layout that better matches the deal workflow.

## New Tab Structure

```text
| Overview | Deal Overview | Messages | Data Room | Other Buyers |
```

### Tab 1: Overview (request status + notes)
Keep the existing PipelineDetailOverview component but **remove** the "Related Buyers" section and the "Chat Preview" section (since Messages has its own tab). This tab retains:
- Interest Expression (the original buyer request message + admin notes)
- Deal Owner selector
- Contact info sidebar (LinkedIn, email, phone, company, website, buyer type)
- Follow-up toggles
- Deal metadata (stage duration, deal age, score)
- Internal notes/comments system

### Tab 2: Deal Overview (the listing/company detail page)
Create a new `PipelineDetailDealInfo.tsx` component that embeds the core deal information from the ReMarketingDealDetail page, adapted for the panel context. This includes:
- Company Overview card (name, website, location, employees, industry, etc.)
- Financial Overview card (Revenue, EBITDA, EBITDA margin with confidence indicators)
- Executive Summary card
- Services/Business Model card
- Geographic Coverage card
- Owner Goals card
- Customer Types card
- Key Quotes card
- Transcripts section

All of these already exist as standalone components (`CompanyOverviewCard`, `ExecutiveSummaryCard`, etc.) imported from `@/components/remarketing/deal-detail`. The new tab component will fetch the listing data using the deal's `listing_id` and render these existing cards in a scrollable layout.

### Tab 3: Messages (unchanged)
Keep `PipelineDetailMessages` as-is -- the direct message thread with the buyer.

### Tab 4: Data Room (unchanged)
Keep `PipelineDetailDataRoom` as-is -- NDA/Fee Agreement access control, distribution tracker, and document activity.

### Tab 5: Other Buyers
Create a new `PipelineDetailOtherBuyers.tsx` component. Move and expand the "Related Buyers" logic currently in PipelineDetailOverview into its own dedicated tab. This will show all other deals for the same listing with richer detail:
- Buyer name, company, type
- Current pipeline stage
- NDA and Fee Agreement status
- Deal owner
- Last activity timestamp

## Technical Details

### Files to Create
1. **`src/components/admin/pipeline/tabs/PipelineDetailDealInfo.tsx`**
   - Accepts `deal: Deal` prop
   - Fetches full listing data from `listings` table using `deal.listing_id`
   - Renders the existing remarketing deal-detail cards (CompanyOverviewCard, ExecutiveSummaryCard, etc.)
   - Read-only view adapted for the 900px panel width (single column layout instead of the full-page grid)

2. **`src/components/admin/pipeline/tabs/PipelineDetailOtherBuyers.tsx`**
   - Accepts `deal: Deal` prop
   - Queries `deals` table for all deals with the same `listing_id` (excluding current deal)
   - Joins with `deal_stages` for stage names
   - Shows each buyer in a card with: name, company, buyer type, stage, NDA/Fee status, owner, last activity
   - Empty state when no other buyers exist

### Files to Modify
1. **`src/components/admin/pipeline/PipelineDetailPanel.tsx`**
   - Replace the 5-tab TabsList from `grid-cols-5` with the new tab order
   - Import and wire up the two new components
   - Remove Tasks and Activity tab content
   - Rename tab triggers: "Overview", "Deal Overview", "Messages", "Data Room", "Other Buyers"

2. **`src/components/admin/pipeline/tabs/PipelineDetailOverview.tsx`**
   - Remove the "Related Buyers" section (moved to its own tab)
   - Remove the "Chat Preview" section (redundant with Messages tab)
   - Keep everything else: interest expression, notes, sidebar with owner/contact/followup/metadata

