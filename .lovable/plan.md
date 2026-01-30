
# Comprehensive Real-Data Analytics Suite: M&A Intelligence Command Center

## Overview

This plan transforms the current analytics dashboard into a comprehensive, multi-section intelligence platform with real data from all available sources. The dashboard will feature multiple specialized views, advanced filtering, and world-class visualizations.

---

## Data Audit: What We Have

| Data Source | Records | Key Fields Available |
|-------------|---------|---------------------|
| **user_sessions** | 44,001 sessions, 530 unique users | device_type, browser, referrer, ip_address, country (not populated), city (not populated) |
| **listing_analytics** | 24,985 records | action_type (view/save/request), time_spent, scroll_depth, referrer_page, utm_* |
| **search_analytics** | 900+ queries | search_query, filters_applied, results_count, no_results, time_to_click |
| **connection_requests** | 500+ requests | status, buyer_type (via user), listing, created_at, approved_at |
| **profiles** | 357 approved buyers | buyer_type, target_locations, business_categories, company |
| **daily_metrics** | Historical aggregates | page_views, sessions, connection_requests, bounce_rate |

**Gap Identified**: `user_sessions.country` and `city` columns exist but are not being populated. We should add this data collection or use IP-based geolocation, but for now we'll focus on what we have.

---

## New Dashboard Architecture: Multi-Tab Design

The dashboard will feature a tabbed interface with specialized views:

```text
+------------------------------------------------------------------+
| [ Overview ] [ Traffic ] [ Engagement ] [ Search ] [ Activity ]  |
+------------------------------------------------------------------+
```

### Tab 1: Overview (Current Premium Dashboard, Enhanced)
- Hero stats with real sparklines
- Connection velocity chart (real data)
- Geography map (from target_locations - REAL DATA)
- Transaction activity panel
- Deal flow funnel

### Tab 2: Traffic Intelligence (NEW)
- Session volume trends (30/60/90 days)
- Device breakdown (desktop 97% / mobile 3%)
- Browser distribution (Chrome 95%, Safari 4%, Firefox 1%)
- Traffic sources breakdown (referrer analysis)
- UTM campaign performance
- Time-of-day heatmap (when users are most active)

### Tab 3: Engagement Deep Dive (NEW)
- Listing performance leaderboard with view counts, saves, request rates
- Scroll depth analysis (how far users read)
- Time on page by listing category
- Save-to-request conversion funnel
- User journey paths (referrer_page flow)

### Tab 4: Search Intelligence (NEW)
- Top search queries with result counts
- Zero-result searches (opportunity gaps)
- Search-to-click conversion rates
- Filter usage patterns
- Search refinement behavior

### Tab 5: Live Activity (Existing - Moved here)
- Real-time user activity feed
- Recent connection requests
- Latest signups

---

## Component Architecture

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/analytics/AnalyticsTabContainer.tsx` | Main tabbed container |
| `src/components/admin/analytics/traffic/TrafficIntelligenceDashboard.tsx` | Traffic tab wrapper |
| `src/components/admin/analytics/traffic/SessionVolumeChart.tsx` | Daily sessions area chart |
| `src/components/admin/analytics/traffic/DeviceBrowserBreakdown.tsx` | Donut charts for device/browser |
| `src/components/admin/analytics/traffic/TrafficSourcesPanel.tsx` | Referrer analysis table |
| `src/components/admin/analytics/traffic/ActivityHeatmap.tsx` | Hour-of-day/day-of-week heatmap |
| `src/components/admin/analytics/engagement/EngagementDashboard.tsx` | Engagement tab wrapper |
| `src/components/admin/analytics/engagement/ListingLeaderboard.tsx` | Top performing listings table |
| `src/components/admin/analytics/engagement/EngagementFunnel.tsx` | View->Save->Request funnel |
| `src/components/admin/analytics/engagement/UserJourneyFlow.tsx` | Sankey or flow diagram |
| `src/components/admin/analytics/search/SearchIntelligenceDashboard.tsx` | Search tab wrapper |
| `src/components/admin/analytics/search/TopSearchQueries.tsx` | Query frequency table |
| `src/components/admin/analytics/search/ZeroResultsAlert.tsx` | Opportunity gaps card |
| `src/components/admin/analytics/search/FilterUsageChart.tsx` | Which filters users apply |

### New Data Hooks

| Hook | Purpose |
|------|---------|
| `src/hooks/useTrafficAnalytics.ts` | Session data, device stats, referrers |
| `src/hooks/useEngagementAnalytics.ts` | Listing views, saves, scroll depth |
| `src/hooks/useSearchAnalytics.ts` | Search queries, zero results, filters |

---

## Data Fixes Required

### 1. Geography Map - Make It Real
Currently the map uses `target_locations` from profiles which IS real data. However, the region-to-state mapping needs refinement:

```typescript
// Current data shows:
// - "United States" (249 buyers) - most common
// - "North America" (29 buyers)
// - "Northeast US", "Southeast US", etc.

