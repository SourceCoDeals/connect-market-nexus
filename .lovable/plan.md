
# Intelligence Center Complete Redesign

## Vision

Transform the existing tab-based Analytics dashboard into a modern, card-based Intelligence Center inspired by Datafa.st - a single scrollable page with modular cards, each containing 2-5 internal tabs, rich tooltips on hover, and a floating globe toggle at the bottom.

---

## Layout Architecture

```text
+------------------------------------------------------------------+
|  [Logo]   < Last 30 days v    Daily v    [Refresh]               |
+------------------------------------------------------------------+
|                                                                   |
|  [Visitors]  [Connections]  [Conv Rate]  [Bounce]  [Session]  [Online]
|    2.4k        47            1.96%        68%       4m 32s       5
|   +12.3%      +8.2%         -2.1%        +3.4%     -8.2%
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |              DAILY VISITORS BAR CHART                       |  |
|  |    [Tooltip: Date, Visitors, Connections, Conv Rate]        |  |
|  |                                                              |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +---------------------------+  +---------------------------+     |
|  | Channel | Referrer | UTM  |  | Map | Country | Region |      |
|  |   Keyword      Visitors v |  |   City             Visitors v |
|  |                           |  |                           |     |
|  | [Donut Chart / List]      |  | [Choropleth / Flag List] |     |
|  |   Organic Social   45%    |  |   United States     847  |     |
|  |   Direct           32%    |  |   United Kingdom    234  |     |
|  |   Referral         15%    |  |   Canada            189  |     |
|  |   Organic Search    8%    |  |   Germany           156  |     |
|  +---------------------------+  +---------------------------+     |
|                                                                   |
|  +---------------------------+  +---------------------------+     |
|  | Hostname | Page | Entry   |  | Browser | OS | Device     |     |
|  |   Exit Link   Visitors v  |  |             Visitors v    |     |
|  |                           |  |                           |     |
|  |   /marketplace      1.2k  |  |   Chrome          68%     |     |
|  |   /welcome          892   |  |   Safari          21%     |     |
|  |   /signup           456   |  |   Firefox          6%     |     |
|  |   /listing/...      234   |  |   Edge             5%     |     |
|  +---------------------------+  +---------------------------+     |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | Goals | Funnel | User | Journey                              |  |
|  |                                                3.2% conv     |  |
|  |  [Sankey/Funnel Visualization]                               |  |
|  |  Visit -> Signup -> NDA -> Fee Agreement -> Connection       |  |
|  |  2.4k     892       234       156              47             |  |
|  |      -63%      -74%      -33%       -70%                     |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|                       [Globe] [Lightbulb]                        |
+------------------------------------------------------------------+
```

---

## Component Structure

### 1. Global Header Bar
- Date range selector (Last 7/30/90 days, Custom)
- Granularity toggle (Daily/Hourly)
- Refresh button
- Compact, Stripe-inspired design

### 2. Hero KPI Strip (6 metrics)

| Metric | Data Source | Marketplace Mapping |
|--------|-------------|---------------------|
| Visitors | `user_sessions.count` | Total unique sessions |
| Connections | `connection_requests.count` | Connection requests |
| Conversion Rate | connections/visitors | Request rate |
| Bounce Rate | sessions with 1 page view / total | Single-page exits |
| Session Time | `avg(session_duration_seconds)` | Avg engagement |
| Online | Real-time active count | Live visitors |

Each KPI shows:
- Large value
- Trend arrow with % change vs previous period
- Small sparkline

### 3. Main Chart Card
**Daily Visitors Chart with Dual Axis**
- Bar chart: Daily visitor count (coral bars)
- Line overlay: Daily connection requests (blue line)
- Hover tooltip shows:
  - Date (e.g., "Saturday, 10 January")
  - Visitors count
  - Connections count + "New" badge
  - Connections/visitor ratio
  - Conversion rate %

### 4. Sources Card (Left Column)
**Tabs: Channel | Referrer | Campaign | Keyword**

| Tab | Data Source | Visualization |
|-----|-------------|---------------|
| Channel | Categorized referrers | Donut chart with icons |
| Referrer | `user_sessions.referrer` | Ranked list with favicons |
| Campaign | `utm_campaign` | List with connection counts |
| Keyword | `utm_term` | List with connection counts |

**Features:**
- Sort toggle: Visitors / Connections
- Filter dropdown by channel
- Hover tooltip: Visitors, Connections, Conv Rate
- "Details" expand link

**Channel Categories:**
- Organic Social (X, LinkedIn, Facebook, Instagram)
- Organic Search (Google, Bing, Brave)
- Direct
- Referral (other sites)
- AI (ChatGPT, Claude, Perplexity)
- Newsletter
- Affiliate

### 5. Geography Card (Right Column)
**Tabs: Map | Country | Region | City**

