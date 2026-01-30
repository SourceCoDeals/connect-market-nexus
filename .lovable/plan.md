
# Complete User Journey Tracking: Strategic Enhancement Plan

## Current State Analysis

After extensive investigation, here's what we have and what's missing:

### What's Already Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| GA4 Integration | Done | `G-N5T31YT52K` with cross-domain config |
| GTM Container | Done | `GTM-NRP8FM6T` deployed |
| Third-party tools | Done | Hotjar, Heap, LinkedIn, RB2B, Warmly, Brevo, Vector |
| Session tracking | Done | `user_sessions` table with geo, UTM, device data |
| Page view tracking | Done | `page_views` table with scroll depth, time on page |
| User event tracking | Done | `user_events` table with custom events |
| Listing analytics | Done | `listing_analytics` with click tracking |
| Search analytics | Done | `search_analytics` with position_clicked, time_to_click |
| First-touch attribution | Done | Stored in localStorage, persists across sessions |
| Real-time dashboard | Done | Globe map, live activity feed, session cards |
| Campaign attribution | Done | UTM analysis with conversion tracking |

### Data We're Currently Capturing

**For Every Visitor (Anonymous or Registered):**
- Session ID (unique per browser session)
- Landing page path and full URL
- Referrer URL
- UTM parameters (source, medium, campaign, term, content)
- Device type, browser, OS
- Country, city, region (via IP geolocation)
- Session duration (via heartbeat)
- Page sequence (array of pages visited)
- Scroll depth per page
- Time on each page
- Click tracking (element-level)
- Search queries with filter data
- Listing interactions (view, save, request)

### What's Missing / Gaps Identified

| Gap | Impact | Solution |
|-----|--------|----------|
| First-touch attribution not saved to DB | Can't analyze original source for converted users | Store first-touch in `user_initial_session` |
| GA4 client ID not linked to session | Can't stitch Supabase + GA4 data | Capture `_ga` cookie value |
| No "full journey" visualization | Admins can't see complete path | Build User Journey Timeline component |
| Cross-domain referrer gap | Users from sourcecodeals.com show as "Direct" if no UTM | Main site needs UTM links |
| External referrer classification | Raw URLs not human-readable | Already fixed with `normalizeReferrer` |
| Company identification not stored | RB2B/Warmly data not in Supabase | Webhook to capture company data |

---

## Implementation Plan

### Phase 1: Store First-Touch Attribution in Database

Currently, first-touch data is only in localStorage. We need to persist it to Supabase for historical analysis.

**Files to modify:**
- `src/hooks/use-initial-session-tracking.ts` - Send first-touch data to edge function

**New data to capture:**
```typescript
// Add to track-session edge function payload
first_touch_source: string | null;
first_touch_medium: string | null;
first_touch_campaign: string | null;
first_touch_timestamp: string | null;
first_touch_landing_page: string | null;
first_touch_referrer: string | null;
```

**Database change:** Add columns to `user_initial_session` or create new `attribution_data` table

---

### Phase 2: Capture GA4 Client ID for Data Stitching

To correlate Supabase sessions with GA4 reports, capture the GA4 client ID.

**Implementation:**
```typescript
// In use-initial-session-tracking.ts
function getGA4ClientId(): string | null {
  const match = document.cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
  return match ? match[1] : null;
}

// Add to session data
ga4_client_id: getGA4ClientId(),
```

**Benefit:** You can export GA4 data and join with Supabase data on this ID.

---

### Phase 3: Build User Journey Timeline Component

Create a detailed visualization showing the complete path for any user/session.

**New component:** `src/components/admin/analytics/journey/UserJourneyTimeline.tsx`

**Features:**
- Timeline showing every page visit with timestamps
- Entry point (referrer/UTM source) highlighted
- Key interactions (saves, searches, connection requests)
- Session duration and engagement metrics
- "Before marketplace" section showing sourcecodeals.com activity (from GA4)

**Data sources:**
- `page_views` - Page sequence
- `user_events` - Custom events
- `listing_analytics` - Listing interactions
- `search_analytics` - Search behavior
- `user_initial_session` - Entry point data

---

### Phase 4: Anonymous User Deep Dive Panel

Enhance the real-time dashboard to show complete journeys for anonymous visitors.

**Current state:** We show current page only
**Enhanced state:** Show full page sequence, entry source, engagement indicators

**Modification to:** `src/hooks/useEnhancedRealTimeAnalytics.ts`

Add to `EnhancedActiveUser` interface:
```typescript
pageSequence: string[];  // All pages visited this session
entrySource: string;     // Normalized referrer
firstPagePath: string;   // Landing page
isReturningVisitor: boolean;  // Based on cookie/localStorage
```

---

### Phase 5: Push dataLayer Events to GA4

Ensure all key actions are sent to GA4 for cross-platform analysis.

**Already implemented in `use-analytics-tracking.ts`:**
- Page views
- Listing views
- Saves
- Connection requests
- Search queries

