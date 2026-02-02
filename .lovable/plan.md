
# Fix Attribution Data Accuracy: Complete Investigation & Implementation Plan

## Executive Summary

I've conducted a deep investigation and identified the **root cause** of the fake data problem. The fix is straightforward but requires multiple coordinated changes.

---

## Root Cause Analysis

### The Bug: Profiles Query Without Date Filter

**Location:** `src/hooks/useUnifiedAnalytics.ts` lines 241-244

```typescript
// CURRENT CODE (BROKEN)
supabase
  .from('profiles')
  .select('id, first_name, last_name, company, buyer_type, referral_source, referral_source_detail, created_at')
  .limit(500)  // ← NO DATE FILTER! Fetches ALL 500+ profiles
```

**What happens:**
1. Code fetches 500 random profiles (not filtered by date)
2. Code fetches sessions from LAST 30 DAYS only
3. Code maps "signups" to first session found in 30-day window
4. **Result:** Old users visiting via newsletter are counted as "newsletter signups"

### Proof from Database

| Metric | Wrong Value (UI) | Correct Value (DB) |
|--------|------------------|-------------------|
| Newsletter signups | 25 | **0** |
| Blog/Website signups | Unknown | **22** |
| Direct signups | Unknown | **11** |
| Total 30-day signups | 50 | **33** |

### Example of the Bug

- **User:** Nathaniel Kostiw-Gill
- **Signup date:** August 2025 (5 months ago)
- **Recent visit:** January 29, 2026 via Brevo newsletter
- **Bug:** Counted as "Newsletter signup" because his first 30-day session was via Brevo

---

## The Real Data (What We Should See)

### Signups by Technical Referrer (Last 30 Days)
| Channel | Signups |
|---------|---------|
| Blog/Website (sourcecodeals.com) | 22 |
| Direct (no referrer) | 11 |
| Newsletter | 0 |
| Google Direct | 0 |
| LinkedIn Direct | 0 |

### Self-Reported vs Tracked Attribution
| Self-Reported | Tracked Referrer | Count |
|---------------|------------------|-------|
| Google | Blog/Website | 11 |
| Google | Direct | 4 |
| LinkedIn | Blog/Website | 4 |
| LinkedIn | Direct | 2 |
| Friend | Blog/Website | 3 |
| Other | Blog/Website | 3 |
| AI | Direct | 1 |

### Key Insight
When users say "Google", their tracked referrer is `sourcecodeals.com` (the blog), confirming the journey:
```
Google Search → Blog → Marketplace → Signup
```

---

## Implementation Plan

### Phase 1: Fix the Core Bug (CRITICAL)

**File:** `src/hooks/useUnifiedAnalytics.ts`

**Change 1:** Add date filter to profiles query (line 241-244)
```typescript
// BEFORE (broken)
supabase
  .from('profiles')
  .select('id, first_name, last_name, company, buyer_type, referral_source, referral_source_detail, created_at')
  .limit(500)

// AFTER (fixed)
supabase
  .from('profiles')
  .select('id, first_name, last_name, company, buyer_type, referral_source, referral_source_detail, created_at')
  .gte('created_at', startDateStr)  // ← Only signups in time range
```

**Change 2:** Use ALL sessions (not just 30-day) for first-session lookup

Currently, `profileToFirstSession` is built from `rawSessions` (30-day filtered). This means we can't find the true first session for users who signed up in the last 30 days but had their first session earlier.

```typescript
// Add separate query for first-ever sessions
const firstSessionsResult = await supabase
  .from('user_sessions')
  .select('user_id, referrer, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, started_at')
  .in('user_id', profileIds)  // Only for users we care about
  .order('started_at', { ascending: true });
```

### Phase 2: Remove Self-Reported Tab

**File:** `src/components/admin/analytics/datafast/SourcesCard.tsx`

Remove the "Source" tab (lines 92, 210-270) since we only want tracked data:

```typescript
// Remove this tab
{ id: 'source', label: 'Source' }, // DELETE

// Remove the entire activeTab === 'source' block (lines 210-270)
```

### Phase 3: Add KPI for Total Signups

**File:** `src/hooks/useUnifiedAnalytics.ts`

Add signup count to KPIs:
```typescript
kpis: {
  visitors: KPIMetric;
  sessions: KPIMetric;
  signups: KPIMetric;  // NEW
  connections: KPIMetric;
  // ...
}
```

### Phase 4: Populate Original Source Data (Future-Proofing)

**File:** `src/contexts/SessionContext.tsx` or auth callback

After successful signup, copy self-reported data to session:
```typescript
// After user signs up and provides referral_source
await supabase
  .from('user_sessions')
  .update({
    original_source: profile.referral_source,
    original_keyword: profile.referral_source_detail,
  })
  .eq('user_id', userId);
```

### Phase 5: Cross-Domain Tracking (External Work)

**This requires changes to sourcecodeals.com (external)**

Add JavaScript to blog pages:
```javascript
// On blog load, capture original referrer
if (!localStorage.getItem('sco_original_referrer')) {
  localStorage.setItem('sco_original_referrer', document.referrer);
  localStorage.setItem('sco_landing_page', window.location.pathname);
}

// When clicking marketplace links, append params
document.querySelectorAll('a[href*="marketplace.sourcecodeals.com"]').forEach(link => {
  const url = new URL(link.href);
  const originalRef = localStorage.getItem('sco_original_referrer');
  if (originalRef) url.searchParams.set('original_referrer', originalRef);
  url.searchParams.set('blog_landing', localStorage.getItem('sco_landing_page') || window.location.pathname);
  link.href = url.toString();
});
```

**In marketplace**, capture these params:
```typescript
// In track-session edge function
const originalReferrer = searchParams.get('original_referrer');
const blogLanding = searchParams.get('blog_landing');

// Store in session
if (originalReferrer) {
  await supabase.from('user_sessions').update({
    original_external_referrer: originalReferrer,
    blog_landing_page: blogLanding,
  }).eq('session_id', sessionId);
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Fix profiles date filter, improve first-session lookup |
| `src/components/admin/analytics/datafast/SourcesCard.tsx` | Remove "Source" tab |
| `src/contexts/SessionContext.tsx` | Copy self-reported to session on signup |
| `supabase/functions/track-session/index.ts` | Capture original_referrer from URL params |

---

## Expected Results After Fix

| Metric | Before (Wrong) | After (Correct) |
|--------|----------------|-----------------|
| Newsletter signups | 25 | 0 |
| Blog/Website signups | ? | 22 |
| Direct signups | ? | 11 |
| Total signups | 50 | 33 |
| Google in Channel | 0 | 0 (until cross-domain fix) |
| Organic Search | 0 | 0 (until cross-domain fix) |

---

## Technical Notes

### Why Google Shows 0 Signups (Even After Fix)

Users who searched Google and landed on the blog have `sourcecodeals.com` as their referrer, not `google.com`. This is correct technical tracking - we see the **immediate** referrer, not the original source.

To see Google as a source, you need:
1. Cross-domain tracking (Phase 5) - requires blog changes
2. OR use the self-reported data as a supplementary view

### The "Original Referrer" vs "Session Referrer" Distinction

- **Session Referrer:** What technically sent them to marketplace (usually blog)
- **Original Referrer:** What sent them to the blog (Google, LinkedIn, etc.)
- **Self-Reported:** What users say when asked "How did you hear about us?"

Currently, we only have Session Referrer in tracked data. To get Original Referrer, we need the cross-domain tracking script on the blog.

---

## Summary

The immediate fix is simple: **add a date filter to the profiles query**. This will show correct data within hours.

The deeper fix (seeing Google → Blog → Marketplace journey) requires external changes to the blog site to pass the original referrer across domains.