| Tab | Visualization |
|-----|---------------|
| Map | Choropleth world map (intensity by visitors) |
| Country | Flag + name list, sorted by visitors |
| Region | State/province list with parent country flag |
| City | City list with country flag |

**Features:**
- Sort toggle: Visitors / Connections
- Hover tooltip: Country/Region/City, Visitors, Connections, Conv Rate
- Coral intensity gradient based on visitor count
- "Details" expand link

### 6. Pages Card (Left Column, Row 2)
**Tabs: Hostname | Page | Entry page | Exit link**

| Tab | Data Source |
|-----|-------------|
| Hostname | Domain breakdown (for multi-domain tracking) |
| Page | `page_views.page_path` ranked by views |
| Entry page | First page per session |
| Exit link | `exit_page = true` pages |

**Features:**
- Sort toggle: Visitors / Connections
- Hover tooltip with full path, view count, bounce rate
- Path truncation with ellipsis

### 7. Tech Stack Card (Right Column, Row 2)
**Tabs: Browser | OS | Device**

| Tab | Data Source |
|-----|-------------|
| Browser | `user_sessions.browser` |
| OS | `user_sessions.os` |
| Device | `user_sessions.device_type` |

**Features:**
- Brand icons (Chrome, Safari, Firefox, etc.)
- Sort toggle: Visitors / Connections
- Hover tooltip: Name, Visitors, Connections, Conv Rate

### 8. Conversion Card (Full Width, Row 3)
**Tabs: Goals | Funnel | User | Journey**

| Tab | Visualization | Data Source |
|-----|---------------|-------------|
| Goals | Completed milestones list | `user_journeys.milestones` |
| Funnel | Sankey/waterfall | Journey stage progression |
| User | Top converting users | Profile + engagement data |
| Journey | Path sequence analysis | Page view sequences |

**Funnel Stages (Marketplace-specific):**
1. Visit Landing Page (all visitors)
2. View Marketplace (saw listings)
3. Create Account (registered)
4. Sign NDA
5. Sign Fee Agreement
6. Send Connection Request

Drop-off percentages shown between each stage.

### 9. Floating Action Buttons
**Sticky footer with two circular buttons:**
- Globe icon: Toggles 3D Mapbox globe overlay (fullscreen)
- Lightbulb icon: Toggles AI insights panel (future)

---

## Data Hooks Architecture

### New Unified Hook: `useUnifiedAnalytics`

```typescript
interface UnifiedAnalyticsData {
  // KPI Summary
  kpis: {
    visitors: { value: number; trend: number; sparkline: number[] };
    connections: { value: number; trend: number; sparkline: number[] };
    conversionRate: { value: number; trend: number };
    bounceRate: { value: number; trend: number };
    avgSessionTime: { value: number; trend: number };
    onlineNow: number;
  };
  
  // Daily chart data
  dailyMetrics: Array<{
    date: string;
    visitors: number;
    connections: number;
    bounceRate: number;
  }>;
  
  // Sources breakdown
  channels: Array<{ name: string; visitors: number; connections: number; icon: string }>;
  referrers: Array<{ domain: string; visitors: number; connections: number; favicon: string }>;
  campaigns: Array<{ name: string; visitors: number; connections: number }>;
  keywords: Array<{ term: string; visitors: number; connections: number }>;
  
  // Geography
  countries: Array<{ name: string; code: string; visitors: number; connections: number }>;
  regions: Array<{ name: string; country: string; visitors: number; connections: number }>;
  cities: Array<{ name: string; country: string; visitors: number; connections: number }>;
  
  // Pages
  topPages: Array<{ path: string; visitors: number; avgTime: number; bounceRate: number }>;
  entryPages: Array<{ path: string; visitors: number; bounceRate: number }>;
  exitPages: Array<{ path: string; exits: number; exitRate: number }>;
  
  // Tech
  browsers: Array<{ name: string; visitors: number; percentage: number }>;
  operatingSystems: Array<{ name: string; visitors: number; percentage: number }>;
  devices: Array<{ type: string; visitors: number; percentage: number }>;
  
  // Funnel
  funnel: {
    stages: Array<{ name: string; count: number; dropoff: number }>;
    overallConversion: number;
  };
  
  // Top users (for User tab)
  topUsers: Array<{
    id: string;
    name: string;
    company: string;
    sessions: number;
    pagesViewed: number;
    connections: number;
  }>;
}
```

---

## New Components to Create

### Container Component
- `DatafastAnalyticsDashboard.tsx` - Main container

### Card Components (Reusable)
- `AnalyticsCard.tsx` - Base card with internal tabs
- `KPIStrip.tsx` - Hero metrics row
- `DailyVisitorsChart.tsx` - Main bar+line chart
- `SourcesCard.tsx` - Channel/Referrer/Campaign/Keyword
- `GeographyCard.tsx` - Map/Country/Region/City
- `PagesCard.tsx` - Hostname/Page/Entry/Exit
- `TechStackCard.tsx` - Browser/OS/Device
- `ConversionCard.tsx` - Goals/Funnel/User/Journey
- `FloatingGlobeToggle.tsx` - Sticky bottom buttons

