

## Relabel Buyer Match Actions to Reflect the Outreach Workflow

### Problem
The current action buttons say "Approve Fit" and "Not a Fit", but at this stage the buyers have already been scored and deemed a fit by the system. The real workflow step is reaching out to buyers to confirm whether they are **interested in meeting with the owner** or whether they **pass**.

### Changes

**1. BulkActionsToolbar.tsx** -- Update button labels and toast messages:
- "Approve Fit" becomes **"Interested"** (green button, same behavior -- marks as approved)
- "Not a Fit" becomes **"Not Interested"** (amber button, same behavior -- marks as passed)
- "Pass" dropdown label stays but the header text changes to "Select reason buyer declined:"
- Toast messages updated: "Approved X buyers as fit" becomes "Marked X buyers as interested"

**2. BuyerMatchCard.tsx** -- Update the status badge on individual cards:
- The green "Approved" badge becomes **"Interested"** 
- This is the badge shown on each card after a buyer is marked

**3. ReMarketingDealMatching.tsx** -- Update tab labels:
- "Approved (X)" becomes **"Interested (X)"**
- "Passed (X)" becomes **"Not Interested (X)"**
- "In Outreach (X)" stays as-is (still relevant)
- Bulk approve success toast updated to match

**4. Pass reasons updated** to reflect buyer-side language:
- "No presence in target geography" stays
- "Deal size outside buyer criteria" stays
- "Services not aligned" stays
- "Buyer not actively acquiring" stays
- "Already in discussions" stays
(These still make sense as reasons a buyer would decline)

### Technical Details

All changes are label/copy only -- no logic, data model, or status value changes. The underlying `status: 'approved'` and `status: 'passed'` values in the database remain the same; only the user-facing text changes.

**Files to modify:**
- `src/components/remarketing/BulkActionsToolbar.tsx` -- Button labels + toasts
- `src/components/remarketing/BuyerMatchCard.tsx` -- "Approved" badge text
- `src/pages/admin/remarketing/ReMarketingDealMatching.tsx` -- Tab labels + bulk action toast
