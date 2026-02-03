
# Deep Attribution Analysis & Improvement Plan

## ✅ IMPLEMENTED - Smart First-Touch Attribution

**Status**: Implemented in `src/hooks/useUserDetail.ts` and `src/hooks/useUnifiedAnalytics.ts`

## Josh Weiss Case Study

### Current Data (from database)
| Session | Started At | Referrer | Attribution Problem |
|---------|------------|----------|---------------------|
| 1 | 16:53:20 | NULL | ← Used as "first session" → Direct |
| 2 | 16:53:35 | linkedin.com | ← TRUE discovery source! |
| 3 | 16:55:03 | sourcecodeals.com | |
| 4 | 2026-01-31 | sourcecodeals.com | |

**Timeline**: Josh had 3 sessions within 2 minutes on Aug 27, 2025. The first session (Direct) was likely a redirect/tab race condition. The LinkedIn referrer in session 2 (15 seconds later) is the TRUE discovery source.

### Why This Happens
1. **Multiple tabs**: User opens LinkedIn link, but another tab loads first without referrer
2. **Redirect timing**: OAuth/auth redirects lose referrer header
3. **Browser quirks**: Some browsers don't preserve referrer on certain navigations
4. **Session race**: Multiple page loads create separate sessions, first one wins

---

## Current Attribution Logic (useUserDetail.ts)

```text
const firstSession = sessions[sessions.length - 1]; // Chronologically first
const discoverySource = getDiscoverySource(firstSession);
```

**Priority system** (correct for single session):
1. `original_external_referrer` (cross-domain tracking)
2. `utm_source` (explicit attribution)
3. `referrer` (HTTP referrer)

**The bug**: If `firstSession` has all null values, user shows as "Direct" even when session 2+ has real attribution data.

---

## Proposed Solution: Smart First-Touch Attribution

### New Attribution Priority

Instead of blindly using the first session, find the **first meaningful attribution**:

```text
function getFirstMeaningfulSession(sessions: Session[]): Session | null {
  // Sessions are ordered DESC (most recent first), so reverse for chronological
  const chronological = [...sessions].reverse();
  
  // Priority 1: First session with original_external_referrer (cross-domain tracking)
  const withCrossDomain = chronological.find(s => s.original_external_referrer);
  if (withCrossDomain) return withCrossDomain;
  
  // Priority 2: First session with utm_source (campaign tracking)
  const withUtm = chronological.find(s => s.utm_source);
  if (withUtm) return withUtm;
  
  // Priority 3: First session with any referrer (organic discovery)
  const withReferrer = chronological.find(s => s.referrer);
  if (withReferrer) return withReferrer;
  
  // Fallback: First session (truly direct)
  return chronological[0] || null;
}
```

### Impact on Josh Weiss
- **Before**: Session 1 (Direct) used → Channel: Direct
- **After**: Session 2 (LinkedIn) used → Channel: Organic Social

---

## Implementation Details

### Files to Modify

#### 1. `src/hooks/useUserDetail.ts`

**Add helper function** (after line 108):
```text
// Find the first session with meaningful attribution data
// Priority: original_external_referrer > utm_source > referrer > any session
function getFirstMeaningfulSession(sessions: any[]): any | null {
  if (!sessions || sessions.length === 0) return null;
  
  // Sessions come sorted DESC (most recent first), reverse for chronological
  const chronological = [...sessions].reverse();
  
  // Priority 1: First session with cross-domain tracking
  const withCrossDomain = chronological.find(s => s.original_external_referrer);
  if (withCrossDomain) return withCrossDomain;
  
  // Priority 2: First session with UTM source
  const withUtm = chronological.find(s => s.utm_source);
  if (withUtm) return withUtm;
  
  // Priority 3: First session with any referrer
  const withReferrer = chronological.find(s => s.referrer);
  if (withReferrer) return withReferrer;
  
  // Fallback: actual first session
  return chronological[0];
}
```

