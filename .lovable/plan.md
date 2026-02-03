
# Bot Filtering & Geographic Accuracy Plan

## Problem Summary

Your real-time globe is polluted with **38% bot traffic** disguised as anonymous visitors. These appear as "jade eagle", "amber fox", etc. with 2-3 second sessions. Additionally, geographic placement is inaccurate for smaller cities not in the coordinate lookup table.

## Issues Identified

### Issue 1: Bot Traffic Polluting Analytics
- 148 bot sessions in the last 7 days (38% of production traffic)
- All share identical signature: `Chrome/119.0.0.0` (outdated by 2+ years)
- All originate from Cloudflare proxy IPs (`104.28.x.x`)
- Sessions last exactly 2-3 seconds with no referrer
- Page path: always `/` → `/welcome` only

### Issue 2: Inaccurate Globe Placement
- Cities like "Chamartin" (Madrid suburb), "Aulnay-sous-Bois" (Paris suburb) are not in the coordinate map
- These fall back to country center coordinates instead of accurate city positions
- The IP geolocation service returns accurate data, but the frontend lookup is limited

## Solution Architecture

### Part 1: Server-Side Bot Detection & Filtering

Add bot detection to the `track-session` edge function with a new `is_bot` flag:

**Detection Signals:**
1. Outdated browser version (Chrome/119 when current is 142+)
2. Session duration < 5 seconds with only 1-2 page views
3. Known bot user agent strings (HeadlessChrome, GoogleOther)
4. No referrer + landing on root path only
5. IP patterns from known proxy/datacenter ranges

**Implementation:**
- Add `is_bot` boolean column to `user_sessions` table
- Update `track-session` function to detect bots on initial request
- Create background job to flag sessions that complete with bot patterns

### Part 2: Real-Time Dashboard Filtering

Update `useEnhancedRealTimeAnalytics` to filter out detected bots:

```text
.eq('is_bot', false)  // Add to session query
```

Also add UI toggle to optionally show/hide bot traffic for debugging.

### Part 3: Dynamic Geocoding via API

Replace static city coordinate map with API-based geocoding:

**Option A: Use IP-API coordinates directly**
The `ip-api.com` service returns `lat` and `lon` fields. We should capture and store these in `user_sessions`.

**Option B: Forward geocoding fallback**
For cities not in the static map, use a geocoding API (MapTiler, Mapbox, or free Nominatim) to look up coordinates.

### Part 4: Backfill & Cleanup

1. Mark existing bot sessions with SQL:
```sql
UPDATE user_sessions 
SET is_bot = true 
WHERE user_agent LIKE '%Chrome/119.0%' 
   OR user_agent LIKE '%HeadlessChrome%'
   OR user_agent LIKE '%GoogleOther%';
```

2. Add coordinates to `user_sessions` table for accurate placement

---

## Technical Implementation

### Database Changes

**Migration: Add bot detection and coordinate columns**
```text
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;
```

### File Changes

**1. `supabase/functions/track-session/index.ts`**
- Parse IP-API response to extract `lat` and `lon`
- Add `detectBot()` function checking:
  - User agent patterns (Chrome/119, HeadlessChrome)
  - Known bot strings (GoogleOther, Googlebot, etc.)
- Store `is_bot`, `lat`, `lon` in session record

**2. `src/hooks/useEnhancedRealTimeAnalytics.ts`**
- Add `.eq('is_bot', false)` filter to session query
- Update coordinate logic to prefer stored lat/lon over lookup

**3. `src/components/admin/analytics/realtime/MapboxGlobeMap.tsx`**
- Use session's stored coordinates when available
- Fall back to city lookup only when lat/lon missing

**4. Create new migration file**
- Add `is_bot`, `lat`, `lon` columns
- Backfill existing bot sessions

**5. `src/integrations/supabase/types.ts`**
- Regenerate to include new columns

---

## Bot Detection Rules

| Signal | Confidence | Action |
|--------|------------|--------|
| Chrome/119 user agent | High | Flag as bot |
| HeadlessChrome | Definite | Flag as bot |
| GoogleOther/Googlebot | Definite | Flag as bot |
| Session < 3s + 2 pages only | Medium | Flag if combined with above |
| No referrer + root landing | Low | Only flag if combined |

---

## Immediate Quick Fix (Recommended First Step)

Before implementing the full solution, add a client-side filter to hide obvious bots:

In `useEnhancedRealTimeAnalytics.ts`:
```text
// Filter out likely bot sessions on the client
const filteredSessions = sessions.filter(s => 
  !s.user_agent?.includes('Chrome/119.0') &&
  !s.user_agent?.includes('HeadlessChrome') &&
  (s.session_duration_seconds || 0) > 3
);
```

This immediately cleans up the globe while the full server-side solution is implemented.

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Bot traffic visible | 38% | 0% |
| Location accuracy | ~40% (city lookup) | ~95% (lat/lon from IP) |
| False positives | N/A | <1% (Chrome 119 is definitively outdated) |
| Real-time globe quality | Polluted | Clean, accurate |

---

## Summary

1. **Quick fix**: Add client-side filtering for Chrome/119 bots immediately
2. **Database**: Add `is_bot`, `lat`, `lon` columns to `user_sessions`
3. **Edge function**: Capture lat/lon from IP-API, detect bots on ingest
4. **Dashboard**: Filter to show only non-bot traffic
5. **Backfill**: Mark existing Chrome/119 sessions as bots
