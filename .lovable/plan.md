
# User Journey Visualization Enhancements

## Overview

This plan implements four comprehensive visualization enhancements for the User Journeys dashboard, enabling complete visibility into every visitor's path through the marketplace.

---

## Part 1: Individual Journey Timeline View

### Purpose
Allow admins to click on any journey in the live feed and see their complete page-by-page path across ALL sessions, including milestones and time spent.

### New Components

**1. JourneyDetailDialog.tsx**
A dialog that opens when clicking a journey, showing:
- Journey header with visitor info, stage badge, and key metrics
- Session-by-session timeline with expandable sections
- Page views within each session with time stamps
- Milestone markers (signup, NDA signed, etc.) highlighted in the timeline
- User events and listing interactions interspersed chronologically

**2. JourneySessionCard.tsx**
A collapsible card for each session within a journey:
- Session date/time and duration
- Device/browser info
- Traffic source for that session
- Expandable list of page views with:
  - Timestamp
  - Page path/title
  - Time on page
  - Scroll depth indicator

### Data Fetching Updates
Modify `useJourneyDetail` hook in `src/hooks/useUserJourneys.ts` to:
- Fetch ALL sessions for a visitor by matching visitor_id to user_sessions
- Since user_sessions doesn't have visitor_id, we'll use the user_id link (when available) or session_id from the journey record
- Join page_views, user_events, and listing_analytics for complete timeline

### UI Integration
- Add click handler to JourneyLiveFeed items
- Open JourneyDetailDialog with the selected visitor_id
- Show loading state while fetching detailed data

---

## Part 2: Cross-Session Path Analysis

### Purpose
Visualize the most common multi-session paths users take from first visit to conversion.

### New Component

**PathAnalysisChart.tsx**
A Sankey-style flow visualization showing:
- Entry points (landing pages/sources)
- Key navigation nodes (pages visited)
- Exit/conversion points
- Flow width proportional to user count

Since we don't have a Sankey chart library, we'll implement a simplified horizontal flow:
```
Source → Landing → Page 2 → Page 3 → Conversion
Google   /welcome   /explore  /listing   NDA Signed
(45%)    (100%)     (78%)     (52%)      (12%)
```

### Data Structure
Aggregate from page_views across sessions with same visitor_id:
```typescript
interface PathNode {
  page: string;
  count: number;
  percentage: number;
  nextNodes: { page: string; count: number }[];
}
```

### Top Path Sequences
Show the top 10 most common 3-step paths:
1. `/welcome → /explore → /listing/*` (23 users, 18%)
2. `/explore → /listing/* → /signup` (15 users, 12%)
3. etc.

---

## Part 3: Milestone Timing Chart

### Purpose
Visualize conversion velocity - how long it takes users to progress through milestones.

### New Component

**MilestoneVelocityChart.tsx**
A horizontal bar/timeline chart showing:
- Average time from first visit to each milestone
- Distribution of times (median, 25th/75th percentile)
- Comparison between sources (Google users convert faster than Direct)

### Metrics Displayed
| Milestone | Avg Time | Median | Fastest | 
|-----------|----------|--------|---------|
| First Visit → Signup | 2.3 hours | 45 min | 5 min |
| Signup → NDA Signed | 18 hours | 4 hours | 30 min |
| NDA → Connection Request | 3 days | 1 day | 2 hours |

### Visualization Approach
Use a horizontal timeline with dots/markers:
```
First Visit ──●────●────●────●── Conversion
              │    │    │    │
           Signup  NDA  Fee  Connection
           (2h)   (20h) (1d)  (3d)
```

### Data Source
Pull from `user_journeys.milestones` JSONB field and calculate deltas from `first_seen_at`.

---

## Part 4: Cohort Analysis by First-Touch Source

### Purpose
Compare conversion metrics across traffic sources to identify which channels drive the highest-quality visitors.

### New Component

**SourceCohortAnalysis.tsx**
A table/chart comparing cohorts by first_utm_source:
- Total visitors per source
- Conversion rate to each stage
- Average sessions to convert
- Average time to convert

### Visualization
| Source | Visitors | Registered | Qualified | Converted | Avg Sessions |
|--------|----------|------------|-----------|-----------|--------------|
| Google | 145 | 23% | 8% | 3.2% | 4.2 |
| Direct | 89 | 18% | 5% | 1.8% | 6.1 |
| LinkedIn | 34 | 41% | 15% | 8.2% | 2.8 |
| Referral | 67 | 28% | 12% | 5.1% | 3.5 |