**Additional events to add:**
- Scroll depth milestones (25%, 50%, 75%, 90%)
- Time on page milestones (30s, 2min, 5min)
- Form interactions (signup started, signup completed)
- CTA clicks

---

### Phase 6: Company Identification Integration

Capture company data from RB2B/Warmly for B2B intelligence.

**Options:**
1. **Webhook integration** - RB2B/Warmly send data to Supabase edge function
2. **Client-side capture** - Listen for Warmly widget events

**New table:** `visitor_companies`
```sql
CREATE TABLE visitor_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  company_name TEXT,
  company_domain TEXT,
  company_industry TEXT,
  company_size TEXT,
  company_location TEXT,
  employee_name TEXT,
  employee_title TEXT,
  employee_linkedin TEXT,
  confidence_score NUMERIC,
  identified_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/use-initial-session-tracking.ts` | Modify | Add first-touch + GA4 client ID |
| `src/hooks/useEnhancedRealTimeAnalytics.ts` | Modify | Add page sequence data |
| `src/components/admin/analytics/journey/` | Create (new directory) | User journey components |
| `src/components/admin/analytics/journey/UserJourneyTimeline.tsx` | Create | Timeline visualization |
| `src/components/admin/analytics/journey/JourneyInsightsPanel.tsx` | Create | Journey analytics |
| `src/hooks/use-user-journey.ts` | Create | Fetch complete journey data |
| `supabase/functions/track-company/index.ts` | Create | Webhook for company data |

---

## What You Need to Do (External)

### On sourcecodeals.com (Main Website)

1. **Add UTM parameters to ALL marketplace links:**
   ```html
   <!-- Navigation link -->
   <a href="https://marketplace.sourcecodeals.com?utm_source=sourcecodeals&utm_medium=nav&utm_campaign=header_cta">
     Access Marketplace
   </a>
   
   <!-- Blog links -->
   <a href="https://marketplace.sourcecodeals.com?utm_source=sourcecodeals&utm_medium=blog&utm_campaign=article_cta">
     Browse Deals
   </a>
   
   <!-- Footer links -->
   <a href="https://marketplace.sourcecodeals.com?utm_source=sourcecodeals&utm_medium=footer&utm_campaign=explore">
     Explore Marketplace
   </a>
   ```

2. **Verify GA4 cross-domain is working:**
   - Click a link from sourcecodeals.com to marketplace
   - Check if URL contains `_gl=` parameter
   - If missing, update GA4 config on main site

3. **Configure RB2B/Warmly webhooks** (optional):
   - In RB2B dashboard, set webhook URL to your edge function
   - Same for Warmly

---

## Expected Results After Implementation

### For Anonymous Visitors
You'll see:
```text
Session: session_abc123
Entry: Google (organic search: "M&A platform")
  ↓
sourcecodeals.com/blog/guide → [from GA4]
  ↓
marketplace.sourcecodeals.com/welcome
  ↓ (2 min, 85% scroll)
marketplace.sourcecodeals.com/listings
  ↓ Search: "SaaS healthcare $5M"
  ↓ (4 results)
marketplace.sourcecodeals.com/listing/xyz
  ↓ (5 min, 100% scroll, saved)
[Session ended or converted to registered user]
```

### For Registered Users
Same as above, plus:
- Full profile data (company, buyer type)
- Historical engagement (all visits, all searches)
- Conversion path to signup
- Post-signup behavior

---

## Admin Dashboard Enhancements

### New Tab: "User Journeys"

Add to `AnalyticsTabContainer.tsx`:
```tsx
<TabsTrigger value="journeys">
  <Route className="h-3.5 w-3.5 mr-1.5" />
  User Journeys
</TabsTrigger>
```

**Features:**
- List of recent sessions with journey summaries
- Click to expand full timeline
- Filter by source, conversion status, engagement level
- Search by session ID or user email

---

## Priority Order

1. **High Priority (Do Now):**
   - Add UTM parameters to sourcecodeals.com links (external)
   - Store first-touch attribution in database
   - Capture GA4 client ID

2. **Medium Priority (Next Sprint):**
   - Build User Journey Timeline component
   - Enhance real-time dashboard with page sequences

3. **Lower Priority (Future):**
   - Company identification webhooks
   - Advanced journey analytics

---

## Technical Notes

### Why Some Visitors Show as "Direct"

| Reason | Solution |
|--------|----------|
| Typed URL directly | Cannot be tracked - truly "direct" |
| Clicked email link without UTM | Add UTM to all email campaigns |
| Clicked bookmark | Cannot be tracked |
| From HTTPS → HTTP | Not applicable (both are HTTPS) |
| Browser privacy settings | Limited solution - use first-party cookies |
| Main site links without UTM | Add UTM parameters (action item for you) |

### Data Retention

Consider adding data retention policies:
- `page_views`: 90 days detailed, aggregated after
- `user_events`: 90 days detailed
- `user_sessions`: 1 year (for journey analysis)
- `user_initial_session`: Indefinite (first-touch attribution is valuable)
