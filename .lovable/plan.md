
# Plan: Global Filter System for Intelligence Center

## Overview
Implement a datafast.st-style global filtering system that allows clicking any dimension (channel, referrer, country, page, etc.) to filter the entire dashboard. A filter chip appears at the top, and all cards re-calculate their data showing only the filtered subset (e.g., "Signups from Google", "Users from LinkedIn", "Visitors who viewed /marketplace").

---

## User Experience Flow

```text
1. User clicks "Google" in the Referrer tab of Sources card
2. Filter chip appears at top: "Referrer is Google" [x]
3. ALL dashboard data updates:
   - KPIs show only Google-referred visitors/signups/connections
   - Chart shows only Google traffic over time
   - Geography shows where Google users are located
   - Pages shows what Google users viewed
   - Users tab shows Google-attributed users
4. User can add MORE filters (e.g., + Country = "United States")
5. Clicking [x] on chip removes that filter
```

---

## Technical Architecture

### New Filter State Management

Create a new context/hook to manage global filter state across all cards:

**New file: `src/hooks/useAnalyticsFilters.ts`**

```text
interface AnalyticsFilter {
  type: 'channel' | 'referrer' | 'country' | 'city' | 'page' | 'browser' | 'os' | 'device' | 'campaign';
  value: string;
  label: string;  // Human-readable label
  icon?: string;  // Optional favicon or icon
}

interface AnalyticsFiltersContext {
  filters: AnalyticsFilter[];
  addFilter: (filter: AnalyticsFilter) => void;
  removeFilter: (type: string) => void;
  clearFilters: () => void;
  hasFilter: (type: string) => boolean;
}
```

### Modified Data Flow

Current flow:
```text
useUnifiedAnalytics(timeRangeDays) → returns ALL data → cards display subsets
```

New flow:
```text
useUnifiedAnalytics(timeRangeDays, filters) → returns FILTERED data → cards display filtered subsets
```

The hook will accept an optional `filters` array and apply them to ALL queries/calculations.

---

## Implementation Phases

### Phase 1: Filter Context & UI

**Files to create:**
| File | Purpose |
|------|---------|
| `src/contexts/AnalyticsFiltersContext.tsx` | React context for global filter state |
| `src/components/admin/analytics/datafast/FilterChips.tsx` | Filter chip display with remove buttons |
| `src/components/admin/analytics/datafast/FilterModal.tsx` | Modal for expanding "Details" with full list + filter buttons |

**FilterChips component:**
- Displays active filters as chips in the header
- Each chip shows icon + "Referrer is Google" + [x] button
- Clicking [x] removes that filter
- "Clear all" button when multiple filters

### Phase 2: Make Cards Clickable

**Files to modify:**
| File | Change |
|------|--------|
| `SourcesCard.tsx` | Add onClick to rows → `addFilter({ type: 'channel', value: 'Google' })` |
| `GeographyCard.tsx` | Add onClick to country/city rows → filter by geo |
| `PagesCard.tsx` | Add onClick to page rows → filter by page |
| `TechStackCard.tsx` | Add onClick to browser/os/device rows |

Each row gets:
```typescript
onClick={() => addFilter({ 
  type: 'referrer', 
  value: row.domain, 
  label: `Referrer is ${row.domain}`,
  icon: row.favicon 
})}
```

### Phase 3: Filter Logic in useUnifiedAnalytics

**Modify: `src/hooks/useUnifiedAnalytics.ts`**

Add filter parameter and apply filtering to the raw sessions before any aggregation:

```typescript
export function useUnifiedAnalytics(
  timeRangeDays: number = 30, 
  filters: AnalyticsFilter[] = []
) {
  // ... fetch data ...
  
  // APPLY FILTERS to sessions
  let filteredSessions = uniqueSessions;
  
  filters.forEach(filter => {
    if (filter.type === 'referrer') {
      filteredSessions = filteredSessions.filter(s => 
        extractDomain(s.referrer) === filter.value
      );
    }
    if (filter.type === 'channel') {
      filteredSessions = filteredSessions.filter(s => 
        categorizeChannel(s.referrer, s.utm_source, s.utm_medium) === filter.value
      );
    }
    if (filter.type === 'country') {
      filteredSessions = filteredSessions.filter(s => s.country === filter.value);
    }
    // ... more filter types
  });
  
  // All subsequent aggregations use filteredSessions instead of uniqueSessions
}
```

### Phase 4: Details Modal with Search

**New component: `FilterModal.tsx`**

