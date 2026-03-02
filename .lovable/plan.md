

## My Deals -- Complete Overhaul with Data Room, Document Signing & Premium Design

### What's Wrong Now

1. **Document signing (NDA/Fee Agreement) is barely visible** -- The slim top banner is easy to miss. Buyers don't understand they must sign before approval. The action card mentions signing but it's just one small component buried in the overview.

2. **No Data Room section** -- Buyers have no visibility into deal documents (memos, CIMs) from the My Deals page. The `DealDocumentPreview` and `BuyerDataRoom` components exist but aren't integrated into the detail panel.

3. **Design is still unpolished** -- Mixed color systems (slate vs. the quiet luxury palette), inconsistent border radii, cards-within-cards nesting, and the overall composition doesn't match the reference screenshot's clean grid layout.

4. **Information isn't structured for a dealmaker** -- The overview tab is a vertical stack of components with no visual grid or dashboard feel. A dealmaker needs to see key metrics, document status, next action, and deal progress at a glance -- like the reference CRM screenshot with its card grid layout.

### Design Direction

Inspired by the reference screenshot: a **dashboard-style detail panel** with a structured grid of information cards, not a linear scroll. Think of the detail panel as a deal command center with distinct zones.

### New Detail Panel Architecture

```text
+------------------------------------------------------------------+
| HEADER: Title + Status Pill + EBITDA + View Listing              |
+------------------------------------------------------------------+
|                                                                    |
| +----- NEXT ACTION (full-width) --------------------------------+|
| | Sign your NDA to proceed                          [Sign Now ->]||
| +----------------------------------------------------------------+|
|                                                                    |
| +--- DOCUMENTS ----+  +--- DEAL DETAILS -------------------------+|
| | NDA       Signed  |  | Category    Manufacturing               ||
| | Fee Agmt  Pending  |  | Location    Northeast US                ||
| | [Sign Now ->]     |  | Revenue     $12.5M                      ||
| | ----------        |  | EBITDA      $2.1M                       ||
| | Data Room         |  | Margin      16.8%                       ||
| | 3 docs available  |  | Submitted   3 days ago                  ||
| | [View Documents]  |  +----------------------------------------+||
| +-------------------+                                              |
|                                                                    |
| +--- DEAL PROGRESS (full-width) --------------------------------+|
| | [====Interested====][===Documents===][====Review====][Connected]||
| | "Your interest is being presented to qualified buyers..."       ||
| +----------------------------------------------------------------+|
|                                                                    |
| +--- YOUR MESSAGE -------+  +--- PROFILE STATUS ----------------+|
| | "We are interested..." |  | Profile 85% complete              ||
| | [Edit]                 |  | [Complete Profile ->]              ||
| +------------------------+  +-----------------------------------+|
|                                                                    |
| Tabs: Messages | Activity                                         |
+------------------------------------------------------------------+
```

### Detailed Changes

#### 1. Page Layout (`MyRequests.tsx`) -- Complete DetailPanel rewrite

The DetailPanel will be restructured from a linear stack to a **grid-based dashboard**:

- **Row 1**: Full-width Action Card (the single most important thing)
- **Row 2**: Two-column grid -- "Documents & Agreements" card (left) + "Deal Details" card (right)
- **Row 3**: Full-width Deal Progress bar
- **Row 4**: Two-column grid -- "Your Message" (left) + "Profile Status" (right)
- **Row 5**: Messages/Activity tabs (kept as-is but polished)

The AccountDocumentsBanner at the top will be **removed** -- document signing will now live inside the detail panel's Documents card, making it contextual to the selected deal.

All colors will be brought into the quiet luxury palette consistently (no more `slate-*`, use `#0E101A` opacity variants and `#F0EDE6` borders).

#### 2. New: Documents & Agreements Card (replaces banner)

A prominent left-column card that shows:
- **NDA status**: Signed (green check) or Pending with [Sign Now] button
- **Fee Agreement status**: Signed, Pending with [Sign Now], or "Not yet sent"
- **Divider**
- **Data Room preview**: Document count, access level, and [View Documents] link
- If no access yet: "Documents become available after approval"
- If approved with access: Shows document count with a link to view them

