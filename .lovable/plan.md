

# Comprehensive Analytics Data Capture Suite

## Executive Summary

This plan implements a world-class analytics data capture system that fills all current gaps and establishes forward-looking tracking infrastructure. The goal: give marketplace admins complete intelligence on buyer behavior, engagement patterns, and conversion paths.

---

## Current State: Data Audit

### What We Have (Working)
| Metric | Status | Records |
|--------|--------|---------|
| Session creation | Partial | 44,036 sessions |
| Page views | Working | 48,163 records |
| Listing views/saves | Working | 24,993 records |
| Search queries | Working | 1,386 records |
| User events | Working | 3,982 records |
| UTM tracking | Working | Stored per session |

### Critical Gaps (Not Captured)

| Gap | Impact | Current State |
|-----|--------|---------------|
| **Geographic location** | Cannot analyze user distribution by region | 0/44,036 sessions have country/city |
| **Session duration** | Cannot calculate engagement depth | Only 2,476/44,036 have ended_at |
| **Time on page** | Cannot identify high-value content | 0/48,163 page views have time_on_page |
| **Scroll depth** | Cannot measure content engagement | 0/48,163 page views have scroll_depth |
| **IP address** | Cannot detect fraud or geographic trends | 0/44,036 sessions have IP |
| **Clicked elements** | Cannot understand UI interaction patterns | 0/24,993 listing views tracked clicks |
| **Search-to-click time** | Cannot measure search UX quality | 0/1,386 searches have time_to_click |
| **Daily aggregates** | Cannot show historical trends | 0 records in daily_metrics |
| **Real-time heartbeat** | Cannot detect active users accurately | is_active field unreliable |

---

## Architecture Overview

```text
+------------------------+     +------------------------+     +--------------------+
|   CLIENT-SIDE          |     |   EDGE FUNCTION        |     |   DATABASE         |
|   TRACKING             |     |   ENRICHMENT           |     |                    |
+------------------------+     +------------------------+     +--------------------+
|                        |     |                        |     |                    |
| SessionContext         |---->| track-session          |---->| user_sessions      |
|  - Generate session ID |     |  - IP geolocation      |     |  - country, city   |
|  - Capture UTM params  |     |  - Parse user-agent    |     |  - timezone        |
|  - Track referrer      |     |  - Fraud detection     |     |  - ip_address      |
|                        |     |                        |     |                    |
| PageTracker            |---->| (direct insert)        |---->| page_views         |
|  - Time on page        |     |                        |     |  - time_on_page    |
|  - Scroll depth        |     |                        |     |  - scroll_depth    |
|  - Exit tracking       |     |                        |     |                    |
|                        |     |                        |     |                    |
| EngagementTracker      |---->| (direct insert)        |---->| listing_analytics  |
|  - Click heatmaps      |     |                        |     |  - clicked_elements|
|  - Time to first click |     |                        |     |  - engagement_score|
|                        |     |                        |     |                    |
| HeartbeatProvider      |---->| session-heartbeat      |---->| user_sessions      |
|  - Every 30 seconds    |     |  - Update last_active  |     |  - last_active_at  |
|  - Active tab detection|     |  - Calculate duration  |     |  - ended_at        |
|                        |     |                        |     |                    |
| DailyAggregator        |---->| aggregate-daily-metrics|---->| daily_metrics      |
|  (Scheduled CRON)      |     |  - Runs at midnight    |     |  - All aggregates  |
+------------------------+     +------------------------+     +--------------------+
```

---

## Implementation Details

### 1. IP Geolocation Edge Function

Create a new edge function `track-session` that enriches session data with geographic information.

**Approach**: Use free IP geolocation API (ipapi.co or ip-api.com) to resolve visitor location from IP address. Edge functions have access to the client IP through request headers.

```typescript
// supabase/functions/track-session/index.ts
// Key capabilities:
// - Extract IP from request headers (x-forwarded-for, cf-connecting-ip)
// - Call ipapi.co/json for country, city, region, timezone
// - Update user_sessions with geographic data
// - Rate limit: 1000 requests/day on free tier (sufficient for new sessions)
```

**Data captured**:
- Country code (US, CA, UK, etc.)
- Country name
- City
- Region/State
- Timezone
- ISP (for bot detection)

### 2. Session Heartbeat System

Create a lightweight heartbeat to accurately track session duration and active users.

**Client component**: `HeartbeatProvider.tsx`
```typescript
// Sends heartbeat every 30 seconds when tab is active
// Uses document.visibilityState to pause when tab is hidden
// Calculates accurate session duration
// Updates is_active = true for real-time "online" status
```

