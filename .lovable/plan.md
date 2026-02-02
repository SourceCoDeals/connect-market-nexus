
# Fix Attribution Data Accuracy: Implementation Complete

## Summary

All critical bugs have been fixed:

### ✅ Fixed: Profiles Query Date Filter (CRITICAL)
**Location:** `src/hooks/useUnifiedAnalytics.ts`

- Added `.gte('created_at', startDateStr)` to profiles query
- Now only fetches signups from the selected time range (not all 500+ profiles)
- Fetches first-ever sessions separately for accurate signup attribution

### ✅ Removed: Self-Reported "Source" Tab
**Location:** `src/components/admin/analytics/datafast/SourcesCard.tsx`

- Removed the "Source" tab that showed self-reported data
- Only tracked data (Channel, Referrer, Campaign, Keyword) now displayed

### ✅ Updated: Cross-Domain Tracking Ready
**Location:** `supabase/functions/track-session/index.ts`

- Added capture of `original_referrer` and `blog_landing` URL params
- Stores in `original_external_referrer` and `blog_landing_page` columns

---

## What's Left (External Blog Changes)

To see the full journey (Google → Blog → Marketplace), add this JavaScript to sourcecodeals.com:

```javascript
// On blog pages - add to head or before closing body tag
(function() {
  // Capture original referrer on first visit
  if (!localStorage.getItem('sco_original_referrer')) {
    localStorage.setItem('sco_original_referrer', document.referrer || '');
    localStorage.setItem('sco_landing_page', window.location.pathname);
  }

  // Append to all marketplace links
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

---

## Expected Results

| Metric | Before (Wrong) | After (Correct) |
|--------|----------------|-----------------|
| Newsletter signups | 25 | 0 |
| Blog/Website signups | ? | ~22 |
| Direct signups | ? | ~11 |
| Total signups in 30 days | 50+ | ~33 |

---

## Technical Details

### Why Google Still Shows 0 Signups
Users who searched Google landed on the blog first. Their tracked referrer is `sourcecodeals.com`, not `google.com`. This is technically correct - the blog is the immediate referrer to the marketplace.

To see Google as a source, the blog must pass `original_referrer=google.com` when linking to marketplace (see script above).

### Columns Available for Future Use
- `original_source` - For self-reported source (future sync from profiles)
- `original_keyword` - For self-reported keywords
- `original_external_referrer` - For blog-passed original referrer
- `blog_landing_page` - For which blog page they came from
