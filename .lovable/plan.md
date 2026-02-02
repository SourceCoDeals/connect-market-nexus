
# Intelligence Center Enhancement Plan - Phase 2

## Current State Assessment

### What's Implemented from Original Plan
1. **KPI Strip** - 6 metrics with sparklines and trends
2. **Daily Visitors Chart** - Dual-axis bar+line chart with tooltips
3. **Sources Card** - Channel/Referrer/Campaign/Keyword tabs with donut chart
4. **Geography Card** - Map/Country/Region/City tabs with choropleth
5. **Pages Card** - Page/Entry/Exit tabs
6. **Tech Stack Card** - Browser/OS/Device tabs with progress bars
7. **Conversion Card** - Simplified funnel (3 stages) + basic Top Users list
8. **Floating Globe Toggle** - Opens fullscreen Mapbox overlay

### Critical Gaps Identified

**1. Conversion Card is severely underpowered:**
- Only 3 funnel stages (Visitors, Registered, Connected) - missing NDA and Fee Agreement milestones
- No "Journey" tab with configurable event filtering
- No rich user detail panel when clicking a user
- No activity heatmap per user
- No "time to complete" tracking

**2. Tooltips are basic:**
- Missing "Top Sources" and "Top Countries" in funnel hover
- Missing dual-bar visualization (Visitors + Connections side-by-side)
- No "Step value" equivalent metrics

**3. User Detail Panel missing:**
- Datafa.st shows: avatar, location, device, OS, browser, pageviews count, time to completion, activity calendar heatmap, chronological event timeline
- We have none of this - clicking a user should open a rich modal

**4. Journey Tab not implemented:**
- Should allow selecting a goal event (e.g., "connection_request")
- Shows all users who completed that journey
- Displays time to complete, source, completion date
- Filterable by different goal types

**5. Source/Geography bar visualizations missing:**
- Each row should have a proportional bar showing relative magnitude
- Dual-colored bars for Visitors vs Connections comparison

**6. Real data issues:**
- Funnel needs to query actual NDA signed / Fee Agreement signed counts from connection_requests
- Time on page data exists but not displayed
- User pageview counts not calculated

---

## Enhancement Plan

### Section 1: Enhanced Funnel with 6 Marketplace Stages

Replace the simplified 3-stage funnel with the complete M&A marketplace journey:

| Stage | Data Source | Description |
|-------|-------------|-------------|
| 1. Landing | Total unique sessions | First touchpoint |
| 2. Marketplace | Sessions with /marketplace page view | Engaged with listings |
| 3. Registered | Profiles created in period | Created account |
| 4. NDA Signed | connection_requests.lead_nda_signed = true | Signed NDA |
| 5. Fee Agreement | connection_requests.lead_fee_agreement_signed = true | Signed fee agreement |
| 6. Connected | connection_requests.status = any | Sent connection request |

Funnel visualization shows waterfall bars with drop-off percentages between stages.

Hover tooltip shows:
- Stage name
- Count
- Drop-off percentage
- Top 3 sources at this stage
- Top 3 countries at this stage

---

### Section 2: Rich User Tab with Detail Panel

**User List Columns:**
- Avatar (DiceBear cartoon based on name)
- Name (or animal name for anonymous)
- Location with flag
- Device + OS + Browser icons
- Source (with favicon)
- Time to Connect (if converted)
- Last Seen timestamp
- Activity dots timeline (last 7 days)

**User Detail Modal (slide-up panel on click):**

Left sidebar:
- Large avatar
- Full name or generated animal name
- Country + City with flag
- Device type + resolution
- OS name
- Browser name
- "Add parameters" link (future: custom tagging)

Center timeline:
- Chronological event list with timestamps
- Events: "Viewed page /path", "Triggered event: marketplace_filter_applied", "Found site via referrer Google"
- Expandable parameters per event
- Keyword probability breakdown (for organic search visitors)

Right stats panel:
- Total pageviews
- Total time on site
- Time to conversion (if applicable)
- Activity heatmap calendar (past 6 months)
- AI Summary (future: "coming soon...")

---

### Section 3: Journey Tab with Event Filtering

**Goal Event Selector:**
- Dropdown to choose goal: "connection_request", "nda_signed", "fee_agreement_signed", "viewed_listing", etc.
- Shows only users who completed the selected goal

**Journey Table Columns:**
- Visitor (avatar + name + location + device icons)
- Source (with favicon)
- Time to Complete (formatted as "2 minutes", "17 days", etc.)
- Completed At (timestamp)
- Activity dots

**Click row opens User Detail Modal with full timeline**

---

### Section 4: Enhanced Tooltips Across All Cards

**Sources Card (Channel/Referrer) hover:**
```text
Referral
Visitors     3.6k
Connections  42

TOP SOURCES
marclou.com    53%
lovable.dev    15%
linkedin.com   8%

Conv. Rate: 1.16%
```

