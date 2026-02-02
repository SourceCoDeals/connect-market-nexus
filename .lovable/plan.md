
# Intelligence Center Fix Plan

## Issues Identified

### Issue 1: Referrer is Truncated in User Detail Panel
**Location:** `UserDetailPanel.tsx` lines 219-224
**Root Cause:** Referrer is truncated with `max-w-[120px]` class and only shows hostname
```tsx
<span className="text-xs truncate max-w-[120px]">
  {new URL(data.source.referrer).hostname}
</span>
```
**Fix:** Show full referrer with proper wrapping, add tooltip for long URLs

### Issue 2: User Detail Panel Position Should Be Bottom (Not Side)
**Location:** `UserDetailPanel.tsx` line 133-134
**Root Cause:** Using Sheet with default `side="right"` behavior
```tsx
<SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
```
**Fix:** Change to `side="bottom"` and increase height to cover ~80% of viewport like Datafa.st

### Issue 3: User Detail Panel Needs More Comprehensive Data
**Current State:** Missing several key elements from Datafa.st example:
- Resolution/screen size
- Full referrer with favicon
- "Found site via" acquisition entry
- Date grouping in timeline (e.g., "Saturday, Jan 31st 2026")
- Expandable event parameters
- Better visual hierarchy

**Fix:** Enhance the panel layout to match Datafa.st example with two-column design

### Issue 4: Goals Tab Shows No Data (Empty)
**Location:** `ConversionCard.tsx` GoalsTab function
**Root Cause:** GoalsTab iterates over `funnel.stages` which has correct data, but the issue is the funnel stages in `useUnifiedAnalytics.ts` lines 450-451 use placeholders:
```typescript
const ndaSignedCount = Math.floor(connectingUsers.size * 0.7); // ~70% of connections
const feeAgreementCount = Math.floor(connectingUsers.size * 0.85); // ~85% of connections
```
**Fix:** Query actual NDA/Fee Agreement counts from `connection_requests` table

### Issue 5: Only 2 Users Show in Funnel Despite Having 20+ Users with Connections
**Location:** `useUnifiedAnalytics.ts` lines 485-502
**Root Cause:** The topUsers filter only includes users who have BOTH profile AND (sessions OR connections) in the current period. Since sessions are filtered by date range but connections are also date-filtered, users who connected earlier don't appear.

Also, the hook filters profiles that exist in `userConnectionCounts` OR `userSessionCounts` - but these maps are built from current period data only.

**Database Evidence:**
- 21 unique users made connections in last 30 days
- There are users like "Dominic Lupo" with 17 connections and 43 sessions

**Fix:** Query connection counts separately without date filter for user display, or include all users who have ever connected

### Issue 6: Globe/Bulb Icons Should Be at Bottom Center (Not Right Side)
**Location:** `FloatingGlobeToggle.tsx` line 12
**Current:** `fixed bottom-6 right-6 flex flex-col gap-3`
**Fix:** Change to `fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-row gap-3`

### Issue 7: Daily Chart Shows No Data
**Location:** `DailyVisitorsChart.tsx` & `useUnifiedAnalytics.ts`
**Root Cause:** `daily_metrics` table is empty (query returned `[]`)
**Fix:** Fall back to computing daily metrics from raw `user_sessions` when `daily_metrics` is empty

---

## Implementation Plan

### Part 1: Fix User Detail Panel - Bottom Position & Comprehensive Layout

**File: `src/components/admin/analytics/datafast/UserDetailPanel.tsx`**

Changes:
1. Change Sheet to open from bottom with `side="bottom"`
2. Increase height to `h-[85vh]`
3. Add two-column layout like Datafa.st:
   - Left: Avatar, name, email, location (flag), device/resolution, OS, browser, parameters table
   - Right: Stats grid, "Time to convert" badge, Activity heatmap, Event timeline with date headers
4. Show full referrer with favicon
5. Add "Found site via [referrer]" as first timeline event
6. Group events by date with date headers
7. Add expandable parameters to events

### Part 2: Fix Data Queries in useUnifiedAnalytics

**File: `src/hooks/useUnifiedAnalytics.ts`**

Changes:
1. Query actual NDA/Fee Agreement counts:
```typescript
// Add to parallel queries
supabase
  .from('connection_requests')
  .select('id, lead_nda_signed, lead_fee_agreement_signed')
  .gte('created_at', startDateStr)
```

2. Compute daily metrics from raw sessions when `daily_metrics` is empty:
```typescript
if (dailyMetrics.length === 0) {
  // Aggregate from sessions by date
  const dailyMap = new Map<string, { visitors: number; connections: number }>();
  uniqueSessions.forEach(s => {
    const date = format(new Date(s.started_at), 'yyyy-MM-dd');
    // ... aggregate
  });
}
```