**Update source attribution** (lines 321-340):
```text
// Use smart first-touch: find first session with meaningful attribution
const attributionSession = getFirstMeaningfulSession(sessions);
const actualFirstSession = sessions[sessions.length - 1]; // For firstSeen timestamp

source: {
  referrer: getDiscoverySource(attributionSession) || attributionSession?.referrer,
  landingPage: attributionSession?.first_touch_landing_page || actualFirstSession?.first_touch_landing_page,
  channel: categorizeChannel(
    getDiscoverySource(attributionSession), 
    attributionSession?.utm_source, 
    attributionSession?.utm_medium
  ),
  utmSource: attributionSession?.utm_source || actualFirstSession?.utm_source,
  utmMedium: attributionSession?.utm_medium || actualFirstSession?.utm_medium,
  utmCampaign: attributionSession?.utm_campaign || actualFirstSession?.utm_campaign,
  // Keep full history unchanged
  allSessions: sessions.map(s => ({...})),
}
```

#### 2. `src/hooks/useUnifiedAnalytics.ts`

**Update signup channel attribution** (lines 728-752):
Apply the same `getFirstMeaningfulSession` logic when mapping profiles to channels:

```text
filteredProfiles.forEach(p => {
  // Get all sessions for this user, find first meaningful one
  const userSessions = sessions.filter(s => s.user_id === p.id);
  const attributionSession = getFirstMeaningfulSession(userSessions) 
    || profileToFirstSession.get(p.id);
  
  // Priority 1: Cross-domain tracking
  if (attributionSession?.original_external_referrer) {
    const channel = categorizeChannel(...);
    channelSignups[channel]++;
    return;
  }
  // ... rest of logic
});
```

---

## Additional Improvements Identified

### 1. Missing visitor_id for Josh Weiss
Josh's sessions have `visitor_id: NULL`. This means:
- He signed up before the visitor tracking system was implemented (Aug 2025)
- His sessions can't be linked to a `user_journeys` record
- Cross-session tracking is broken for historical users

**Recommendation**: Backfill `visitor_id` for existing users based on their `user_id`:
```sql
-- Backfill visitor_id from user_journeys where possible
UPDATE user_sessions us
SET visitor_id = uj.visitor_id
FROM user_journeys uj
WHERE us.user_id = uj.user_id
  AND us.visitor_id IS NULL
  AND uj.visitor_id IS NOT NULL;
```

### 2. Cross-Domain Tracking Gap
The cross-domain tracking script (`sco_ref_host`) is deployed on sourcecodeals.com, but:
- Users from before Feb 2026 don't have `original_external_referrer`
- Direct traffic from blog to marketplace doesn't capture Google/LinkedIn as origin

**Status**: Already implemented and working for new signups.

### 3. Missing first_external_referrer for Josh
Profile has `first_external_referrer: NULL` because:
- He signed up in Aug 2025
- The attribution columns were added in Feb 2026
- The backfill migration only updates if `original_external_referrer` exists in sessions

**Recommendation**: Enhanced backfill using smart first-touch:
```sql
-- Backfill using first session with any referrer
UPDATE profiles p
SET first_external_referrer = (
  SELECT us.referrer
  FROM user_sessions us
  WHERE us.user_id = p.id
    AND us.referrer IS NOT NULL
    AND us.referrer != ''
  ORDER BY us.started_at ASC
  LIMIT 1
)
WHERE p.first_external_referrer IS NULL;
```

---

## Expected Results

### User Detail Panel for Josh Weiss

**Before**:
- Channel: Direct
- Source: (empty or Direct)

**After**:
- Channel: Organic Social
- Source: linkedin.com
- Visit History: Shows all 4 sessions with correct per-session channels

### Intelligence Dashboard

Users like Josh will now be correctly attributed to LinkedIn instead of Direct, improving:
- Channel distribution accuracy
- ROI calculations for social campaigns
- Funnel analysis

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useUserDetail.ts` | Add `getFirstMeaningfulSession()`, update source attribution |
| `src/hooks/useUnifiedAnalytics.ts` | Apply smart first-touch to signup attribution |
| `supabase/migrations/` | (Optional) Enhanced backfill for historical users |

This fix ensures that users are attributed to their TRUE discovery source, not an artifact of race conditions or redirect timing.
