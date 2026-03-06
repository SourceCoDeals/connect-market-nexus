

## Problem: Valuation Lead Click Fails Silently

### Root Cause

The `handleRowClick` function in `useValuationLeadsMutations.ts` (lines 45-94) is an `async` callback with **no try/catch block**. When any Supabase operation fails (RLS policy rejection, network error, etc.), the error is either thrown as an unhandled promise rejection (line 60) or silently swallowed.

Specifically:
- Line 55-59: Queries `listings` by `deal_identifier` — if this errors, `throw existingError` becomes an unhandled rejection
- Line 71-75: Inserts a new listing — only this path has a toast on failure, but doesn't catch errors from the preceding query
- No loading state is shown during the async operations, so the user gets no feedback

Additionally, the `ValuationLeadDetailDrawer` component exists but is **never imported or rendered** — it could serve as a useful intermediate step before navigating to the full deal page.

### Plan

1. **Wrap `handleRowClick` in try/catch** — Add a global try/catch around the entire function body so all errors (RLS, network, insert failures) display a toast instead of silently failing. Add a loading indicator.

2. **Wire up the `ValuationLeadDetailDrawer`** — Instead of immediately creating a listing and navigating away, open the detail drawer on row click. The drawer already has a "View Deal" button (for pushed leads) and a "Push to All Deals" button (for unpushed leads), giving users a preview before committing.

3. **Keep direct navigation as secondary action** — Move the "create listing + navigate" logic to the drawer's action buttons and to the dropdown menu's "Open Deal" item, so clicking a row is non-destructive (just opens the drawer).

### Technical Changes

**`src/pages/admin/remarketing/ValuationLeads/useValuationLeadsMutations.ts`**
- Wrap `handleRowClick` body in try/catch with `sonnerToast.error()`
- Rename current `handleRowClick` to `handleOpenDeal` (the create-and-navigate logic)
- New `handleRowClick` sets a `selectedLead` state to open the drawer

**`src/pages/admin/remarketing/ValuationLeads/index.tsx`**
- Import and render `ValuationLeadDetailDrawer`
- Pass `selectedLead` / `setSelectedLead` state
- Connect drawer's `onViewDeal` to the navigate-to-deal logic
- Connect drawer's `onPushToDeals` to existing `handlePushToAllDeals`

**`src/pages/admin/remarketing/ValuationLeads/useValuationLeadsMutations.ts`** (error handling)
- Add try/catch to `handleOpenDeal` (the renamed create-listing-and-navigate function)
- Return `handleOpenDeal` and `selectedLead`/`setSelectedLead` from the hook

