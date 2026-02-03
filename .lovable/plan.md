
# Universal Bot & Production Filtering Plan

## Problem Summary

The Intelligence Center dashboard shows **polluted data** because the main analytics hook (`useUnifiedAnalytics`) does not filter out:
- **259 bot sessions** (Chrome/119 bots with 1.8s durations)
- **919 dev/preview traffic sessions**

This affects ALL cards in the dashboard:
- Geography (Country/Region/City)
- Sources (Channel/Referrer/Campaign/Keyword)
- Pages (Page/Entry page/Exit page)
- Tech Stack (Browser/OS/Device)
- Conversion (Goals/Funnel/Users/Journey)
- KPI Strip metrics

---

## Root Cause

The `useUnifiedAnalytics.ts` hook queries `user_sessions` without filtering:
```text
supabase
  .from('user_sessions')
  .select('...')
  .gte('started_at', startDateStr)
  // MISSING: .eq('is_bot', false)
  // MISSING: .eq('is_production', true)
```

---

## Solution

### Single Point of Change

Add two filters to the main session queries in `useUnifiedAnalytics.ts`:

```text
.eq('is_bot', false)
.eq('is_production', true)
```

This will cascade to:
- KPI metrics (visitors, sessions, bounce rate, conversion rate)
- Geography aggregations (countries, regions, cities)
- Source aggregations (channels, referrers, campaigns, keywords)
- Page aggregations (top pages, entry pages, exit pages)
- Tech stack aggregations (browsers, OS, devices)
- Funnel stages
- Top users list

### File Changes

**1. `src/hooks/useUnifiedAnalytics.ts`**

Add filters to all session queries:

**Query 1: Current period sessions (line ~217-221)**
```text
supabase
  .from('user_sessions')
  .select('...')
  .eq('is_bot', false)           // ADD
  .eq('is_production', true)     // ADD
  .gte('started_at', startDateStr)
  .order('started_at', { ascending: false })
```

**Query 2: Previous period sessions (line ~224-228)**
```text
supabase
  .from('user_sessions')
  .select('...')
  .eq('is_bot', false)           // ADD
  .eq('is_production', true)     // ADD
  .gte('started_at', prevStartDateStr)
  .lt('started_at', startDateStr)
```

**Query 3: Active sessions for "online now" (line ~257-261)**
```text
supabase
  .from('user_sessions')
  .select('id')
  .eq('is_active', true)
  .eq('is_bot', false)           // ADD
  .eq('is_production', true)     // ADD
  .gte('last_active_at', twoMinutesAgo)
```

**Query 4: First sessions for signup attribution (line ~337-342)**
```text
supabase
  .from('user_sessions')
  .select('...')
  .eq('is_bot', false)           // ADD
  .eq('is_production', true)     // ADD
  .in('user_id', profileIds)
  .order('started_at', { ascending: true })
```

### Client-Side Fallback (Defense in Depth)

Also add a client-side filter after fetching (in case any bots slip through):

```text
// After line ~390, enhance the existing dev traffic filter:
const sessions = rawSessions.filter(s => 
  !isDevTraffic(s.referrer) &&
  !s.user_agent?.includes('Chrome/119.') &&
  !s.user_agent?.includes('Chrome/118.') &&
  !s.user_agent?.includes('Chrome/117.') &&
  !s.user_agent?.includes('HeadlessChrome')
);
```

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Session count (30d) | ~2,204 | ~1,285 (production only) |
| Bot sessions included | 259 | 0 |
| Dev traffic included | 919 | 0 |
| Data accuracy | ~60% | ~100% |

### Visual Changes

**Geography Card:**
- France: 35 → ~15 (removes bot traffic)
- Netherlands: 30 → ~12 (removes bot traffic)
- More accurate country distribution

**Sources Card:**
- Direct: 135 → ~75 (removes bot direct visits)
- More accurate channel attribution

**Users Card:**
- Removes all 2s anonymous sessions like "Jade Eagle", "Amber Serpent"
- Only shows real human visitors

---

## Technical Notes

1. **No UI changes needed** - All cards already consume data from `useUnifiedAnalytics`
2. **No component changes needed** - Cards are pure display components
3. **Query-level filtering is efficient** - Supabase handles this at the database level
4. **Backward compatible** - Existing filters and global filtering still work

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Add `.eq('is_bot', false).eq('is_production', true)` to 4 session queries + enhance client-side filter |

---

## Verification

After implementation:
1. Geography card should show fewer visitors but more accurate data
2. Users tab should no longer show 2s anonymous sessions
3. Channel distribution should be more meaningful (less "Direct")
4. KPI strip totals will decrease but represent real traffic