// Fix: Parse and aggregate properly
const parseTargetLocations = (locations: string[]) => {
  const regionCounts: Record<string, number> = {};
  locations.forEach(loc => {
    // Handle "United States" as nationwide
    if (loc === 'United States') {
      regionCounts['Nationwide'] = (regionCounts['Nationwide'] || 0) + 1;
    } else if (['Northeast US', 'Southeast US', 'Midwest US', 'Western US', 'Southwest US'].includes(loc)) {
      regionCounts[loc] = (regionCounts[loc] || 0) + 1;
    }
    // etc.
  });
  return regionCounts;
};
```

### 2. Session Data Enrichment
The `user_sessions` table has country/city columns but they're empty. We should:
- Add IP geolocation in the session tracking hook (future enhancement)
- For now, focus on what we have: device, browser, referrer

### 3. Real Sparklines
Currently `conversionRateSparkline` has hardcoded values. Fix to use real historical data.

---

## Detailed Component Specifications

### Traffic Intelligence Dashboard

```text
+------------------------------------------------------------------+
|  TIME SELECTOR: [ Last 7 days ] [ 30 days ] [ 90 days ] [Custom] |
+------------------------------------------------------------------+

+---------------------------+----------------------------+
|  SESSION VOLUME           |  DEVICE BREAKDOWN          |
|  [Area chart: 30 days]    |  [Donut: Desktop/Mobile]   |
|  Peak: Jan 15 (524 sess.) |  Desktop: 97%              |
|  Avg: 115/day             |  Mobile: 3%                |
+---------------------------+----------------------------+

+---------------------------+----------------------------+
|  BROWSER DISTRIBUTION     |  TRAFFIC SOURCES           |
|  [Horizontal bar chart]   |  [Sortable table]          |
|  Chrome: 10,417 (95%)     |  1. lovable.dev (11,649)   |
|  Safari: 426 (4%)         |  2. brevo email (4,184)    |
|  Firefox: 103 (1%)        |  3. sourcecodeals.com      |
+---------------------------+  4. LinkedIn (157)         |
                            |  5. Google (198)           |
+---------------------------+----------------------------+

+------------------------------------------------------------------+
|  ACTIVITY HEATMAP: When are users most active?                   |
|  [Grid: Days of week x Hours of day]                             |
|  Color intensity = session count                                 |
+------------------------------------------------------------------+
```

### Engagement Dashboard

```text
+------------------------------------------------------------------+
|  LISTING LEADERBOARD                                             |
|  [Sortable table with columns:]                                  |
|  - Rank                                                          |
|  - Listing Title                                                 |
|  - Category                                                      |
|  - Views (24,248 total)                                         |
|  - Saves (231 total)                                            |
|  - Requests (506 total)                                         |
|  - View->Request Rate                                           |
+------------------------------------------------------------------+

+---------------------------+----------------------------+
|  ENGAGEMENT FUNNEL        |  TOP CATEGORIES            |
|  Views: 24,248            |  [Bar chart by category]   |
|    ↓ 0.95% save rate      |  Construction: 4,418       |
|  Saves: 231               |  Healthcare: 1,377         |
|    ↓ 219% request rate    |  Professional Svc: 955     |
|  Requests: 506            |  Transportation: 761       |
+---------------------------+----------------------------+
```

### Search Intelligence Dashboard

```text
+------------------------------------------------------------------+
|  TOP SEARCH QUERIES                                              |
|  [Table with real data]                                          |
|  Query     | Count | Avg Results | Click Rate                   |
|  "health"  |  15   |     2.3     |    67%                        |
|  "acc"     |   8   |     6.9     |    50%                        |
|  "finance" |   8   |    13.9     |    38%                        |
+------------------------------------------------------------------+

