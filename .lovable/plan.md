
# Intelligence Center Data Accuracy Overhaul

## Critical Issues Discovered

### Issue 1: "Visitors" Metric Actually Counts Sessions (NOT People)

**The Core Problem:**
The dashboard shows "98 Visitors" for Feb 2nd, but there were actually only **17 unique people** (and only **15** if you exclude dev traffic).

**Database Evidence (Feb 2nd):**
| Metric | Actual Value |
|--------|--------------|
| Total rows in user_sessions | 1,044 |
| Unique session_ids | 110 |
| **TRUE unique visitors** | **17** |
| Sessions from lovable.dev (dev traffic) | 999 |
| Sessions from your dev account | 982 |
| **Real unique visitors (excluding dev)** | **15** |

**Root Cause in Code (`useUnifiedAnalytics.ts` lines 221-230):**
```typescript
// CURRENT - WRONG: Counts unique sessions, not visitors
const sessionMap = new Map<string, typeof sessions[0]>();
sessions.forEach(s => {
  if (!sessionMap.has(s.session_id)) {
    sessionMap.set(s.session_id, s);
  }
});
const uniqueSessions = Array.from(sessionMap.values());
const currentVisitors = uniqueSessions.length; // ← THIS IS SESSIONS, NOT VISITORS!
```

**Affected Components:**
- `KPIStrip.tsx` - Main "Visitors" number
- `DailyVisitorsChart.tsx` - Historical chart
- `SourcesCard.tsx` - Per-source breakdowns
- `GeographyCard.tsx` - Per-country breakdowns
- `TechStackCard.tsx` - Per-browser/OS breakdowns
- `daily_metrics` table - Stores `total_sessions` but displays as "visitors"

---

### Issue 2: Development/Bot Traffic Pollutes All Metrics

**Your dev account created 982 sessions today** from `lovable.dev` referrer.

**Traffic Breakdown (Jan 2026):**
| Traffic Type | Total Sessions | Unique Sessions | Unique Visitors |
|--------------|----------------|-----------------|-----------------|
| Lovable/Development | 4,127 | 857 | 3 |
| Direct (no referrer) | 1,458 | 863 | 87 |
| Real Traffic | 783 | 379 | 87 |

**65% of all sessions are development traffic** - completely unusable for analytics.

---

### Issue 3: Duplicate Row Insertion (Race Condition)

One session_id (`caa6ab6e-...`) has **695 duplicate rows** inserted over 32 hours.

**Cause:** The edge function's `maybeSingle()` check races with concurrent requests, causing multiple INSERTs for the same session_id before the first INSERT completes.

---

### Issue 4: Wrong Metric in `daily_metrics` Table

The backfill function stores `total_sessions` in `daily_metrics`, but the UI displays this as "visitors":

```typescript
// daily_metrics stores session count:
total_sessions: sessions?.length || 0

// UI maps it to "visitors":
formattedDailyMetrics = dailyMetrics.map(m => ({
  visitors: m.total_sessions || 0,  // ← WRONG LABEL
}));
```

---

### Issue 5: Terminology Misuse Everywhere

The codebase uses "visitors" and "sessions" interchangeably when they mean completely different things:

| Term | Correct Definition | Current Usage |
|------|-------------------|---------------|
| **Visitor** | A unique person (by `visitor_id` or `user_id`) | ❌ Used to mean session count |
| **Session** | One visit (may have multiple per visitor) | ❌ Called "visitor" in UI |
| **Page View** | Single page load within a session | ✅ Used correctly |

---

## Fix Strategy

### Phase 1: Fix the Visitor Count Calculation

**In `useUnifiedAnalytics.ts`:**

```typescript
// NEW - CORRECT: Count unique PEOPLE, not sessions
const uniqueVisitors = new Set<string>();
sessions.forEach(s => {
  const visitorKey = s.user_id || s.visitor_id || s.session_id;
  uniqueVisitors.add(visitorKey);
});
const currentVisitors = uniqueVisitors.size; // TRUE unique visitors

// Keep session count as separate metric
const currentSessions = uniqueSessions.length;
```

**Update all breakdown calculations** to use the same pattern for geo, sources, tech:
```typescript
// For each category, count unique visitor_ids, not session counts
const countryVisitors = new Map<string, Set<string>>();
uniqueSessions.forEach(s => {
  const country = s.country || 'Unknown';
  if (!countryVisitors.has(country)) countryVisitors.set(country, new Set());
  countryVisitors.get(country)!.add(s.user_id || s.visitor_id || s.session_id);
});
```

---

### Phase 2: Filter Out Development Traffic

**Add exclusion filter in `useUnifiedAnalytics.ts`:**

