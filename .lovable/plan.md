

# Complete Data Integrity Investigation: Findings and Fix Plan

## Executive Summary

I've conducted a comprehensive investigation into your analytics data quality. Here are the critical findings:

---

## Critical Data Quality Issues Found

### Issue 1: Massive Data Gaps in Historical Sessions

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Production Sessions (2026) | 1,254 | 100% |
| Sessions with Country Data | 109 | **8.7%** |
| Sessions with Browser Data | 292 | **23.3%** |
| Sessions from USA | 14 | Very low |

**Root Cause:** Country/geo data only started being captured on January 30, 2026. Before that date, the edge function was not receiving real IP addresses (likely due to proxy configuration or the function not being deployed).

### Issue 2: Orphan Sessions with No Metadata

There are 257 sessions created with `session_*` format IDs that have:
- NO browser data
- NO country data  
- NO IP address
- These are primarily dev traffic from Lovable but some are production

**Root Cause:** These sessions come from a legacy code path or are being created via a direct database trigger when page_views are inserted, bypassing the edge function entirely.

### Issue 3: Dev Traffic Polluting Data

| Traffic Type | Sessions (Last 5 days) |
|--------------|------------------------|
| Lovable Dev Traffic | 241 (59%) |
| Production Traffic | 170 (41%) |

Almost 60% of recent sessions are from development/preview environments, polluting your analytics.

---

## Why Country Data Shows Europe (Not USA)

Your country data is NOT fake - but it's only from the last ~4 days (since Jan 30). During this period:
- France: 40 sessions
- Netherlands: 31 sessions  
- UK: 20 sessions
- USA: 14 sessions
- Spain: 8 sessions
- Hungary: 6 sessions

The reason you see more Europe than USA is:
1. **Geo tracking only started Jan 30** - most historical US signups happened before this
2. **Development traffic from Lovable** (likely EU-based servers) is included
3. **Cloudflare IPs** - some visitors show ISP as "Cloudflare, Inc." (Amsterdam data centers)

---

## What Data IS Real vs Fake

### Real Data (Accurate)
1. **Browser/OS** - Parsed from user-agent on frontend, sent to edge function
2. **Referrer** - Captured from `document.referrer` in browser
3. **UTM Parameters** - Captured from URL on page load
4. **Self-reported referral_source** - Users' answers to "How did you hear about us?"
5. **Session timestamps** - Real timestamps from when sessions were created
6. **Geo data (since Jan 30)** - Real IP geolocation from ip-api.com

### Data Gaps (Not Fake, Just Missing)
1. **Geo data before Jan 30** - No IP geolocation was captured
2. **Sessions without browser data** - Created via legacy code path
3. **original_external_referrer** - Empty until you add the blog script

---

## The Script for sourcecodeals.com - Is It Complete?

The script I provided is **correct and complete** for capturing original referrer. Here it is again with minor improvements:

```javascript
(function() {
  // Capture original referrer on first visit to ANY page on sourcecodeals.com
  if (!localStorage.getItem('sco_original_referrer')) {
    localStorage.setItem('sco_original_referrer', document.referrer || '');
    localStorage.setItem('sco_landing_page', window.location.pathname);
    localStorage.setItem('sco_landing_time', new Date().toISOString());
  }

  // Intercept ALL clicks on marketplace links (works for dynamically added links too)
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href*="marketplace.sourcecodeals.com"]');
    if (link) {
      try {
        const url = new URL(link.href);
        const originalRef = localStorage.getItem('sco_original_referrer');
        const landingPage = localStorage.getItem('sco_landing_page');
        
        // Only add if not already present (preserve existing UTMs)
        if (originalRef && !url.searchParams.has('original_referrer')) {
          url.searchParams.set('original_referrer', originalRef);
        }
        if (landingPage && !url.searchParams.has('blog_landing')) {
          url.searchParams.set('blog_landing', landingPage);
        }
        
        link.href = url.toString();
      } catch (err) {
        console.warn('Attribution tracking error:', err);
      }
    }
  }, true);
})();
```

**Where to add:** In the `<head>` tag of every page on sourcecodeals.com (homepage, blog, all paths).

---

## Fixes Required

### Fix 1: Filter Dev Traffic in Analytics (Code Change)

Update `useUnifiedAnalytics.ts` to exclude sessions with Lovable/localhost referrers:

```typescript
// Add to session filtering
const productionSessions = rawSessions.filter(s => {
  if (!s.referrer) return true;
  const ref = s.referrer.toLowerCase();
  return !ref.includes('lovable') && !ref.includes('localhost');
});
```

### Fix 2: Run Geo Backfill for Missing Sessions

You have an existing `enrich-geo-data` edge function. Run it to backfill geo data for sessions that have IP addresses but no country:

```
POST /functions/v1/enrich-geo-data
{ "batchSize": 45, "maxBatches": 20 }
```

However, sessions with NULL IP addresses cannot be backfilled.

### Fix 3: Run Browser Backfill for Missing Sessions

You have an existing `enrich-session-metadata` edge function to parse user-agent strings:

```
POST /functions/v1/enrich-session-metadata
{ "batchSize": 100, "maxBatches": 20 }
```

### Fix 4: Stop Creating Orphan Sessions

Investigate why sessions with `session_*` format are being created without going through the edge function. This may be a database trigger or legacy frontend code that wasn't fully migrated.

---

## Going Forward: Ensuring 100% Real Data

### For Channels/Referrers

| Data Source | Priority | Accuracy |
|-------------|----------|----------|
| `original_external_referrer` | 1 | Technical (requires blog script) |
| `profiles.referral_source` | 2 | User-reported (real but self-reported) |
| `user_sessions.referrer` | 3 | Technical (immediate referrer only) |

**Current state:** Using priority 2 (user-reported) as fallback since priority 1 is empty.

**Going forward:** Once you add the blog script, priority 1 will populate and override user-reported data with technical tracking.

### For Geography

All geo data is **real** - derived from IP geolocation via ip-api.com. The issue is:
- Only captured since Jan 30, 2026
- Some sessions have private/missing IPs (cannot be enriched)

### For Browsers/OS/Devices

All browser data is **real** - parsed from navigator.userAgent in the browser. Sessions missing this data were created via a code path that bypassed the frontend.

### For Funnels/Journeys

All funnel data is **real** - based on actual page views, signups, and connection requests with real timestamps.

---

## Summary of Required Actions

| Action | Type | Impact |
|--------|------|--------|
| Add blog script to sourcecodeals.com | External | Enables original referrer tracking |
| Filter dev traffic in analytics | Code change | Removes ~60% noise from data |
| Run geo enrichment | One-time | Backfills missing country data |
| Run browser enrichment | One-time | Backfills missing browser data |
| Investigate orphan sessions | Investigation | Prevents future incomplete data |

---

## Historical Data Reality

**Cannot be perfectly reconstructed:**
- Original referrer (Google/LinkedIn before blog) - never captured
- Geo data for sessions without IP - cannot be enriched

**Can be partially improved:**
- Geo data for sessions WITH IP addresses - run enrichment function
- Browser data for sessions WITH user_agent - run enrichment function

For truly accurate attribution going forward, the blog script is essential. Without it, you'll continue seeing `sourcecodeals.com` as the "referrer" instead of the true original source (Google, LinkedIn, etc.).