### Insight Callout
Highlight actionable insight:
> "LinkedIn visitors are 4.5x more likely to convert than Direct traffic"

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/analytics/journeys/JourneyDetailDialog.tsx` | Main detail view dialog |
| `src/components/admin/analytics/journeys/JourneySessionCard.tsx` | Collapsible session timeline |
| `src/components/admin/analytics/journeys/PathAnalysisChart.tsx` | Cross-session path flow |
| `src/components/admin/analytics/journeys/MilestoneVelocityChart.tsx` | Time-to-milestone visualization |
| `src/components/admin/analytics/journeys/SourceCohortAnalysis.tsx` | Source comparison table |
| `src/hooks/useJourneyTimeline.ts` | Hook for fetching complete journey timeline |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/analytics/journeys/JourneyLiveFeed.tsx` | Add click handler to open detail dialog |
| `src/components/admin/analytics/journeys/UserJourneysDashboard.tsx` | Add new visualization sections |
| `src/hooks/useUserJourneys.ts` | Add path analysis and cohort calculations |

---

## Updated Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Summary Cards (existing)                                        │
│  [Total Journeys] [Registered %] [Converted %] [Avg Sessions]   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────┬───────────────────────────────┐
│  Stage Funnel (existing)        │  Source Cohort Analysis (NEW) │
│  [Visual funnel chart]          │  [Comparison table with rates]│
└─────────────────────────────────┴───────────────────────────────┘
┌─────────────────────────────────┬───────────────────────────────┐
│  Milestone Velocity Chart (NEW) │  Attribution Table (existing) │
│  [Timeline to conversion]       │  [Top traffic sources]        │
└─────────────────────────────────┴───────────────────────────────┘
┌─────────────────────────────────┬───────────────────────────────┐
│  Path Analysis (NEW)            │  Top Landing Pages (existing) │
│  [Common journey paths]         │  [Entry page rankings]        │
└─────────────────────────────────┴───────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Live Journey Feed (existing - now clickable)                    │
│  [Click any journey to open detailed timeline view]             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Details

### Journey Timeline Data Query
```sql
-- Get all page views for sessions linked to a visitor
SELECT 
  pv.*,
  us.started_at as session_start,
  us.device_type,
  us.browser,
  us.referrer as session_referrer
FROM page_views pv
JOIN user_sessions us ON pv.session_id = us.session_id
WHERE us.user_id = (
  SELECT user_id FROM user_journeys WHERE visitor_id = $visitor_id
)
ORDER BY pv.created_at ASC
```

### Path Analysis Aggregation
Process page_views on the frontend to build path sequences:
```typescript
// Group by session, then extract page sequence
const sessionPaths = sessions.map(s => 
  pageViews
    .filter(pv => pv.session_id === s.id)
    .map(pv => pv.page_path)
);

// Count 3-step sequences
const pathCounts = new Map<string, number>();
sessionPaths.forEach(path => {
  for (let i = 0; i < path.length - 2; i++) {
    const sequence = `${path[i]} → ${path[i+1]} → ${path[i+2]}`;
    pathCounts.set(sequence, (pathCounts.get(sequence) || 0) + 1);
  }
});
```

### Milestone Timing Calculation
```typescript
// Calculate time deltas from milestones JSONB
const calculateMilestoneTimings = (journeys: UserJourney[]) => {
  const timings = {
    toSignup: [] as number[],
    toNda: [] as number[],
    toConnection: [] as number[],
  };
  
  journeys.forEach(j => {
    const first = new Date(j.first_seen_at).getTime();
    if (j.milestones.signup_at) {
      timings.toSignup.push(
        (new Date(j.milestones.signup_at).getTime() - first) / 3600000
      );
    }
    // ... similar for other milestones
  });
  
  return {
    avgToSignup: average(timings.toSignup),
    medianToSignup: median(timings.toSignup),
    // etc.
  };
};
```

---

## Expected Visual Outcome

After implementation, the Journeys tab will provide:

1. **Clickable Journey Feed** - Click any visitor to see their complete path
2. **Individual Timeline View** - Page-by-page breakdown across sessions with milestones highlighted
3. **Path Analysis** - Common 3-step journeys showing how users navigate
4. **Conversion Velocity** - Time metrics from first visit to each milestone
5. **Source Comparison** - Which channels drive highest-quality visitors

This gives you complete visibility into every single user path through your marketplace.