+---------------------------+----------------------------+
|  ZERO RESULT SEARCHES     |  FILTER USAGE              |
|  [Alert card showing      |  [Donut showing which      |
|   queries with no results]|   filters are most used]   |
|   - opportunity gaps      |  - Category: 45%           |
|   - missing listings      |  - Location: 32%           |
+---------------------------+  - Revenue: 23%            |
                            +----------------------------+
```

---

## Premium Design Refinements

### Visual Consistency

- **All charts use coral/peach/navy palette**
- **No generic icons** - text-only labels where possible
- **Large typography** for key numbers (5xl-6xl)
- **Subtle borders** (border-border/50)
- **Smooth transitions** on all interactions
- **Consistent card styling** (rounded-2xl, p-6)

### Filtering System

Global time range selector affects all visualizations:
```typescript
interface AnalyticsFilters {
  timeRange: '7' | '30' | '90' | 'custom';
  customStart?: Date;
  customEnd?: Date;
  buyerType?: string[];
  category?: string[];
}
```

### Export Capabilities

Each section should have:
- CSV export for tables
- PNG export for charts (future)

---

## Implementation Phases

### Phase 1: Fix Existing Data Issues
- Update `usePremiumAnalytics.ts` to remove all hardcoded/placeholder data
- Fix geography map to properly parse target_locations array
- Ensure all sparklines use real historical data

### Phase 2: Create Tabbed Container
- Build `AnalyticsTabContainer.tsx` with 5 tabs
- Move existing `PremiumAnalyticsDashboard` to Overview tab
- Move `UserActivityFeed` to Activity tab

### Phase 3: Build Traffic Intelligence Tab
- Create `useTrafficAnalytics.ts` hook
- Build session volume chart with real daily data
- Add device/browser breakdown visualizations
- Build traffic sources table with referrer analysis
- Create activity heatmap

### Phase 4: Build Engagement Dashboard Tab
- Create `useEngagementAnalytics.ts` hook
- Build listing leaderboard with all engagement metrics
- Create view/save/request funnel visualization
- Add category performance breakdown

### Phase 5: Build Search Intelligence Tab
- Create `useSearchAnalytics.ts` hook
- Build top queries table with real data
- Add zero-results alert card
- Create filter usage visualization

### Phase 6: Polish and Integration
- Add global filtering system
- Ensure consistent styling across all tabs
- Add loading states and error handling
- Performance optimization (memoization, query caching)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/AdminDashboard.tsx` | Replace analytics content with new tabbed container |
| `src/hooks/usePremiumAnalytics.ts` | Remove hardcoded data, fix geography parsing |
| `src/components/admin/analytics/premium/USAGeographyMap.tsx` | Improve region parsing for real data |

## Files to Create

| Category | Files |
|----------|-------|
| **Container** | `AnalyticsTabContainer.tsx` |
| **Traffic** | `TrafficIntelligenceDashboard.tsx`, `SessionVolumeChart.tsx`, `DeviceBrowserBreakdown.tsx`, `TrafficSourcesPanel.tsx`, `ActivityHeatmap.tsx` |
| **Engagement** | `EngagementDashboard.tsx`, `ListingLeaderboard.tsx`, `EngagementFunnel.tsx` |
| **Search** | `SearchIntelligenceDashboard.tsx`, `TopSearchQueries.tsx`, `ZeroResultsAlert.tsx` |
| **Hooks** | `useTrafficAnalytics.ts`, `useEngagementAnalytics.ts`, `useSearchAnalytics.ts` |

---

## Success Criteria

- Zero placeholder/hardcoded data - all metrics are real
- Five specialized tabs for different analytics needs
- Sub-2-second load time for each tab
- Global time range filtering works across all visualizations
- Mobile-responsive layouts
- Export functionality for key data
- Admins can answer questions like:
  - "Where is our traffic coming from?"
  - "Which listings get the most engagement?"
  - "What are users searching for that we don't have?"
  - "When are users most active?"
  - "Which buyer types are most engaged?"

