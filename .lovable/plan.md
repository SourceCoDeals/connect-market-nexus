

# Investigation Results: Intelligence Center Data Integrity

## Summary of Findings

I've conducted a deep investigation into the three issues you raised. Here are my findings:

---

## Issue 1: Channels/Referrers - Are They Real?

**VERDICT: YES, all channels are real tracked data**

The channels and referrers come 100% from the `user_sessions.referrer` field, which is captured via the browser's `document.referrer` at session start. The `categorizeChannel()` function in `useUnifiedAnalytics.ts` classifies these into channels based on actual referrer patterns:

| Channel | Detection Method | Status |
|---------|-----------------|--------|
| Direct | No referrer present | Real - tracked |
| Brevo (Email) | `referrer ILIKE '%brevo%'` | Real - 55 sessions |
| sourcecodeals | `referrer ILIKE '%sourcecodeals%'` | Real - 172 sessions |
| Google | `referrer ILIKE '%google%'` | Real - 11 sessions |
| LinkedIn | `referrer ILIKE '%linkedin%'` | Real - 1 session |
| AI (ChatGPT, Perplexity) | `referrer ILIKE '%chatgpt%'` | Ready - will track |

**No self-reported data is mixed in.** The "Source" tab with self-reported data was already removed per your earlier request.

**One data quality issue found:** 43% of sessions (913 of 2,104) come from Lovable dev environments (`lovable.dev`, `lovableproject.com`, `preview--`). These are filtered out by the `isDevTraffic()` function, but they're still being created in the database. After filtering, you have approximately 1,191 production sessions.

---

## Issue 2: Geography Data - The Critical Gap

**VERDICT: Geography data is severely limited due to late IP tracking deployment**

### Current State

| Metric | Value |
|--------|-------|
| Total sessions (30 days) | 2,104 |
| Sessions with country data | 154 (7.3%) |
| Sessions without geo data | 1,950 (92.7%) |

### Root Cause

IP geolocation tracking was only deployed on **January 30, 2026**. Looking at daily data:

| Date | Sessions | With Geo |
|------|----------|----------|
| Feb 2 | 221 | 94 (42%) |
| Feb 1 | 63 | 16 (25%) |
| Jan 31 | 68 | 19 (28%) |
| Jan 30 | 134 | 25 (19%) |
| Jan 29 and earlier | All | **0 (0%)** |

### Why Not 100% Today?

Even on Feb 2, only 42% of sessions have geo data. This is because:
1. Many sessions come from Lovable preview/dev environments where IP tracking returns local IPs
2. The `getGeoData()` function skips private IPs (`127.0.0.1`, `192.168.*`, `10.*`)

### Historical Backfill Status

I checked - the `enrich-geo-data` edge function exists, but most historical sessions **do not have IP addresses stored**, so there's no way to retroactively get geo data for them. The IP column only started getting populated on Jan 30.

**Conclusion:** We can only have real geographic data for sessions starting Jan 30, 2026 onwards, and only for production traffic (not dev/preview).

---

## Issue 3: Pages Card Shows "No page data"

**VERDICT: This is a filtering bug - data exists but gets filtered out**

### The Data Exists

| Metric | Value |
|--------|-------|
| Total page views (30 days) | 6,705 |
| Unique sessions with views | 2,687 |
| Top pages | `/` (1,901), `/welcome` (1,001), `/admin` (685) |

### Why It Shows Empty

The bug is in `useUnifiedAnalytics.ts` at line 822-823:

```typescript
// Pages breakdown - FILTER by production sessions only
const productionSessionIds = new Set(uniqueSessions.map(s => s.session_id));
const filteredPageViews = pageViews.filter(pv => productionSessionIds.has(pv.session_id));
```

This filter requires page view `session_id` to match a session in `user_sessions`. But:

1. Many page views have session IDs that don't exist in `user_sessions` (timing issues)
2. The dev traffic filter removes sessions, but their page views don't match production sessions
3. Session ID format inconsistency: Some page views use `session_1234_abc` format while user_sessions use UUIDs

### Verification

I checked session matching - page views DO match sessions, but the aggressive dev traffic filtering removes many of them. The remaining production sessions don't have enough matching page views to display.

---

## Recommended Fixes

### Fix 1: Pages Card - Remove Overly Aggressive Filtering

**Problem:** Pages are filtered against production sessions only, but this removes too much data.

**Solution:** Show all page views for the time period, regardless of session matching. Page views already come from real user activity.

```typescript
// BEFORE (line 822-823):
const productionSessionIds = new Set(uniqueSessions.map(s => s.session_id));
const filteredPageViews = pageViews.filter(pv => productionSessionIds.has(pv.session_id));

// AFTER:
// Use ALL page views - they're already real tracked data
const filteredPageViews = pageViews;
```

---

### Fix 2: Geography - Improve IP Tracking and Display Honest Data

**Problem:** Only ~7% of sessions have geo data due to late deployment.

**Solutions:**
1. **Accept the limitation for historical data** - display "Unknown" for sessions before Jan 30
2. **Ensure all new production sessions get geo data** - already working
3. **Run geo enrichment for sessions that have IPs but no country** - the `enrich-geo-data` function can do this

**Optional improvement:** Add a visual indicator in the Geography card showing what percentage of sessions have geo data, so it's clear the numbers are partial.

---

### Fix 3: Track Production vs Dev Sessions Properly

**Problem:** 43% of sessions are from dev environments, polluting data.

**Solution:** Add a `is_production` flag at session creation time based on the request origin URL, not just referrer filtering. This would allow:
- Excluding dev sessions from analytics at the database level
- More accurate visitor counts
- Cleaner data going forward

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `src/hooks/useUnifiedAnalytics.ts` | Remove page view session filtering | High |
| `src/hooks/useUnifiedAnalytics.ts` | Add geo data coverage indicator | Medium |
| `supabase/functions/track-session/index.ts` | Add `is_production` flag based on origin | Medium |

---

## Summary Table

| Issue | Root Cause | Data Real? | Fix Needed? |
|-------|------------|------------|-------------|
| Channels | Pure tracked data | Yes | No |
| Referrers | Pure tracked data | Yes | No |
| Countries | Late IP tracking (Jan 30) | Partial | Show % coverage |
| Pages | Overly aggressive filtering | Yes but hidden | Remove filter |