**Edge function**: `session-heartbeat`
```typescript
// Updates user_sessions:
// - last_active_at: current timestamp
// - is_active: true
// - session_duration_seconds: calculated from started_at
```

**Benefits**:
- Accurate session duration (not just start/end)
- Real-time "online users" count
- Detect idle vs active engagement

### 3. Enhanced Page Tracking

Upgrade `PageTracker` to capture engagement metrics:

```typescript
// New usePageEngagement hook
// Captures:
// - Time on page (calculated when navigating away)
// - Max scroll depth (0-100%)
// - Scroll velocity (reading pace indicator)
// - Focus time (active reading vs idle)
// - Click count on page
```

**Implementation**:
- Use `IntersectionObserver` for scroll depth
- Track `document.hasFocus()` for attention time
- Store pending metrics, flush on `beforeunload` or route change

### 4. Click Element Tracking

Enhanced click tracking for interaction heatmaps:

```typescript
// useClickTracking hook
// For listing pages, capture:
// - Element ID clicked
// - Element type (button, link, image, etc.)
// - Position on page (x, y coordinates)
// - Time since page load (time_to_first_click)
// - Click sequence number
```

**Stored as JSONB in `clicked_elements`**:
```json
{
  "clicks": [
    { "element": "save-button", "type": "button", "x": 450, "y": 320, "time_ms": 5230 },
    { "element": "contact-cta", "type": "button", "x": 450, "y": 890, "time_ms": 12450 }
  ],
  "total_clicks": 2,
  "first_click_ms": 5230
}
```

### 5. Search Enhancement

Improve search analytics for conversion optimization:

```typescript
// Enhanced trackSearch function
// New metrics:
// - time_to_first_click: ms from search to clicking a result
// - position_clicked: which result position (1, 2, 3...)
// - results_clicked: total results clicked in session
// - refined_search: did user modify query?
// - search_session: group related searches together
```

### 6. Daily Metrics Aggregation

Scheduled edge function to compute daily aggregates:

```typescript
// supabase/functions/aggregate-daily-metrics/index.ts
// Runs via pg_cron at midnight UTC
// Aggregates:
// - total_users, new_signups, active_users, returning_users
// - total_sessions, avg_session_duration, bounce_rate
// - page_views, unique_page_views
// - new_listings, listing_views
// - connection_requests, successful_connections
// - searches_performed, conversion_rate
```

**Trigger**: Database function called by pg_cron:
```sql
SELECT cron.schedule(
  'aggregate-daily-metrics',
  '0 0 * * *',  -- Midnight UTC daily
  $$SELECT net.http_post(
    'https://<project>.supabase.co/functions/v1/aggregate-daily-metrics',
    '{}',
    headers:='{"Authorization": "Bearer <service_key>"}'
  )$$
);
```

---

## Database Schema Updates

### New Columns for `user_sessions`

```sql
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country_code TEXT;
```

### Indexes for Performance

```sql
-- For real-time active users query
CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
  ON user_sessions(is_active, last_active_at) 
  WHERE is_active = true;

-- For geographic analytics
CREATE INDEX IF NOT EXISTS idx_user_sessions_geo 
  ON user_sessions(country, city) 
  WHERE country IS NOT NULL;

-- For time-based queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_started 
  ON user_sessions(started_at DESC);
```

---

## New Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/track-session/index.ts` | IP geolocation and session enrichment |
| `supabase/functions/session-heartbeat/index.ts` | Keep sessions alive, calculate duration |
| `supabase/functions/aggregate-daily-metrics/index.ts` | Daily rollup computation |
| `src/hooks/use-page-engagement.ts` | Track time on page, scroll depth |
| `src/hooks/use-click-tracking.ts` | Track element clicks for heatmaps |
| `src/hooks/use-session-heartbeat.ts` | Send periodic heartbeats |
| `src/components/HeartbeatProvider.tsx` | Wrapper component for heartbeat |
| `src/components/PageEngagementTracker.tsx` | Wrapper for page metrics |

## Files to Modify

| File | Changes |
|------|---------|
| `src/context/AnalyticsContext.tsx` | Call track-session edge function, add heartbeat |
| `src/hooks/use-analytics-tracking.ts` | Integrate page engagement and click tracking |
| `src/contexts/SessionContext.tsx` | Initialize heartbeat on session start |
| `src/components/SessionTrackingProvider.tsx` | Add HeartbeatProvider wrapper |
| `supabase/config.toml` | Add new edge function configurations |

---

## Data Flow: Complete Session Lifecycle

