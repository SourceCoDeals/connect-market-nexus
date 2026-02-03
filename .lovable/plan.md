

# Analytics Dashboard Comprehensive Audit & Fix Plan

## Summary

After a thorough audit of all analytics hooks and components, I've identified **7 hooks and 1 table** that still query `user_sessions` without proper bot/production filtering or attribution logic. The main Intelligence Center (powered by `useUnifiedAnalytics`) is correctly filtered, but several secondary dashboards and hooks remain unfiltered.

---

## Current Status

### Already Fixed (Correct Filtering)
| Hook/Component | Filters Applied |
|----------------|-----------------|
| `useUnifiedAnalytics.ts` | `is_bot=false`, `is_production=true`, discovery source priority |
| `useEnhancedRealTimeAnalytics.ts` | `is_bot=false`, lat/lon coordinates |
| `useRealTimeAnalytics.ts` | `is_bot=false` |

### Needs Fixing (Missing Filters)

| Hook | Used By | Issue |
|------|---------|-------|
| `useUserJourneys.ts` | User Journeys Dashboard | Queries `user_journeys` table - no bot/production filter |
| `useJourneyTimeline.ts` | Journey Detail Dialog | Queries `user_sessions` - no bot filter |
| `useTrafficAnalytics.ts` | Traffic Analytics Tab | Queries `user_sessions` - **no filters at all** |
| `useCampaignAttribution.ts` | Campaign Attribution Tab | Queries `user_sessions` - **no filters at all** |
| `useUserDetail.ts` | User Detail Panel | Queries `user_sessions` - no bot filter |
| `use-predictive-user-intelligence.ts` | Predictive Intelligence | Queries `user_sessions` - no filters |
| `usePremiumAnalytics.ts` | Premium Analytics Dashboard | Queries `profiles` & `connection_requests` (OK, but could use session attribution) |

---

## Detailed Fixes Required

### 1. `useTrafficAnalytics.ts` (HIGH PRIORITY)
**Problem**: No filtering at all - includes all bots and dev traffic.

**Current code (line 74-78):**
```typescript
const { data: sessions, error } = await supabase
  .from('user_sessions')
  .select('id, user_id, device_type, browser, referrer, created_at, country, session_duration_seconds')
  .gte('created_at', startDate.toISOString())
  .order('created_at', { ascending: true });
```

**Fix**: Add bot and production filters:
```typescript
const { data: sessions, error } = await supabase
  .from('user_sessions')
  .select('id, user_id, device_type, browser, referrer, created_at, country, session_duration_seconds')
  .eq('is_bot', false)
  .eq('is_production', true)
  .gte('created_at', startDate.toISOString())
  .order('created_at', { ascending: true });
```

---

### 2. `useCampaignAttribution.ts` (HIGH PRIORITY)
**Problem**: No filtering - campaign metrics include bot sessions.

**Current code (line 57-60):**
```typescript
const { data: sessions, error: sessionsError } = await supabase
  .from('user_sessions')
  .select('session_id, user_id, utm_source, utm_medium, utm_campaign, utm_content, created_at')
  .gte('created_at', startDate.toISOString());
```

**Fix**: Add filters:
```typescript
const { data: sessions, error: sessionsError } = await supabase
  .from('user_sessions')
  .select('session_id, user_id, utm_source, utm_medium, utm_campaign, utm_content, created_at')
  .eq('is_bot', false)
  .eq('is_production', true)
  .gte('created_at', startDate.toISOString());
```

---

### 3. `useUserJourneys.ts` (MEDIUM PRIORITY)
**Problem**: The `user_journeys` table doesn't have `is_bot`/`is_production` flags - it aggregates from sessions.

**Options:**
1. Add `is_bot` and `is_production` columns to `user_journeys` table
2. Filter client-side by joining with sessions data

**Recommended Fix**: Add database columns and backfill. Create migration:
```sql
ALTER TABLE user_journeys 
ADD COLUMN is_bot BOOLEAN DEFAULT false,
ADD COLUMN is_production BOOLEAN DEFAULT true;

-- Backfill from user_sessions using the visitor's first session
UPDATE user_journeys uj
SET 
  is_bot = COALESCE((
    SELECT us.is_bot 
    FROM user_sessions us 
    WHERE us.visitor_id = uj.visitor_id 
    ORDER BY us.started_at ASC 
    LIMIT 1
  ), false),
  is_production = COALESCE((
    SELECT us.is_production 
    FROM user_sessions us 
    WHERE us.visitor_id = uj.visitor_id 
    ORDER BY us.started_at ASC 
    LIMIT 1
  ), true);
```

Then update the hook query (line 53-58):
```typescript
const { data, error } = await supabase
  .from('user_journeys')
  .select('*')
  .eq('is_bot', false)
  .eq('is_production', true)
  .gte('first_seen_at', startDateStr)
  .order('last_seen_at', { ascending: false })
  .limit(500);
```

