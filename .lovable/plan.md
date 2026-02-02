
# Complete Attribution Intelligence: Signups, Original Referrer & Full Journey Tracking

## Executive Summary

You want to see the **complete acquisition funnel**: from the moment someone first discovers you (Google search, LinkedIn post, newsletter) → through the blog → to marketplace signup → approval → connection request. This requires:

1. **Adding "Signups" as a third sort metric** alongside Visitors and Connections
2. **Tracking the ORIGINAL referrer** (before blog) - not just the immediate referrer (blog)
3. **Multi-touch attribution** showing initial source vs. converting source

---

## Current Data Reality (What We Have Today)

### Self-Reported Attribution (profiles table)
| Source | Signups | Keywords Used |
|--------|---------|---------------|
| Google | 15 | "M&A deal sourcing", "deal originators buyside", "Search fund business acquisition" |
| LinkedIn | 7 | "Tomos Mughan", "Post", "Saw a post about European deal flow" |
| Friend | 4 | "Tomos Mughan", "Alex Josowitz" |
| AI | 2 | "ChatGPT", "Perplexity.ai" |
| Other | 3 | "Road to Carry Newsletter" |

### Tracked Referrers (user_sessions table)
| Entry Point | Signups | Connections |
|-------------|---------|-------------|
| sourcecodeals.com (blog) | 38 | 23 |
| Direct (no referrer) | 58 | 35 |
| Newsletter (Brevo) | 2 | 16 |
| Google.com direct | 1 | 0 |
| LinkedIn.com direct | 0 | 1 |

### The Gap
When a user says "Google" but their session referrer is `www.sourcecodeals.com`, the journey was:
```
Google → Blog (sourcecodeals.com/blog/deal-sourcing-companies) → Marketplace → Signup
```

We capture the self-reported "Google" but **lose the original referrer** at the blog-to-marketplace handoff because the blog doesn't pass UTM parameters.

---

## Solution Architecture

### Strategy 1: Enhanced Cross-Domain Tracking (Recommended)

The main website (sourcecodeals.com) needs to pass attribution data when linking to marketplace. This is an **external website change** but the most accurate solution.

**On sourcecodeals.com, links to marketplace should include:**
```html
<a href="https://marketplace.sourcecodeals.com?
  utm_source=blog
  &utm_medium=organic
  &original_referrer=google.com
  &landing_page=/blog/deal-sourcing-companies
">Go to Marketplace</a>
```

**Implementation:** JavaScript on the blog that captures `document.referrer` and appends it to marketplace links.

### Strategy 2: Self-Reported + Session Correlation (What We Can Do Now)

Combine the self-reported `referral_source` and `referral_source_detail` from profiles with session data to build a complete picture.

**New Data Model:**
```
profiles.referral_source = "google"
profiles.referral_source_detail = "M&A deal sourcing"
user_sessions.referrer = "www.sourcecodeals.com"
```

**Derived Attribution:**
- **Original Source:** Google (self-reported)
- **Search Keyword:** "M&A deal sourcing"
- **Entry Path:** Blog → Marketplace
- **Connection Source:** Newsletter (Brevo)

---

## Implementation Plan

### Phase 1: Add "Signups" to All Cards

**Files to modify:**
- `src/components/admin/analytics/datafast/AnalyticsCard.tsx`
- `src/components/admin/analytics/datafast/SourcesCard.tsx`
- `src/components/admin/analytics/datafast/GeographyCard.tsx`
- `src/components/admin/analytics/datafast/TechStackCard.tsx`
- `src/hooks/useUnifiedAnalytics.ts`

**Changes:**

1. Update `SortToggle` to support 3 values:
```typescript
type SortValue = 'visitors' | 'signups' | 'connections';

export function SortToggle({ value, onChange }: { value: SortValue; onChange: (v: SortValue) => void }) {
  const cycle = () => {
    if (value === 'visitors') onChange('signups');
    else if (value === 'signups') onChange('connections');
    else onChange('visitors');
  };
  return (
    <button onClick={cycle}>
      {value === 'visitors' ? 'Visitors ↓' : value === 'signups' ? 'Signups ↓' : 'Connections ↓'}
    </button>
  );
}
```

2. Add signup counts to all data structures in `useUnifiedAnalytics.ts`:
```typescript
// New query to get signups
supabase
  .from('profiles')
  .select('id, referral_source, referral_source_detail, created_at')
  .gte('created_at', startDateStr)
```

3. Calculate signups per referrer/channel/country:
```typescript
const referrerSignups: Record<string, number> = {};
const channelSignups: Record<string, number> = {};
const countrySignups: Record<string, number> = {};

// For each profile signup, find their first session and attribute
profiles.forEach(p => {
  const firstSession = sessions.find(s => s.user_id === p.id);
  if (firstSession?.referrer) {
    const domain = extractDomain(firstSession.referrer);
    referrerSignups[domain] = (referrerSignups[domain] || 0) + 1;
  }
  
  // Also use self-reported source for "original referrer"
  if (p.referral_source) {
    channelSignups[p.referral_source] = (channelSignups[p.referral_source] || 0) + 1;
  }
});
```

### Phase 2: Add "Original Referrer" Field

Store and display the user's true first-touch source (Google, LinkedIn, ChatGPT) separately from their immediate referrer (blog, newsletter).

**Database changes:**
Add new columns to `user_sessions` table:
```sql
ALTER TABLE user_sessions ADD COLUMN original_source text;
ALTER TABLE user_sessions ADD COLUMN original_keyword text;
```

**Populate from profiles:**
```typescript
// When creating/updating session after signup, copy from profile
await supabase
  .from('user_sessions')
  .update({
    original_source: profile.referral_source,
    original_keyword: profile.referral_source_detail,
  })
  .eq('user_id', userId);
```