When clicking "Details" at bottom of any card:
- Opens modal with full list (not limited to top 8)
- Search input at top
- Each row has filter icon button on hover
- Clicking filter icon adds that filter + closes modal
- Columns: Name, Visitors, Signups, Connections

**Similar to datafast screenshot:**
```text
┌──────────────────────────────────────────────────┐
│  Referrer                    [Search...]      X  │
├──────────────────────────────────────────────────┤
│  Referrer           Visitors    Connections      │
│  ──────────────────────────────────────────────  │
│  🐦 X                 3.8k         $1,365    [⧉] │
│  ↩️ Direct/None       2.3k         $3,497    [⧉] │
│  🧑 marclou.com       2.1k         $2,600    [⧉] │
│  🔎 Google            1.8k    [▼]  $3,315    [⧉] │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Phase 5: Dashboard Integration

**Modify: `DatafastAnalyticsDashboard.tsx`**

```typescript
import { AnalyticsFiltersProvider, useAnalyticsFilters } from "@/contexts/AnalyticsFiltersContext";
import { FilterChips } from "./FilterChips";

export function DatafastAnalyticsDashboard() {
  return (
    <AnalyticsFiltersProvider>
      <DashboardContent />
    </AnalyticsFiltersProvider>
  );
}

function DashboardContent() {
  const { filters } = useAnalyticsFilters();
  const { data, isLoading } = useUnifiedAnalytics(timeRangeDays, filters);
  
  return (
    <div>
      {/* Header with time selector */}
      
      {/* Filter Chips */}
      {filters.length > 0 && <FilterChips />}
      
      {/* Rest of dashboard */}
    </div>
  );
}
```

---

## Files to Create

| File | Description |
|------|-------------|
| `src/contexts/AnalyticsFiltersContext.tsx` | Global filter state context |
| `src/components/admin/analytics/datafast/FilterChips.tsx` | Active filter chips display |
| `src/components/admin/analytics/datafast/FilterModal.tsx` | Expandable details modal with filter capability |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Add filters parameter, apply filtering before aggregation |
| `src/components/admin/analytics/datafast/DatafastAnalyticsDashboard.tsx` | Wrap in provider, pass filters to hook, show FilterChips |
| `src/components/admin/analytics/datafast/SourcesCard.tsx` | Add click handlers for filtering, add "Details" button |
| `src/components/admin/analytics/datafast/GeographyCard.tsx` | Add click handlers for geo filtering |
| `src/components/admin/analytics/datafast/PagesCard.tsx` | Add click handlers for page filtering |
| `src/components/admin/analytics/datafast/TechStackCard.tsx` | Add click handlers for tech filtering |
| `src/components/admin/analytics/datafast/ConversionCard.tsx` | Filter the users/journey tabs by active filters |
| `src/components/admin/analytics/datafast/AnalyticsCard.tsx` | Add optional "Details" footer button prop |

---

## Filter Types Supported

| Filter Type | Example | Applied To |
|-------------|---------|------------|
| `channel` | "Organic Search" | Sessions by categorizeChannel() |
| `referrer` | "google.com" | Sessions by extractDomain(referrer) |
| `country` | "United States" | Sessions by country field |
| `city` | "New York" | Sessions by city field |
| `page` | "/marketplace" | Sessions that viewed this page |
| `browser` | "Chrome" | Sessions by browser field |
| `os` | "Mac OS" | Sessions by os field |
| `device` | "Mobile" | Sessions by device_type field |
| `campaign` | "spring-promo" | Sessions by utm_campaign field |

---

## Visual Design (Matching Datafast Style)

**Filter Chip:**
```text
┌─────────────────────────────────┐
│ 🔎 Referrer is Google        ✕ │
└─────────────────────────────────┘
```

- Background: `hsl(220 15% 95%)` / dark: `hsl(220 15% 20%)`
- Text: `text-sm font-medium`
- Icon: Favicon from referrer or channel icon
- Close button: `✕` with hover state

**Row Click Affordance:**
- Hover state already exists on rows
- Add subtle filter icon on hover (like datafast)
- Tooltip: "Filter by Google"

---

## Verification Steps

1. Click "Google" in Referrer tab → filter chip appears
2. All KPIs update to show only Google traffic
3. Chart shows only Google visitors over time
4. Geography shows where Google users are from
5. Pages shows what Google users viewed
6. Users tab shows only Google-attributed users
7. Click [x] to remove filter → data returns to full view
8. Add multiple filters (e.g., Google + United States) → compound filtering works
9. Click "Details" on any card → modal opens with full searchable list
10. Filter from modal → modal closes, filter applied

