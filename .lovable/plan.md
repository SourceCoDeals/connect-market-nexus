
# Fix: Wire Analytics Intelligence Center to Admin Dashboard

## Problem Identified

The Phase 2 implementation created all the new components and hooks correctly:
- 4 new dashboards (Buyer Intent, Campaign Attribution, Listing Health, Exit Analysis)
- 4 new hooks for data fetching
- Updated `AnalyticsTabContainer.tsx` with 13 intelligence tabs

**BUT** the `/admin` page at `AdminDashboard.tsx` still renders the OLD `PremiumAnalyticsDashboard` in its Analytics tab instead of the new `AnalyticsTabContainer`.

The `EnhancedAdminDashboard` component that properly uses `AnalyticsTabContainer` exists but is **NOT USED ANYWHERE**.

---

## Solution

Replace the `PremiumAnalyticsDashboard` in `AdminDashboard.tsx` with `AnalyticsTabContainer` (or the wrapper `EnhancedAdminDashboard`).

### File to Modify

**`src/pages/admin/AdminDashboard.tsx`**

Change line 9 from:
```tsx
import { PremiumAnalyticsDashboard } from "@/components/admin/analytics/PremiumAnalyticsDashboard";
```

To:
```tsx
import { AnalyticsTabContainer } from "@/components/admin/analytics/AnalyticsTabContainer";
```

And change line 215-217 from:
```tsx
<TabsContent value="analytics" className="mt-0">
  <PremiumAnalyticsDashboard />
</TabsContent>
```

To:
```tsx
<TabsContent value="analytics" className="mt-0">
  <AnalyticsTabContainer />
</TabsContent>
```

---

## What Users Will See After Fix

When clicking the **"Analytics"** tab on `/admin`, users will now see:

| Tab | Content |
|-----|---------|
| **Overview** | Premium Analytics Dashboard (existing) |
| **Real-Time** | Active users counter, live activity map |
| **Buyer Intent** | Intent funnel, capital readiness, mandate keywords |
| **Traffic** | Traffic dashboard + Campaign Attribution + Exit Analysis |
| **Engagement** | Engagement dashboard + Listing Health |
| **Search** | Search intelligence + quality score |
| **Geography** | World map with session locations |
| **Historical** | Daily metrics trends (30/60/90 days) |
| **Predictive** | Conversion probability, churn risk (existing hidden tab) |
| **Market** | Market demand, pricing insights (existing hidden tab) |
| **Revenue** | Deal velocity, revenue attribution (existing hidden tab) |
| **Listing Health** | Stale listings, health scores |
| **Live Feed** | Real-time activity stream |

---

## Implementation Steps

1. Update import in `AdminDashboard.tsx` to use `AnalyticsTabContainer`
2. Replace `PremiumAnalyticsDashboard` with `AnalyticsTabContainer` in the Analytics tab content
3. Verify the Intelligence Center appears with all 13 tabs

---

## Technical Details

The `AnalyticsTabContainer` already:
- Has its own time range selector (7/30/90 days + custom)
- Uses a scrollable tab bar for the 13 tabs
- Integrates all the new dashboards we created
- Wires up the 3 previously hidden intelligence tabs (Predictive, Market, Revenue)

No additional component changes needed - just the wiring fix.