### Phase 3: Dual Attribution Display

In the SourcesCard, show BOTH:
1. **Original Source** (self-reported): Google, LinkedIn, Friend, AI
2. **Entry Referrer** (tracked): sourcecodeals.com, newsletter, direct

**New tab structure:**
```
| Channel | Source | Referrer | Campaign | Keyword |
```

**Channel tab content:**
```
┌────────────────────────────────────────────────┐
│ Original Source (Self-Reported)                │
├────────────────────────────────────────────────┤
│ 🔍 Google     │ 15 signups │ 8 connections     │
│ 🔗 LinkedIn   │ 7 signups  │ 3 connections     │
│ 🤖 AI         │ 2 signups  │ 1 connection      │
│ 👤 Friend     │ 4 signups  │ 2 connections     │
└────────────────────────────────────────────────┘
```

**Referrer tab content:**
```
┌────────────────────────────────────────────────┐
│ Entry Referrer (Technical Tracking)            │
├────────────────────────────────────────────────┤
│ 🌐 sourcecodeals.com │ 38 signups │ 23 conn.  │
│ 📧 Newsletter        │ 2 signups  │ 16 conn.  │
│ 🔵 LinkedIn.com      │ 0 signups  │ 1 conn.   │
│ 📍 Direct            │ 58 signups │ 35 conn.  │
└────────────────────────────────────────────────┘
```

### Phase 4: Journey Path Visualization

Add a new "Funnel Paths" section showing the complete journey:

```
Google Search → Blog → Marketplace → Signup → Connection
  └─ "M&A deal sourcing" (keyword)
  └─ /blog/deal-sourcing-companies (landing)
  └─ Newsletter reactivation (12 connections)
```

**Implementation:**
```typescript
// Group users by their complete journey
const journeyPaths = profiles.map(p => ({
  originalSource: p.referral_source,
  keyword: p.referral_source_detail,
  entryReferrer: firstSession?.referrer,
  connectionReferrer: lastConnectionSession?.referrer,
  milestones: ['signup', 'connection'].filter(Boolean),
}));

// Aggregate common paths
const pathCounts = journeyPaths.reduce((acc, path) => {
  const key = `${path.originalSource}→${path.entryReferrer}→${path.connectionReferrer}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
```

### Phase 5: Fix the Main Site (External)

For complete tracking, the sourcecodeals.com website needs to:

1. **Capture original referrer in localStorage:**
```javascript
// On blog pages
if (!localStorage.getItem('original_referrer')) {
  localStorage.setItem('original_referrer', document.referrer);
  localStorage.setItem('landing_page', window.location.pathname);
}
```

2. **Append to marketplace links:**
```javascript
document.querySelectorAll('a[href*="marketplace.sourcecodeals.com"]').forEach(link => {
  const originalReferrer = localStorage.getItem('original_referrer');
  const landingPage = localStorage.getItem('landing_page');
  const url = new URL(link.href);
  if (originalReferrer) url.searchParams.set('original_referrer', originalReferrer);
  if (landingPage) url.searchParams.set('blog_landing', landingPage);
  link.href = url.toString();
});
```

3. **In marketplace, capture these params:**
```typescript
// In track-session or initial-session-tracking
const originalReferrer = searchParams.get('original_referrer');
const blogLanding = searchParams.get('blog_landing');

// Store in session
await supabase.from('user_sessions').update({
  original_referrer: originalReferrer,
  blog_landing_page: blogLanding,
}).eq('session_id', sessionId);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/analytics/datafast/AnalyticsCard.tsx` | Update `SortToggle` to support 3 values |
| `src/components/admin/analytics/datafast/SourcesCard.tsx` | Add signups sorting, add "Source" tab for self-reported |
| `src/components/admin/analytics/datafast/GeographyCard.tsx` | Add signups to country/region data |
| `src/components/admin/analytics/datafast/TechStackCard.tsx` | Add signups to browser/OS data |
| `src/hooks/useUnifiedAnalytics.ts` | Query profiles for signups, calculate per-referrer/channel signups |

---

## Database Migration

```sql
-- Add original_source fields to user_sessions for complete tracking
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS original_source text;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS original_keyword text;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS blog_landing_page text;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS original_external_referrer text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_original_source ON user_sessions(original_source);
```

---

## Expected Results

After implementation:

| Card | Current | After |
|------|---------|-------|
| SourcesCard | Visitors, Connections | Visitors, Signups, Connections |
| GeographyCard | Visitors, Connections | Visitors, Signups, Connections |
| Channel tab | Entry referrer only | Original source (Google, LinkedIn) + Entry referrer |
| Referrer tooltips | Shows 0 signups | Shows real signup attribution |
| Journey visibility | Blog → Marketplace | Google → Blog → Marketplace → Connection |

---

## Technical Considerations

1. **Self-reported source is valuable** - Users who say "Google" and provide a keyword give us SEO insights
2. **Multi-touch attribution** - Initial source (Google) may differ from converting source (Newsletter)
3. **Cross-domain tracking** - Full solution requires changes to sourcecodeals.com
4. **Backward compatibility** - Historical data has profile referral_source but not session original_source

---

## Summary

The plan implements a 3-tier attribution system:

1. **Visitors** → Anyone who visited (from sessions)
2. **Signups** → Users who registered (from profiles, correlated to sessions)
3. **Connections** → Users who requested connections (from connection_requests)

Each breakdown (channels, referrers, countries) will support all three metrics, allowing you to see:
- Which channels bring traffic (visitors)
- Which channels convert to users (signups)
- Which channels generate revenue (connections)

And critically, we'll display the **original source** (Google, LinkedIn, AI) separately from the **entry referrer** (blog, newsletter) to show the complete journey from first discovery to conversion.