```text
1. USER LANDS ON SITE
   └── SessionContext generates session_id
       └── track-session edge function called
           ├── Parse User-Agent (browser, device, OS)
           ├── Get IP from headers
           ├── Call ipapi.co for geolocation
           └── Insert enriched record to user_sessions

2. USER BROWSES PAGES
   └── PageEngagementTracker active
       ├── Track scroll depth continuously
       ├── Track focus/blur events
       └── On page exit: insert page_view with metrics

3. USER VIEWS LISTINGS
   └── ClickTracking active
       ├── Record each click with position and timing
       └── On exit: insert listing_analytics with engagement

4. USER SEARCHES
   └── Enhanced search tracking
       ├── Record query, filters, results
       └── Track clicks on results with position

5. EVERY 30 SECONDS (while tab active)
   └── HeartbeatProvider sends pulse
       └── session-heartbeat edge function
           ├── Update last_active_at
           ├── Calculate session_duration_seconds
           └── Set is_active = true

6. USER LEAVES/CLOSES TAB
   └── beforeunload event fires
       ├── Final page metrics flushed
       ├── Session ended_at updated
       └── is_active = false

7. MIDNIGHT UTC (DAILY)
   └── aggregate-daily-metrics runs
       └── Compute all daily_metrics aggregates
```

---

## Analytics Dashboard Enhancements

With this new data, the analytics dashboard can show:

### New Visualizations

| Visualization | Data Source |
|---------------|-------------|
| **World/US Map** | user_sessions.country, city |
| **Real-time Active Users** | is_active = true AND last_active_at > NOW() - 2 min |
| **Avg Session Duration** | session_duration_seconds |
| **Engagement Heatmap** | listing_analytics.clicked_elements |
| **Content Depth Analysis** | page_views.scroll_depth |
| **Reading Time Distribution** | page_views.time_on_page |
| **Search Quality Score** | search_analytics.time_to_click, position_clicked |
| **Historical Trends** | daily_metrics (30/60/90 day charts) |

### New KPIs

| KPI | Calculation |
|-----|-------------|
| **Engaged Session Rate** | Sessions with scroll_depth > 50% |
| **Active User Count** | Real-time count of active sessions |
| **Avg Time to First Click** | Mean of first_click_ms across sessions |
| **Search Success Rate** | Searches with position_clicked < 5 |
| **Geographic Concentration** | Top 5 countries by session count |

---

## Implementation Phases

### Phase 1: Session Enrichment (Core)
1. Create `track-session` edge function with IP geolocation
2. Update `AnalyticsContext` to call new edge function
3. Add database columns and indexes
4. Test: Verify new sessions have country/city data

### Phase 2: Heartbeat System
1. Create `session-heartbeat` edge function
2. Create `HeartbeatProvider` component
3. Add to `SessionTrackingProvider`
4. Test: Verify accurate session duration and active status

### Phase 3: Page Engagement
1. Create `use-page-engagement` hook
2. Create `PageEngagementTracker` component
3. Integrate with existing page tracking
4. Test: Verify time_on_page and scroll_depth populated

### Phase 4: Click Tracking
1. Create `use-click-tracking` hook
2. Integrate with listing detail pages
3. Store click data in JSONB format
4. Test: Verify clicked_elements populated

### Phase 5: Search Enhancement
1. Upgrade `trackSearch` function
2. Add time_to_click tracking
3. Track result position clicked
4. Test: Verify search metrics populated

### Phase 6: Daily Aggregation
1. Create `aggregate-daily-metrics` edge function
2. Set up pg_cron schedule (or manual trigger initially)
3. Populate daily_metrics table
4. Test: Verify aggregates match source data

---

## IP Geolocation Service Options

| Service | Free Tier | Rate Limit | Accuracy |
|---------|-----------|------------|----------|
| **ipapi.co** | 1,000/day | 30/min | Good |
| **ip-api.com** | Unlimited (non-commercial) | 45/min | Good |
| **ipdata.co** | 1,500/day | 10/sec | Excellent |

**Recommendation**: Start with `ip-api.com` for development (free, no key needed), then move to `ipapi.co` or `ipdata.co` for production with proper rate limiting.

---

## Privacy and Compliance

- IP addresses stored only for analytics (not displayed to users)
- Consider IP anonymization option (truncate last octet)
- Add data retention policy (auto-delete sessions > 90 days)
- Document data collection in privacy policy
- Respect DNT (Do Not Track) header if set

---

## Success Metrics

After implementation, we should see:
- 100% of new sessions have country/city data
- 95%+ of page views have time_on_page and scroll_depth
- 100% of sessions have accurate duration
- Real-time "active users" count available
- daily_metrics populated for historical analysis
- Search UX metrics (time_to_click, position) tracked

This comprehensive tracking suite will transform the analytics dashboard from "what happened" to "why it happened" - enabling data-driven decisions on content, UX, and marketing investments.