This card integrates `AgreementSigningModal` for signing and queries `data_room_access` / `data_room_documents` for document counts.

#### 3. New: Deal Details Card

A right-column card with clean key-value rows:
- Category
- Location
- Revenue (formatted)
- EBITDA (formatted)
- EBITDA Margin (calculated)
- Acquisition Type (if available)
- Submitted date

Styled as a minimal list with alternating subtle backgrounds or hairline separators.

#### 4. Redesigned Action Card (`DealActionCard.tsx`)

The action card gets elevated visually:
- Full-width, more prominent padding
- Clearer hierarchy: large title, description below, CTA button far right
- When NDA/Fee needs signing: warm gold background with prominent button
- When under review: subtle neutral with timeline estimate
- When approved: celebration state with green accent
- When rejected: muted with redirect to similar deals

#### 5. Polished DealStatusSection (`DealStatusSection.tsx`)

- Add a subtitle below the progress bar explaining the current stage
- Add timeline estimate: "Typically 3-7 business days" for review stage
- Show how long the deal has been in current stage

#### 6. Sidebar Polish (`DealPipelineCard.tsx`)

- Add a small indicator if documents need signing (amber dot alongside unread gold dot)
- Show "Action needed" text when NDA/Fee unsigned instead of generic "Pending"

#### 7. Design System Alignment (all files)

Replace all `slate-*` colors with the quiet luxury palette:
- `text-slate-500` -> `text-[#0E101A]/40`
- `text-slate-700` -> `text-[#0E101A]/70`
- `text-slate-900` -> `text-[#0E101A]`
- `border-slate-200` -> `border-[#F0EDE6]`
- `bg-slate-50` -> `bg-[#F8F6F1]`
- `text-blue-600` -> `text-[#0E101A]` (no blues)
- Remove all `[#0f1f3d]` navy references

#### 8. Messages & Activity Tab Polish

- Update `DealMessagesTab.tsx`: Replace navy message bubbles with `#0E101A`, gold sender labels with `#DEC76B`
- Update `DealActivityLog.tsx`: Replace navy dots with `#0E101A`, align with quiet luxury palette
- Remove redundant inner headers (the tab trigger already labels them)

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/deals/DealDocumentsCard.tsx` | New Documents & Agreements card with signing + data room preview |
| `src/components/deals/DealInfoCard.tsx` | New Deal Details key-value card |

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/MyRequests.tsx` | Remove AccountDocumentsBanner, restructure DetailPanel to grid layout, integrate new cards |
| `src/components/deals/DealActionCard.tsx` | Elevate visual treatment, horizontal layout with CTA right-aligned |
| `src/components/deals/DealStatusSection.tsx` | Add stage explanation text and timeline estimate |
| `src/components/deals/DealPipelineCard.tsx` | Add "Action needed" indicator for unsigned docs |
| `src/components/deals/DealDetailHeader.tsx` | Minor palette alignment |
| `src/components/deals/DealMessagesTab.tsx` | Replace slate/navy with quiet luxury palette |
| `src/components/deals/DealActivityLog.tsx` | Replace slate/navy with quiet luxury palette |
| `src/components/deals/DealMessageEditor.tsx` | Palette alignment |
| `src/components/deals/BuyerProfileStatus.tsx` | Palette alignment, compact layout |
| `src/components/deals/PostRejectionPanel.tsx` | Palette alignment |

### Technical Notes

- The new `DealDocumentsCard` will query `data_room_access` and `data_room_documents` (reusing logic from existing `DealDocumentPreview.tsx`)
- `AgreementSigningModal` integration stays the same -- triggered by buttons in the new card
- All existing hooks (`useMyAgreementStatus`, `useBuyerNdaStatus`, `useAgreementStatusSync`) remain unchanged
- The `BuyerDataRoom` component (full data room view) can be linked to from the Documents card as a route or modal
- No new dependencies needed