### Tooltip Components
- `AnalyticsTooltip.tsx` - Rich hover card (dark theme, multi-row)

### Visualization Components
- `DonutChart.tsx` - For channel breakdown
- `ChoroplethMap.tsx` - Simple world map with intensity
- `FunnelSankey.tsx` - Waterfall/sankey funnel
- `Sparkline.tsx` - Mini inline chart for KPIs

---

## Design System

### Colors (Datafa.st-inspired)
- Primary bars: `hsl(12 95% 77%)` (coral/peach)
- Secondary line: `hsl(220 70% 55%)` (blue)
- Background: `hsl(0 0% 99%)` (near-white)
- Card: `white` with subtle border
- Tooltip: `hsl(0 0% 15%)` (dark charcoal)
- Positive trend: `hsl(145 60% 45%)` (green)
- Negative trend: `hsl(0 65% 55%)` (red)

### Typography
- KPI values: `text-4xl font-light tabular-nums`
- Card labels: `text-[10px] uppercase tracking-[0.15em]`
- Tab triggers: `text-sm font-medium`
- List items: `text-sm`
- Tooltips: `text-xs` with tight line-height

### Spacing
- Card padding: `p-6`
- Card gap: `gap-6`
- Section gap: `space-y-6`
- Tab content gap: `space-y-4`

### Borders & Shadows
- Cards: `rounded-2xl border border-border/50`
- Minimal shadows (almost flat design)
- Subtle hover states

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `useUnifiedAnalytics` hook consolidating all data
2. Create base `AnalyticsCard` component with tabs
3. Create `AnalyticsTooltip` component
4. Create `FloatingGlobeToggle` component

### Phase 2: Top Section
1. Build `KPIStrip` with all 6 metrics + sparklines
2. Build `DailyVisitorsChart` with dual axis + tooltips

### Phase 3: Sources & Geography Row
1. Build `SourcesCard` with all 4 tabs + donut chart
2. Build `GeographyCard` with choropleth + flag lists

### Phase 4: Pages & Tech Row
1. Build `PagesCard` with all 4 tabs
2. Build `TechStackCard` with icons

### Phase 5: Conversion Section
1. Build `ConversionCard` with funnel visualization
2. Implement Goals/User/Journey tabs

### Phase 6: Globe Integration
1. Move existing Mapbox globe to overlay mode
2. Wire up floating toggle button
3. Add smooth open/close animations

### Phase 7: Polish
1. Add all hover tooltips
2. Implement sort toggles
3. Add loading skeletons
4. Mobile responsiveness

---

## Files to Create/Modify

### New Files
```text
src/components/admin/analytics/datafast/
├── DatafastAnalyticsDashboard.tsx    # Main container
├── AnalyticsCard.tsx                  # Reusable card with tabs
├── AnalyticsTooltip.tsx               # Dark tooltip component
├── KPIStrip.tsx                       # Hero metrics
├── DailyVisitorsChart.tsx             # Main chart
├── SourcesCard.tsx                    # Sources breakdown
├── GeographyCard.tsx                  # Geography breakdown
├── PagesCard.tsx                      # Pages breakdown
├── TechStackCard.tsx                  # Tech stack breakdown
├── ConversionCard.tsx                 # Funnel + goals
├── FloatingGlobeToggle.tsx            # Sticky buttons
├── DonutChart.tsx                     # Channel donut
├── ChoroplethMap.tsx                  # Simple world map
├── FunnelSankey.tsx                   # Conversion funnel
└── Sparkline.tsx                      # Inline sparkline

src/hooks/
└── useUnifiedAnalytics.ts             # Consolidated data hook
```

### Modified Files
```text
src/components/admin/analytics/AnalyticsTabContainer.tsx
  - Replace entire content with new DatafastAnalyticsDashboard
  - Remove old tab-based structure
```

---

## Technical Considerations

### Performance
- Use React Query for caching and deduplication
- Implement virtual scrolling for long lists
- Lazy load chart libraries (recharts)
- Debounce date range changes

### Data Aggregation
- Pre-aggregate daily metrics in database when possible
- Use existing `daily_metrics` table for historical data
- Calculate bounce rate: sessions with exactly 1 page view

### Responsive Design
- Stack cards vertically on mobile
- Collapse KPI strip to 2x3 grid on tablet
- Full-width charts on all sizes
- Horizontal scroll for long lists on mobile

### Accessibility
- Keyboard navigation for tabs
- ARIA labels for charts
- Color-blind friendly palette
- Screen reader support for tooltips
