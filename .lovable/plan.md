

# Analytics Dashboard Enhancement: Cross-Domain Entry Pages & Improved Attribution Display

## Overview

This plan addresses the gap in visualizing cross-domain user journeys, specifically showing blog entry pages (like `/blog/deal-sourcing-companies`) that currently aren't visible in the Pages card despite being captured in the database.

## Current State vs. Desired State

| Feature | Current | Proposed |
|---------|---------|----------|
| Pages Card | Shows only marketplace `page_views` | Add "Blog Entry" tab showing cross-domain paths |
| Entry Pages | Shows `/signup`, `/welcome`, etc. | Include blog paths when cross-domain data exists |
| Referrer Filtering | Shows visitors/signups/connections | Also updates entry pages to show that referrer's landing pages |
| Discovery Path | Shown in User Detail only | Surfaced in aggregate in Pages card |

## Technical Implementation

### Phase 1: Add Blog Entry Pages to Data Hook

**File: `src/hooks/useUnifiedAnalytics.ts`**

Add new data structure for blog landing pages:

```text
// New: Aggregate blog_landing_page data from user_sessions
const blogEntryPages: Record<string, { visitors: Set<string>; sessions: number }> = {};

uniqueSessions.forEach(s => {
  if (s.blog_landing_page) {
    const path = `sourcecodeals.com${s.blog_landing_page}`;
    if (!blogEntryPages[path]) {
      blogEntryPages[path] = { visitors: new Set(), sessions: 0 };
    }
    const visitorKey = getVisitorKey(s);
    if (visitorKey) blogEntryPages[path].visitors.add(visitorKey);
    blogEntryPages[path].sessions++;
  }
});
```

Update return type to include:
```text
blogEntryPages: Array<{ path: string; visitors: number; isExternal: boolean }>;
```

---

### Phase 2: Update PagesCard Component

**File: `src/components/admin/analytics/datafast/PagesCard.tsx`**

Add new "Blog Entry" tab to show cross-domain paths:

```text
const tabs = [
  { id: 'page', label: 'Page' },
  { id: 'entry', label: 'Entry page' },
  { id: 'blog', label: 'Blog Entry' },  // NEW
  { id: 'exit', label: 'Exit page' },
];
```

Render blog entry pages with external indicator:
```text
{activeTab === 'blog' && (
  <>
    {blogEntryPages.map((page) => (
      <ProportionalBar value={page.visitors} maxValue={maxBlogVisitors}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <code className="text-xs font-mono truncate">
              {page.path}
            </code>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {page.visitors}
          </span>
        </div>
      </ProportionalBar>
    ))}
  </>
)}
```

---

### Phase 3: Add Hostname Tab (Optional, Datafast-style)

Add "Hostname" tab to show traffic distribution by domain:

| Hostname | Visitors |
|----------|----------|
| marketplace.sourcecodeals.com | 1,523 |
| sourcecodeals.com (blog entry) | 7 |

---

### Phase 4: Enhance Filter Propagation

When a referrer filter is active (e.g., "Google"), ensure the Entry Pages tab shows:
- Which pages Google visitors actually landed on
- Includes both marketplace entry (`/signup`) and blog paths if they came through the blog

**File: `src/hooks/useUnifiedAnalytics.ts`**

Update entry page calculation to be filter-aware:
```text
// When filters are active, recalculate entry pages from filtered sessions
const filteredEntryPages = calculateEntryPages(
  filteredPageViews, 
  uniqueSessions // Already filtered by referrer/channel
);
```

---

## Data Flow Diagram

```text
User Journey:
┌─────────────────┐     ┌─────────────────────────────┐     ┌──────────────────┐
│  Google Search  │ ──► │  sourcecodeals.com/blog/... │ ──► │  marketplace/    │
└─────────────────┘     └─────────────────────────────┘     │   - /signup      │
                                    │                        │   - /welcome     │
                                    ▼                        └──────────────────┘
                        user_sessions captures:                      │
                        • original_external_referrer: google.com     ▼
                        • blog_landing_page: /blog/...         page_views captures:
                        • first_touch_landing_page: /signup    • page_path: /signup
                                                               • page_path: /marketplace
```

---

## Interface Types Update

**File: `src/hooks/useUnifiedAnalytics.ts`**

```text
interface UnifiedAnalyticsData {
  // ... existing fields
  
  // NEW: Blog/external entry pages
  blogEntryPages: Array<{
    path: string;           // e.g., "sourcecodeals.com/blog/deal-sourcing"
    visitors: number;
    sessions: number;
    originalReferrer?: string;  // e.g., "google.com"
  }>;
}
```

---

## Props Update for PagesCard

**File: `src/components/admin/analytics/datafast/PagesCard.tsx`**

```text
interface PagesCardProps {
  topPages: Array<{ path: string; visitors: number; avgTime: number; bounceRate: number }>;
  entryPages: Array<{ path: string; visitors: number; bounceRate: number }>;
  exitPages: Array<{ path: string; exits: number; exitRate: number }>;
  blogEntryPages: Array<{ path: string; visitors: number; sessions: number }>;  // NEW
}
```

---

## Dashboard Integration

**File: `src/components/admin/analytics/datafast/DatafastAnalyticsDashboard.tsx`**

Pass the new data to PagesCard:
```text
<PagesCard 
  topPages={data.topPages}
  entryPages={data.entryPages}
  exitPages={data.exitPages}
  blogEntryPages={data.blogEntryPages}  // NEW
/>
```

---

## Expected Results

### Before
- Pages card only shows: `/`, `/signup`, `/welcome`, `/marketplace`
- No visibility into blog paths that drive traffic

### After
- New "Blog Entry" tab shows: `sourcecodeals.com/blog/deal-sourcing-companies`, `sourcecodeals.com/marketplace`, etc.
- When filtering by Google, entry pages update to show which pages Google visitors landed on
- Full cross-domain journey is visible in aggregate form

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Add `blogEntryPages` aggregation and return field |
| `src/components/admin/analytics/datafast/PagesCard.tsx` | Add "Blog Entry" tab with external path display |
| `src/components/admin/analytics/datafast/DatafastAnalyticsDashboard.tsx` | Pass `blogEntryPages` prop |

---

## Summary

This enhancement surfaces the cross-domain journey data that's already being captured, making it visible in the Pages card alongside marketplace pages. The "Blog Entry" tab will show exactly which main site pages (blog posts, /marketplace, /our-team, etc.) are driving traffic to the marketplace, providing actionable content performance insights.