**Geography Card hover:**
```text
United States
Visitors     847
Connections  23

TOP CITIES
New York       28%
Los Angeles    19%
Chicago        12%

Conv. Rate: 2.7%
```

**Funnel Step hover:**
```text
NDA Signed
Count: 234
Drop-off: -33%

TOP SOURCES
Direct        45%
Google        28%
LinkedIn      15%

TOP COUNTRIES
United States  42%
United Kingdom 18%
Canada         12%

Conversion from start: 9.8%
```

---

### Section 5: Visual Enhancements

**Dual-bar rows in lists:**
Each row shows proportional background bars:
- Blue bar = Visitors (relative to max)
- Coral bar overlay = Connections (relative to max)

Example row appearance:
```text
[Google favicon] Google           [========coral bar=======][blue bar===] 1.8k
```

**Progress indicators in Pages/Tech cards:**
Each row gets a thin progress bar underneath showing relative proportion.

**Activity dot timeline:**
7 dots representing last 7 days, colored by activity level:
- Gray = no activity
- Light blue = low activity (1-2 pages)
- Medium blue = medium (3-5 pages)
- Coral = high activity (6+ pages)

---

### Section 6: Goals Tab (Milestone Tracking)

Track completed business milestones:

| Goal | Count | Conversion |
|------|-------|------------|
| Viewed Marketplace | 892 | 37.2% of visitors |
| Registered Account | 234 | 26.2% of marketplace viewers |
| Signed NDA | 56 | 23.9% of registered |
| Signed Fee Agreement | 34 | 60.7% of NDA signed |
| Sent Connection | 28 | 82.4% of fee agreement |

Each goal row is clickable to see the list of users who completed it.

---

### Section 7: Real Data Integration

**Fix missing data:**

1. **Funnel Stages** - Add queries for:
   - Sessions with /marketplace page view
   - Count of lead_nda_signed = true
   - Count of lead_fee_agreement_signed = true

2. **User Page View Count** - Calculate from page_views table grouped by user_id

3. **Time to Convert** - Calculate difference between first session and connection_request created_at

4. **Activity Heatmap** - Aggregate page_views by date per user for calendar visualization

5. **Event Timeline** - Combine page_views and user_events into chronological list per user

---

## Technical Implementation

### New/Modified Files

**1. useUnifiedAnalytics.ts enhancements:**
- Add funnel stages for NDA and Fee Agreement
- Add user activity data (pageviews, time_on_site)
- Add journey completion data

**2. New: useUserDetail.ts**
- Fetches complete user timeline (page_views + events)
- Returns profile data, geo data, tech stack, activity heatmap

**3. ConversionCard.tsx complete rewrite:**
- 4 tabs: Goals | Funnel | Users | Journey
- Goals: milestone achievement list
- Funnel: 6-stage waterfall with rich tooltips
- Users: searchable user list with detail panel
- Journey: goal-filtered user list

**4. New: UserDetailPanel.tsx**
- Slide-up modal with 3-column layout
- Chronological event timeline
- Activity heatmap calendar
- Stats summary

**5. New: ActivityDots.tsx**
- 7-dot timeline component showing daily activity

**6. AnalyticsTooltip.tsx enhancements:**
- Support for "TOP SOURCES" and "TOP COUNTRIES" sections
- Dual-row value displays

**7. SourcesCard.tsx / GeographyCard.tsx:**
- Add proportional background bars to each row

---

## Implementation Priority

| Priority | Component | Impact |
|----------|-----------|--------|
| P0 | 6-stage funnel with real data | Critical for M&A intelligence |
| P0 | User list with detail panel | Core Datafa.st feature |
| P1 | Journey tab with goal filtering | High-value conversion analysis |
| P1 | Enhanced tooltips everywhere | Polish and data density |
| P2 | Activity dots timeline | Engagement visualization |
| P2 | Goals tab | Milestone tracking |
| P3 | Dual-bar proportional rows | Visual enhancement |
| P3 | Activity heatmap calendar | Future-forward feature |

---

## Data Schema Requirements

All data is already available:
- `connection_requests.lead_nda_signed` / `lead_fee_agreement_signed` for funnel stages
- `page_views` for user timeline events
- `user_events` for custom events (marketplace_filter_applied, etc.)
- `user_journeys` for first-touch attribution and milestone tracking
- `user_sessions` for geo, device, browser, OS data
- `profiles` for user identity

No database migrations required.

---

## Expected Outcome

After implementation, the Intelligence Center will match and exceed Datafa.st capabilities with:

1. **6-stage M&A funnel** showing complete buyer journey from landing to connection
2. **Clickable user profiles** with full event timeline and activity heatmap
3. **Journey analysis** to see exactly which users completed specific goals
4. **Rich tooltips** with multi-dimensional breakdowns (top sources, countries)
5. **Visual data density** with proportional bars and activity indicators
6. **100% real data** - no placeholders, all from live marketplace tables

This transforms the dashboard from a basic analytics view into a true buyer intelligence command center for M&A decision-making.