```typescript
// Filter out development/preview traffic
const productionSessions = sessions.filter(s => {
  const referrer = s.referrer || '';
  return !referrer.includes('lovable.dev') 
      && !referrer.includes('lovableproject.com')
      && !referrer.includes('preview--');
});
```

**Consider adding a toggle** in the UI: "Include dev traffic" checkbox for debugging.

---

### Phase 3: Add `unique_visitors` Column to `daily_metrics`

**Database migration:**
```sql
ALTER TABLE daily_metrics 
ADD COLUMN IF NOT EXISTS unique_visitors INTEGER DEFAULT 0;
```

**Update `aggregate-daily-metrics` function:**
```typescript
// Count unique visitors (by visitor_id or user_id)
const { data: visitorData } = await supabase
  .from('user_sessions')
  .select('user_id, visitor_id')
  .gte('started_at', startOfDay)
  .lte('started_at', endOfDay);

const uniqueVisitorSet = new Set(
  visitorData?.map(s => s.user_id || s.visitor_id).filter(Boolean)
);
const uniqueVisitors = uniqueVisitorSet.size;

return {
  ...metrics,
  unique_visitors: uniqueVisitors,
  total_sessions: totalSessions, // Keep for "visits" metric
};
```

**Update `backfill-daily-metrics`** with the same logic and re-run.

---

### Phase 4: Fix Race Condition in Session Tracking

**In `track-session/index.ts`, use UPSERT instead of check-then-insert:**

```typescript
// REPLACE the maybeSingle() check with UPSERT
const { error: upsertError } = await supabase
  .from('user_sessions')
  .upsert({
    session_id: body.session_id,
    // ... all fields
  }, {
    onConflict: 'session_id',
    ignoreDuplicates: false, // Update existing instead
  });
```

**This requires adding a UNIQUE constraint on `session_id`:**
```sql
ALTER TABLE user_sessions 
ADD CONSTRAINT user_sessions_session_id_unique UNIQUE (session_id);
```

---

### Phase 5: Add Both Metrics to UI

**Update `KPIStrip.tsx` to show BOTH:**
- **Visitors** (unique people)
- **Sessions** (visits)

**Update chart tooltip to clarify:**
```tsx
<ChartTooltipContent 
  data={{
    date: data.date,
    visitors: data.uniqueVisitors,  // People
    sessions: data.totalSessions,   // Visits
    connections: data.connections,
  }}
/>
```

---

## Implementation Order

| Priority | Task | Impact |
|----------|------|--------|
| **P0** | Fix visitor counting logic in `useUnifiedAnalytics.ts` | Accurate main KPI |
| **P0** | Filter dev traffic from metrics | Remove 65% pollution |
| **P1** | Add `unique_visitors` column to `daily_metrics` | Historical accuracy |
| **P1** | Update backfill function with visitor counting | Populate historical data |
| **P1** | Re-run backfill for all dates | Historical charts fixed |
| **P2** | Fix race condition with UPSERT | Prevent duplicate rows |
| **P2** | Add "Sessions" as secondary metric in UI | Complete picture |
| **P3** | Cleanup duplicate rows in database | Data hygiene |

---

## Expected Results After Fix

| Metric | Before (Feb 2nd) | After (Feb 2nd) |
|--------|------------------|-----------------|
| "Visitors" display | 98 (wrong) | 15 (correct, excluding dev) |
| "Sessions" display | N/A | 43 (new metric) |
| Dev traffic | Included | Filtered out |
| Historical charts | Show sessions | Show true visitors |
| Conversion rate | Inflated | Accurate |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Fix visitor counting, filter dev traffic, add sessions metric |
| `supabase/functions/aggregate-daily-metrics/index.ts` | Add unique_visitors calculation |
| `supabase/functions/backfill-daily-metrics/index.ts` | Add unique_visitors calculation |
| `supabase/functions/track-session/index.ts` | Fix race condition with UPSERT |
| `src/components/admin/analytics/datafast/KPIStrip.tsx` | Show both visitors and sessions |
| `src/components/admin/analytics/datafast/DailyVisitorsChart.tsx` | Use correct data field |
| Database migration | Add unique_visitors column, UNIQUE constraint on session_id |

---

## Terminology Clarification for Future

| Metric | Definition | How to Count |
|--------|------------|--------------|
| **Unique Visitors** | Individual people | `COUNT(DISTINCT COALESCE(user_id, visitor_id))` |
| **Sessions** | Individual visits | `COUNT(DISTINCT session_id)` |
| **Page Views** | Individual page loads | `COUNT(*)` from page_views |
| **Connections** | Deal inquiries sent | `COUNT(*)` from connection_requests |
| **Conversion Rate** | Connections ÷ Unique Visitors | Not sessions! |

This ensures your Intelligence Center shows accurate, actionable data that reflects real marketplace activity - not inflated session counts or development noise.