---

### 4. `useJourneyTimeline.ts` (MEDIUM PRIORITY)
**Problem**: Session queries in `useJourneyTimeline` don't filter bots.

**Current code (line 92-95):**
```typescript
let sessionsQuery = supabase
  .from('user_sessions')
  .select('*')
  .order('started_at', { ascending: true });
```

**Fix**: Add filter:
```typescript
let sessionsQuery = supabase
  .from('user_sessions')
  .select('*')
  .eq('is_bot', false)
  .order('started_at', { ascending: true });
```

---

### 5. `useUserDetail.ts` (MEDIUM PRIORITY)
**Problem**: User detail panel queries don't filter bots.

**Current code (lines 139-151):**
```typescript
const sessionsQuery = isUserId
  ? supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', visitorId)
      .gte('started_at', sixMonthsAgo)
      .order('started_at', { ascending: false })
  : supabase
      .from('user_sessions')
      .select('*')
      .eq('visitor_id', visitorId)
      .gte('started_at', sixMonthsAgo)
      .order('started_at', { ascending: false });
```

**Fix**: Add bot filter to both branches:
```typescript
const sessionsQuery = isUserId
  ? supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', visitorId)
      .eq('is_bot', false)
      .gte('started_at', sixMonthsAgo)
      .order('started_at', { ascending: false })
  : supabase
      .from('user_sessions')
      .select('*')
      .eq('visitor_id', visitorId)
      .eq('is_bot', false)
      .gte('started_at', sixMonthsAgo)
      .order('started_at', { ascending: false });
```

Also update the `categorizeChannel` function to use discovery source priority:
```typescript
// Add getDiscoverySource helper at top of file
function getDiscoverySource(session: {
  original_external_referrer?: string | null;
  utm_source?: string | null;
  referrer?: string | null;
}): string | null {
  if (session.original_external_referrer) return session.original_external_referrer;
  if (session.utm_source) return session.utm_source;
  return session.referrer || null;
}

// Update channel categorization to use discovery source
channel: categorizeChannel(
  getDiscoverySource(firstSession) || firstSession?.referrer,
  firstSession?.utm_source, 
  firstSession?.utm_medium
),
```

---

### 6. `use-predictive-user-intelligence.ts` (LOW PRIORITY)
**Problem**: Session queries don't filter bots.

**Current code (line 67-69):**
```typescript
const { data: sessions } = await supabase
  .from('user_sessions')
  .select('user_id, started_at, ended_at')
  .gte('started_at', startDate.toISOString());
```

**Fix**:
```typescript
const { data: sessions } = await supabase
  .from('user_sessions')
  .select('user_id, started_at, ended_at')
  .eq('is_bot', false)
  .eq('is_production', true)
  .gte('started_at', startDate.toISOString());
```

---

## Files to Modify

| File | Priority | Changes |
|------|----------|---------|
| `src/hooks/useTrafficAnalytics.ts` | HIGH | Add `.eq('is_bot', false).eq('is_production', true)` |
| `src/hooks/useCampaignAttribution.ts` | HIGH | Add `.eq('is_bot', false).eq('is_production', true)` |
| `src/hooks/useUserJourneys.ts` | MEDIUM | Add filters after DB migration |
| `src/hooks/useJourneyTimeline.ts` | MEDIUM | Add `.eq('is_bot', false)` |
| `src/hooks/useUserDetail.ts` | MEDIUM | Add bot filter + discovery source logic |
| `src/hooks/use-predictive-user-intelligence.ts` | LOW | Add filters |
| `supabase/migrations/` | MEDIUM | Add `is_bot`, `is_production` to `user_journeys` |

---

## Expected Results

After implementing these fixes:

| Dashboard Area | Before | After |
|----------------|--------|-------|
| Traffic Analytics | Includes bot sessions | Clean production data only |
| Campaign Attribution | Inflated session counts | Accurate UTM tracking |
| User Journeys | Shows bot visitors | Real human journeys only |
| User Detail Panel | May show bot sessions | Filtered to real visits |
| Journey Timeline | Unfiltered history | Clean session history |

---

## Implementation Order

1. **Phase 1 (Quick Wins)**: Fix `useTrafficAnalytics.ts` and `useCampaignAttribution.ts` - just add 2 lines each
2. **Phase 2 (Core Journey)**: Create migration for `user_journeys`, then update `useUserJourneys.ts`
3. **Phase 3 (Detail Views)**: Fix `useJourneyTimeline.ts` and `useUserDetail.ts`
4. **Phase 4 (Cleanup)**: Fix `use-predictive-user-intelligence.ts`

This ensures the most visible dashboards are fixed first, with progressively less critical areas addressed afterward.