3. Fix topUsers to include ALL users with connections (not just current period):
```typescript
// Query all connection counts, not just current period
const allConnectionsResult = await supabase
  .from('connection_requests')
  .select('user_id')
  .not('user_id', 'is', null);
```

### Part 3: Fix Globe/Bulb Button Position

**File: `src/components/admin/analytics/datafast/FloatingGlobeToggle.tsx`**

Change positioning from right side to bottom center:
```tsx
<div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-row gap-3 z-40">
```

### Part 4: Enhance Funnel Tooltips with Real Breakdown Data

**File: `src/components/admin/analytics/datafast/ConversionCard.tsx`**

Currently using static placeholder data in tooltips:
```tsx
topSources={[
  { name: 'Direct', percentage: 45 },
  { name: 'Google', percentage: 28 },
  { name: 'LinkedIn', percentage: 15 },
]}
```

Fix: Pass real computed source/country breakdown to each funnel stage

---

## Technical Details

### UserDetailPanel Bottom Sheet Layout

```
+------------------------------------------------------------------+
|  [Drag Handle]                                              [X]   |
+------------------------------------------------------------------+
|                                                                    |
|   [Avatar]  Name                    |  PAGEVIEWS    SESSIONS      |
|             Company                 |    8             9          |
|             email@company.com       |                             |
|                                     |  TIME ON SITE  CONNECTIONS  |
|   LOCATION                          |    0s            2          |
|   [Flag] Country, City              |                             |
|                                     |  [Time to convert: 171 days]|
|   TECHNOLOGY                        |                             |
|   [Icon] Desktop (1728x1000)        |  ACTIVITY (LAST 6 MONTHS)   |
|   [Icon] Mac OS                     |  [Calendar Heatmap]         |
|   [Icon] Safari                     |                             |
|                                     |  EVENT TIMELINE (10 EVENTS) |
|   ACQUISITION                       |  [Saturday, Jan 31st 2026]  |
|   Channel        [Referral]         |  [Q] Found codefa.st via... |
|   Referrer       www.sourcecodeal...|  [Eye] Viewed page /        |
|   (show full on hover)              |  [Eye] Viewed page /market..|
|                                     |  [Link] Sent connection...  |
|   First seen     Aug 11, 2025       |                             |
|   Last seen      4 days ago         |                             |
|                                     |                             |
+------------------------------------------------------------------+
```

### Daily Metrics Fallback Computation

When `daily_metrics` table is empty, compute from raw data:
```typescript
const dailySessionCounts = new Map<string, number>();
const dailyConnectionCounts = new Map<string, number>();

uniqueSessions.forEach(s => {
  const date = format(new Date(s.started_at), 'yyyy-MM-dd');
  dailySessionCounts.set(date, (dailySessionCounts.get(date) || 0) + 1);
});

connections.forEach(c => {
  const date = format(new Date(c.created_at), 'yyyy-MM-dd');
  dailyConnectionCounts.set(date, (dailyConnectionCounts.get(date) || 0) + 1);
});

// Generate array for all days in range
const formattedDailyMetrics = [];
for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dateStr = format(d, 'yyyy-MM-dd');
  formattedDailyMetrics.push({
    date: dateStr,
    visitors: dailySessionCounts.get(dateStr) || 0,
    connections: dailyConnectionCounts.get(dateStr) || 0,
    bounceRate: 0,
  });
}
```

### Real Funnel Stage Data

Query NDA and Fee Agreement from connection_requests:
```sql
SELECT 
  COUNT(*) FILTER (WHERE lead_nda_signed = true) as nda_count,
  COUNT(*) FILTER (WHERE lead_fee_agreement_signed = true) as fee_count,
  COUNT(*) as total_connections
FROM connection_requests
WHERE created_at >= [startDate]
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/analytics/datafast/UserDetailPanel.tsx` | Complete rewrite for bottom sheet with comprehensive layout |
| `src/hooks/useUnifiedAnalytics.ts` | Fix data queries, add daily metrics fallback, fix topUsers |
| `src/components/admin/analytics/datafast/FloatingGlobeToggle.tsx` | Center bottom positioning |
| `src/components/admin/analytics/datafast/ConversionCard.tsx` | Pass real breakdown data to funnel tooltips |

---

## Expected Results After Fix

1. **User Detail Panel:** Opens from bottom as slide-up sheet covering 85% of viewport, with comprehensive two-column layout matching Datafa.st
2. **Referrer:** Shows full URL with tooltip for long URLs, includes favicon
3. **Goals Tab:** Shows real milestone counts from database
4. **Users Tab:** Shows all 20+ users with connections, not just 2
5. **Daily Chart:** Shows actual daily visitor/connection data computed from raw sessions
6. **Globe/Bulb Buttons:** Positioned at bottom center of screen
7. **Funnel Tooltips:** Show real top sources and countries for each stage
