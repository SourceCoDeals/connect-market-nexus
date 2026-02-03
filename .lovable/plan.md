

# Fix Analytics Dashboard Global Filtering

## Problem Summary

When filtering by a referrer (e.g., "chatgpt"), the dashboard shows incorrect data:
- **KPI Strip**: Shows 0 visitors instead of 1
- **Cards (Geography, Pages, Tech)**: Show "No data" instead of the filtered visitor's data
- **Users tab**: Empty instead of showing the visitor from ChatGPT
- **Chart**: Shows all visitors, not just filtered ones

## Root Cause

**The filter matching logic doesn't use the same discovery source priority as the display logic.**

| Component | Display Logic | Filter Logic (Bug) |
|-----------|--------------|-------------------|
| Referrer card | `getDiscoverySource(s)` | `s.referrer` only |
| Channel card | `getDiscoverySource(s)` | `s.referrer` only |

When a user clicks "chatgpt" in the Referrer card:
- The value "chatgpt" was extracted from `utm_source` via `getDiscoverySource()`
- But the filter matches against `extractDomain(s.referrer)` which returns "sourcecodeals.com"
- Result: **Zero sessions match** = all cards show empty

## Solution

### 1. Fix Referrer Filter Matching (Critical)

**File: `src/hooks/useUnifiedAnalytics.ts` (lines 449-452)**

Current:
```typescript
if (filter.type === 'referrer') {
  uniqueSessions = uniqueSessions.filter(s => 
    extractDomain(s.referrer) === filter.value
  );
}
```

Fixed:
```typescript
if (filter.type === 'referrer') {
  uniqueSessions = uniqueSessions.filter(s => {
    const discoverySource = getDiscoverySource(s);
    const domain = extractDomain(discoverySource);
    return domain === filter.value || 
           domain.includes(filter.value) || 
           filter.value.includes(domain);
  });
}
```

### 2. Fix Channel Filter Matching

**File: `src/hooks/useUnifiedAnalytics.ts` (lines 444-447)**

Current:
```typescript
if (filter.type === 'channel') {
  uniqueSessions = uniqueSessions.filter(s => 
    categorizeChannel(s.referrer, s.utm_source, s.utm_medium) === filter.value
  );
}
```

Fixed:
```typescript
if (filter.type === 'channel') {
  uniqueSessions = uniqueSessions.filter(s => {
    const discoverySource = getDiscoverySource(s);
    return categorizeChannel(discoverySource, s.utm_source, s.utm_medium) === filter.value;
  });
}
```

### 3. Fix Daily Metrics Chart Filtering

**File: `src/hooks/useUnifiedAnalytics.ts` (lines 1359-1387)**

When filters are active, the chart should use computed data from filtered sessions, not pre-aggregated `daily_metrics` table:

```typescript
// Format daily metrics - ALWAYS compute from filtered sessions when filters are active
let formattedDailyMetrics: Array<...>;

// When filters are active, always compute from session data (filtered)
if (filters.length > 0) {
  // Compute from filtered uniqueSessions
  formattedDailyMetrics = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  while (currentDate <= end) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    formattedDailyMetrics.push({
      date: dateStr,
      visitors: dailyVisitorSets.get(dateStr)?.size || 0,
      sessions: dailySessionCounts.get(dateStr) || 0,
      connections: dailyConnectionCounts.get(dateStr) || 0,
      bounceRate: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
} else if (dailyMetrics.length > 0) {
  // Use pre-aggregated data only when no filters
  formattedDailyMetrics = dailyMetrics.map(m => ({...}));
} else {
  // Fallback
  formattedDailyMetrics = [...];
}
```

### 4. Add Scrollable Users Tab with Fixed Height

**File: `src/components/admin/analytics/datafast/ConversionCard.tsx`**

Update UsersTab to have a scrollable container with max height:

```typescript
function UsersTab({ users, onUserClick }: {...}) {
  return (
    <div className="relative">
      {/* Scrollable container with fixed height */}
      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-1">
        {/* Header row - sticky at top */}
        <div className="sticky top-0 bg-card z-10 ...">
          {...header...}
        </div>
        
        {/* All users, not just first 15 */}
        {users.map((user) => (
          <ProportionalBar key={user.id} {...} />
        ))}
      </div>
    </div>
  );
}
```

Also increase the limit from 15 to show more users (50 is already fetched).

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Fix referrer/channel filter matching + daily metrics filtering |
| `src/components/admin/analytics/datafast/ConversionCard.tsx` | Add scrollable users container |

## Expected Results

After this fix, when filtering by "chatgpt":
- **KPI Strip**: Will show 1 visitor, 0 connections (correct data for that visitor)
- **Chart**: Will show activity bars only for days when the ChatGPT visitor was active
- **Geography card**: Will show the country of that single visitor
- **Tech card**: Will show Chrome/Windows (or whatever that visitor used)
- **Users tab**: Will show "Violet Fox" (or the actual visitor's name) with ChatGPT as source

## Visual Reference from datafast.st

When filtered by ChatGPT in datafast.st:
- Shows 21 visitors in KPI
- Chart shows only those 21 visitors' activity pattern
- Countries show distribution of those 21 visitors
- Users tab shows scrollable list with all matching visitors

This is exactly what we're fixing - making our filtering work the same way.

