
# Plan: Fix Data Consistency and Filter Propagation Issues

## Problem Summary

Two critical issues have been identified:

1. **Visitor-Signup Mismatch**: When filtering by "Organic Search" or "Google", the dashboard shows 15 signups but only 1 visitor. This is because signups are attributed from self-reported data (`profiles.referral_source`), while visitors are counted from session `referrer`. Users who reported "Google" often arrived via the main website (`sourcecodeals.com`), so their session referrer doesn't match "google.com".

2. **Filters Not Applying to Some Cards**: The Pages card and ConversionCard (funnel, users, journey) don't respect global filters because:
   - `pageViews` is not filtered to match filtered sessions
   - `topUsers` is built from unfiltered connection and profile data
   - `funnel` stages use unfiltered counts

---

## Solution Overview

### Part A: Fix Filter Propagation

Update `useUnifiedAnalytics.ts` to properly filter:

1. **Page Views**: Filter `pageViews` to only include views from filtered sessions
2. **Connections**: Filter `connections` to users who have matching filtered sessions  
3. **Profiles (Signups)**: Filter profiles to match the filter criteria (if filtering by channel, only count signups from that channel)
4. **Funnel Data**: Recalculate funnel using filtered data
5. **Top Users**: Build from filtered user set

### Part B: Fix Signup Attribution Consistency

When filtering by channel/referrer, ensure signups are counted consistently:

- If a channel filter is active (e.g., "Organic Search"), only count signups that actually have:
  1. A first session with that channel, OR
  2. A self-reported source that maps to that channel

This ensures visitor and signup counts are logically consistent.

---

## Technical Implementation

### Changes to `src/hooks/useUnifiedAnalytics.ts`

#### 1. Filter Page Views by Session IDs

After filtering `uniqueSessions`, create a set of valid session IDs and filter page views:

```text
Location: After line ~429 (after filters are applied to uniqueSessions)

// Get session IDs from filtered sessions
const filteredSessionIds = new Set(uniqueSessions.map(s => s.session_id));

// Filter page views to only include views from filtered sessions
const filteredPageViews = filters.length > 0
  ? pageViews.filter(pv => pv.session_id && filteredSessionIds.has(pv.session_id))
  : pageViews;
```

#### 2. Filter Connections by User Sessions

Only count connections from users who have sessions in the filtered set:

```text
Location: After uniqueSessions filtering

// Get user IDs from filtered sessions
const filteredUserIds = new Set(
  uniqueSessions.filter(s => s.user_id).map(s => s.user_id as string)
);

// Filter connections to only users with matching sessions
const filteredConnections = filters.length > 0
  ? connections.filter(c => c.user_id && filteredUserIds.has(c.user_id))
  : connections;

// Use filteredConnections throughout instead of connections
```

#### 3. Filter Signups (Profiles) Consistently

When channel/referrer filter is active, only count signups that match:

```text
Location: After profile-to-session mapping

// Filter profiles based on active filters
let filteredProfiles = profiles;

if (filters.length > 0) {
  filteredProfiles = profiles.filter(p => {
    const firstSession = profileToFirstSession.get(p.id);
    
    for (const filter of filters) {
      if (filter.type === 'channel') {
        // Check if profile's attributed channel matches
        const selfReportedChannel = selfReportedSourceToChannel(p.referral_source);
        const sessionChannel = firstSession 
          ? categorizeChannel(firstSession.referrer, firstSession.utm_source, firstSession.utm_medium)
          : null;
        
        if (selfReportedChannel !== filter.value && sessionChannel !== filter.value) {
          return false;
        }
      }
      // Similar logic for referrer, country, etc.
    }
    return true;
  });
}
```

#### 4. Use Filtered Data Throughout

Replace all occurrences:
- `pageViews` → `filteredPageViews` (for pages breakdown)
- `connections` → `filteredConnections` (for KPIs, channels, funnel)
- Use `filteredUserIds` for topUsers

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Add filtering for pageViews, connections, profiles; update all derived calculations to use filtered data |

---

## Expected Outcome After Fix

When filtering by "Organic Search":

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Visitors | 1 | 1 |
| Signups | 15 | 1-2 (only signups with matching session) |
| Pages | All pages | Only pages viewed by Google visitors |
| Users tab | All users | Only Google-attributed users |
| Funnel | All data | Filtered funnel for Google traffic |

The key insight is that when a filter is active, **all metrics should be logically consistent** - you can't have more signups than visitors from a source.

---

## Verification Steps

1. Apply "Organic Search" filter
2. Confirm visitor count matches signup count logic
3. Confirm Pages card shows only pages viewed by filtered sessions
4. Confirm Users tab shows only users matching the filter
5. Confirm Funnel stages reflect filtered journey
6. Remove filter and confirm full data returns
