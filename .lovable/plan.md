

# Critical Data Accuracy Issues - Deep Investigation Results

## Executive Summary

The data discrepancy you're seeing is NOT fake data - it's **fragmented real data** caused by **two separate tracking systems** that don't share geographic information.

---

## The Core Problem: Two Session Creation Paths

Your platform has **TWO WAYS** sessions get created, and they capture **different data**:

### Path 1: Frontend Session Tracking (via `track-session` edge function)
- Captures: Browser, OS, Device, IP, **Country, City, Region**
- Used by: Anonymous visitors (before login)
- Has: `visitor_id` (from localStorage)
- Result: **16 tracked visitors with country data**

### Path 2: Backend Auth Session (via Supabase Auth)
- Captures: `user_id`, session_id, minimal metadata
- Used by: Logged-in users
- Does NOT capture: **Country, City, IP, Browser, OS**
- Result: **108 logged-in users with NO country data**

---

## The Math Behind Your Screenshot

| Metric | Value | Source |
|--------|-------|--------|
| **KPI: Unique Visitors** | 124 | 108 user_ids + 16 visitor_ids |
| **Country breakdown total** | 16 | Only sessions with geo data (anonymous only) |
| **Browser breakdown total** | 80 | 63 logged-in with browser + 16 anonymous |
| **"Unknown" country** | 108 | All logged-in users (filtered out of display) |

### Why only 16 visitors show in Country tab:
```
France: 9 (all anonymous visitor_ids)
Netherlands: 3 (all anonymous visitor_ids)  
UK: 3 (all anonymous visitor_ids)
US: 1 (all anonymous visitor_ids)
Spain: 0 (anonymous sessions without visitor_id)
---
Total: 16 visitors with country data
```

### Why 108 logged-in users have NO country:
When users log in, the auth system creates a new session row with `user_id`, but:
- The frontend tracking call happens BEFORE login
- After login, the new auth session doesn't call `track-session` again
- So the logged-in session has **no geo-data** attached

---

## Database Evidence

```sql
-- Sessions with country data (geo-tracked)
| Category                    | Count |
|----------------------------|-------|
| Has user_id, has country   | 0     | ← ALL 0!
| Has user_id, has browser   | 63    |
| Has user_id, NO browser    | 108   |
| Has visitor_id, has country| 16    |
```

### Geo tracking only started working recently:
```
| Date       | Sessions | With Country |
|------------|----------|--------------|
| Feb 2      | 52       | 42 ✓         |
| Feb 1      | 16       | 14 ✓         |
| Jan 30     | 60       | 25 ✓         |
| Jan 29     | 44       | 0            |
| Jan 28     | 12       | 0            |
| Jan 26     | 107      | 0            |
```

Geo tracking only started working on **Jan 30, 2026**.

---

## Why Browser/OS Numbers Are Higher

Browser data IS captured for some logged-in users because:
1. The frontend creates a session and calls `track-session` with browser/OS
2. User logs in → a NEW session row is created by auth
3. Some sessions have browser data (from path 1), some don't (pure auth sessions)

```
Chrome: 76 visitors (60 logged-in + 16 anonymous)
Firefox: 2 visitors
Safari: 2 visitors
---
Total: 80 (matches database, not 124 because overlap)
```

---

## Why Pages Show ~230 Visitors for "/" 

The Pages card counts **unique sessions per page**, not unique visitors:
- `/` page: 1,327 unique session_ids viewed it
- This is NOT filtered by dev traffic
- This is NOT using the same visitor logic as KPIs

The Pages card is using `page_views` table which doesn't filter dev traffic!

---

## The Fix Required

### Fix 1: Merge Session Data on Login

When a user logs in, update their **existing** session (from anonymous tracking) with their `user_id`, rather than creating a new session.

**In `SessionContext.tsx` or auth callback:**
```typescript
// After successful login, UPDATE the existing session with user_id
await supabase
  .from('user_sessions')
  .update({ user_id: user.id })
  .eq('session_id', currentSessionId);
```

### Fix 2: Re-track Geo on Auth Session

When auth creates a session, call `track-session` again with the user_id to capture geo data:

**In auth callback:**
```typescript
// After login, call track-session to capture geo for the logged-in session
await supabase.functions.invoke('track-session', {
  body: {
    session_id: authSession.access_token.substring(0, 36),
    user_id: user.id,
    visitor_id: localStorage.getItem('visitor_id'),
    user_agent: navigator.userAgent,
    // ... other tracking data
  }
});
```

### Fix 3: Filter Dev Traffic in Pages

Update `useUnifiedAnalytics.ts` to filter dev traffic from page views:

```typescript
// Filter page views by excluding dev sessions
const productionPageViews = pageViews.filter(pv => {
  // Only include page views from production sessions
  return uniqueSessions.some(s => s.session_id === pv.session_id);
});
```

### Fix 4: Backfill Country Data (Optional)

For historical sessions with `user_id` but no country, we could:
1. Look up the user's most recent session with country data
2. Copy that country to their historical sessions

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/SessionContext.tsx` | Merge anonymous session with auth session on login |
| `src/hooks/useUnifiedAnalytics.ts` | Filter dev traffic from page_views; use consistent visitor key |
| `supabase/functions/track-session/index.ts` | Handle session updates (not just inserts) |
| `src/pages/Auth.tsx` or auth callback | Call track-session after login with user_id |

---

## Expected Results After Fix

| Metric | Current | After Fix |
|--------|---------|-----------|
| KPI Visitors | 124 | 124 (same) |
| Country breakdown | 16 | ~100+ (includes logged-in users) |
| Browser breakdown | 80 | ~120 (more complete) |
| Pages "/" | 1,327 | ~300-400 (filtered) |
| Country <> Browser gap | 80 vs 16 | Should match |

---

## Summary

The data is **REAL**, but it's **fragmented** across two session creation paths. Anonymous visitors get geo-tracked, but logged-in users don't inherit that tracking. The fix is to **merge session data on login** rather than creating new sessions.

