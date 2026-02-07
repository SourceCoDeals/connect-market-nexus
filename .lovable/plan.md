

# Fix Back Navigation from Deal & Buyer Detail Pages

## Problem
When navigating from a **Buyer Universe** to a deal or buyer detail page, clicking "Back" always takes you to "All Deals" or "All Buyers" instead of returning to the universe you came from.

## Root Cause
- The **Deal Detail** page uses `navigate(-1)` which can be unreliable
- The **Buyer Detail** page has a hardcoded back link: `<Link to="/admin/remarketing/buyers">` — it always goes to the "All Buyers" list regardless of where you came from
- Neither the Universe Deals table nor the Universe Buyers table pass any "origin" information when navigating to detail pages

## Solution
Pass a `from` URL via React Router's **location state** when navigating from the universe, then use it in the back buttons on detail pages. If no state is present (e.g., direct link), fall back to the current default behavior.

## Changes

### 1. UniverseDealsTable.tsx
Pass the current universe URL as state when navigating to a deal:
```tsx
navigate(`/admin/remarketing/deals/${deal.listing.id}`, {
  state: { from: `/admin/remarketing/universes/${universeId}` }
})
```

### 2. BuyerTableEnhanced.tsx
Pass the current universe URL as state when navigating to a buyer from the universe:
```tsx
navigate(`/admin/remarketing/buyers/${buyer.id}`, {
  state: { from: `/admin/remarketing/universes/${universeId}` }
})
```
This component needs access to a `universeId` prop (only passed when used inside a universe context).

### 3. ReMarketingDealDetail.tsx
Update the back button to use `location.state?.from` if available, otherwise fall back to `navigate(-1)`:
```tsx
const location = useLocation();
const backTo = location.state?.from || null;

// Back button:
backTo
  ? <Link to={backTo}><ArrowLeft /> Back</Link>
  : <Button onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>
```

### 4. ReMarketingBuyerDetail.tsx
Replace the hardcoded `<Link to="/admin/remarketing/buyers">` with state-aware navigation:
```tsx
const location = useLocation();
const backTo = location.state?.from || "/admin/remarketing/buyers";

<Link to={backTo}><ArrowLeft /></Link>
```

### 5. BuyerDetailHeader.tsx
Same change — replace hardcoded `/admin/remarketing/buyers` back link with a `backTo` prop passed from the parent.

## Summary of Files to Edit
- `src/components/remarketing/UniverseDealsTable.tsx` — pass `state.from`
- `src/components/remarketing/BuyerTableEnhanced.tsx` — pass `state.from` when `universeId` is provided
- `src/pages/admin/remarketing/ReMarketingDealDetail.tsx` — read `state.from` for back button
- `src/pages/admin/remarketing/ReMarketingBuyerDetail.tsx` — read `state.from` for back button
- `src/components/remarketing/buyer-detail/BuyerDetailHeader.tsx` — accept `backTo` prop

