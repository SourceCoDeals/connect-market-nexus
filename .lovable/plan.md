

# Fix Attribution Mismatch: Channel vs Referrer

## Problem Identified

Based on my deep investigation, here's the core issue:

**The Channel tab shows 0 signups for Organic Search, but the Referrer tab shows 21 signups for "sourcecodeals".**

This is because:

1. **Channel categorization** uses a function `categorizeChannel()` that checks the referrer for specific patterns
2. When referrer is `www.sourcecodeals.com`, it gets categorized as **"Referral"** (not "Organic Search")
3. So all those 21 signups from your blog are correctly showing as "Referral" in the Channel tab

The **technical truth** is: their immediate referrer to the marketplace WAS sourcecodeals.com (your blog). Google was the referrer TO the blog, not to the marketplace.

---

## Database Reality (Last 30 Days)

| Metric | Value |
|--------|-------|
| Total sessions | 2,038 |
| Sessions from Google directly | 11 |
| Sessions from sourcecodeals.com (blog) | 169 |
| Total signups | 33 |
| Signups with first session from blog | 21 |
| Signups with first session direct/null | 7 |
| Signups self-reporting "Google" | 15 |

The 21 signups ARE going to "Referral" in Channel (from blog), and 21 signups to "sourcecodeals" in Referrer - that's consistent and correct.

---

## Why "Organic Search" Shows 1 Signup

`categorizeChannel()` only returns "Organic Search" when the referrer contains `google`, `bing`, `duckduckgo`, or `brave`. 

Of your 33 signups:
- 21 came via `www.sourcecodeals.com` (blog) → "Referral"
- 7 came with no referrer → "Direct"  
- 1 came directly from `www.google.com` → "Organic Search"
- 4 scattered among other sources

This is **technically correct** but not what you want to see.

---

## The Fix Required

To show the "true" discovery source (Google search that led to blog that led to marketplace), we need to:

### Phase 1: Website-Side Tracking (Required)

Add JavaScript to `sourcecodeals.com` (entire site, not just blog) that:
1. Captures `document.referrer` on first page load
2. Stores it in localStorage
3. Appends it to marketplace links as URL parameters

### Phase 2: Marketplace Capture (Already Implemented)

The `track-session` edge function already looks for `original_referrer` and `blog_landing` URL params - it just never receives them because the website doesn't send them.

### Phase 3: Display Logic Update

Update `useUnifiedAnalytics.ts` to:
1. Check `original_external_referrer` first (if blog passes it)
2. Fall back to regular `referrer` if not available

---

## Implementation Details

### Step 1: JavaScript for sourcecodeals.com

Add this script to the entire sourcecodeals.com website (all pages, in the `<head>` tag):

```javascript
(function() {
  // Only capture on first visit to this domain
  if (!localStorage.getItem('sco_original_referrer')) {
    localStorage.setItem('sco_original_referrer', document.referrer || '');
    localStorage.setItem('sco_landing_page', window.location.pathname);
  }

  // Intercept clicks on marketplace links
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href*="marketplace.sourcecodeals.com"]');
    if (link) {
      try {
        const url = new URL(link.href);
        const originalRef = localStorage.getItem('sco_original_referrer');
        const landingPage = localStorage.getItem('sco_landing_page');
        if (originalRef) url.searchParams.set('original_referrer', originalRef);
        if (landingPage) url.searchParams.set('blog_landing', landingPage);
        link.href = url.toString();
      } catch (err) {
        console.warn('Attribution tracking error:', err);
      }
    }
  }, true);
})();
```

This works for entire sourcecodeals.com including blog, homepage, and any other pages.

### Step 2: Capture in Marketplace (Already Done)

The `track-session` edge function already captures these parameters:

```typescript
// Lines 155-157 in track-session/index.ts
original_external_referrer: body.original_referrer || null,
blog_landing_page: body.blog_landing || null,
```

But the frontend needs to extract them from URL params and send them.

### Step 3: Update Frontend Tracking

Modify `src/hooks/use-initial-session-tracking.ts` to extract URL params:

```typescript
// Add to trackingData object
const searchParams = new URLSearchParams(window.location.search);
const originalReferrer = searchParams.get('original_referrer');
const blogLanding = searchParams.get('blog_landing');

const trackingData = {
  // ... existing fields
  original_referrer: originalReferrer || undefined,
  blog_landing: blogLanding || undefined,
};
```

### Step 4: Update Channel Categorization for Signups

Modify `useUnifiedAnalytics.ts` to use `original_external_referrer` when attributing signups:

```typescript
// When mapping signups to channels (line ~491-496)
profiles.forEach(p => {
  const firstSession = profileToFirstSession.get(p.id);
  if (firstSession) {
    // Use original_external_referrer if available, otherwise fall back to referrer
    const effectiveReferrer = (firstSession as any).original_external_referrer || firstSession.referrer;
    const channel = categorizeChannel(effectiveReferrer, firstSession.utm_source, firstSession.utm_medium);
    channelSignups[channel] = (channelSignups[channel] || 0) + 1;
  }
});
```

Also update the first sessions query to include `original_external_referrer`:

```typescript
const { data: firstSessionsData } = await supabase
  .from('user_sessions')
  .select('..., original_external_referrer, blog_landing_page')
  .in('user_id', profileIds)
  .order('started_at', { ascending: true });
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/use-initial-session-tracking.ts` | Extract `original_referrer` and `blog_landing` from URL params |
| `src/hooks/useUnifiedAnalytics.ts` | Include `original_external_referrer` in first session query; use it for channel categorization when attributing signups |
| **External: sourcecodeals.com** | Add the JavaScript snippet to capture and pass original referrer |

---

## What This Will Achieve

### Before (Current State)
| Channel | Signups |
|---------|---------|
| Referral | 21 |
| Direct | 7 |
| Organic Search | 1 |

### After (With Website Script Deployed)
| Channel | Signups |
|---------|---------|
| Organic Search | ~15 (users who came via Google to blog) |
| Organic Social | ~4 (users who came via LinkedIn to blog) |
| Direct | ~10 (users who typed URL or no referrer) |
| Referral | ~4 (other referrers) |

---

## Historical Data Limitation

The `original_external_referrer` column is currently empty for all existing sessions because the sourcecodeals.com website hasn't been passing the data. 

**For historical accuracy**, we cannot backfill this automatically - it would require guessing. The fix will only work for **new visitors going forward** after you add the script to sourcecodeals.com.

---

## Summary

The current data is **technically correct** - it's showing the immediate referrer to the marketplace. To see the "true" discovery source (Google → Blog → Marketplace), you need to add the JavaScript snippet to sourcecodeals.com to pass the original referrer across domains.

I'll implement the marketplace-side changes (Steps 2-4) now. You'll need to add the JavaScript snippet (Step 1) to your website for the full solution to work.

