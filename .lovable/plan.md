
# Historical Data Backfill Strategy for Intelligence Center

## Current State Analysis

### Data Availability (Good News!)
Your database already contains substantial historical data:

| Table | Records | Date Range |
|-------|---------|------------|
| user_sessions | 46,494 | Jul 21, 2025 → Feb 2, 2026 (7+ months) |
| page_views | 49,528 | Jul 21, 2025 → Feb 2, 2026 |
| user_events | 3,993 | Jul 21, 2025 → Jan 30, 2026 |
| connection_requests | 519 | Jun 10, 2025 → Jan 30, 2026 |
| daily_metrics | 0 | **EMPTY - needs backfill** |

### Data Quality Issues

1. **Browser/OS parsing gap**: 9,073 sessions have `user_agent` but NULL `browser`/`os`/`device_type`
   - These sessions came through before the frontend parsing was added
   - The user_agent strings ARE stored and can be parsed retroactively

2. **No IP addresses for most sessions**: 14,557 sessions have no IP address stored
   - Geolocation cannot be enriched for these
   - Going forward, IPs are captured by the edge function

3. **Daily metrics table is empty**: KPI sparklines and historical charts show zeros
   - The `aggregate-daily-metrics` edge function exists but was never run historically

---

## Backfill Strategy (3 Phases)

### Phase 1: Backfill Daily Metrics Table (Immediate Impact)

Create a new edge function that runs the existing `aggregate-daily-metrics` function for each day in a date range.

```text
Action: Create `backfill-daily-metrics` edge function
Purpose: Loop from startDate to endDate, calling aggregate-daily-metrics for each day
Result: Populates daily_metrics table with historical data
```

**Implementation:**
```typescript
// supabase/functions/backfill-daily-metrics/index.ts
// Accepts { startDate: "2025-07-21", endDate: "2026-02-01" }
// Loops day by day, invoking aggregate-daily-metrics for each
// Includes 500ms delay between calls to avoid rate limits
```

**Expected Outcome:**
- All KPI sparklines show real 7-day trends
- Daily chart shows historical visitor/connection patterns
- Week-over-week comparisons become accurate

---

### Phase 2: Parse User-Agent Strings for Historical Sessions

Create an edge function to retroactively parse user-agent strings and update browser/OS/device fields.

```text
Action: Create `enrich-session-metadata` edge function
Purpose: Parse user_agent strings for sessions missing browser/OS data
Target: 9,073 sessions with user_agent but no browser field
```

**User-Agent Parsing Logic:**
```typescript
function parseUserAgent(ua: string) {
  const browser = 
    ua.includes('Edg') ? 'Edge' :
    ua.includes('Chrome') ? 'Chrome' :
    ua.includes('Firefox') ? 'Firefox' :
    ua.includes('Safari') ? 'Safari' :
    ua.includes('Opera') || ua.includes('OPR') ? 'Opera' : 'Unknown';
    
  const os =
    ua.includes('Windows') ? 'Windows' :
    ua.includes('Mac') ? 'macOS' :
    ua.includes('Android') ? 'Android' :
    ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' :
    ua.includes('Linux') ? 'Linux' : 'Unknown';
    
  const device = /Mobile|Android|iPhone|iPad/i.test(ua) 
    ? (/iPad/i.test(ua) ? 'tablet' : 'mobile') 
    : 'desktop';
    
  return { browser, os, device };
}
```

**Expected Outcome:**
- Tech Stack card shows accurate browser/OS distribution
- User detail panels show device information
- Activity breakdowns by device type become available

---

### Phase 3: Geolocation Enrichment (Limited Scope)

For the 263 sessions that DO have IP addresses but missing country data, we can enrich with geolocation.

```text
Action: Create `enrich-geo-data` edge function
Purpose: Call ip-api.com for sessions with IP but no country
Target: ~263 sessions (limited due to IP availability)
Limitation: 14,557 sessions have no stored IP - cannot enrich
```

**Rate Limit Consideration:**
- ip-api.com allows 45 requests/minute (free tier)
- For 263 records, process in batches with delays
- Estimated runtime: ~6 minutes

**Expected Outcome:**
- Geography card shows more data for recent sessions
- Country/City breakdowns improve marginally
- Going forward, all new sessions get geolocation automatically

---

## Implementation Files

### New Edge Functions to Create

```text
supabase/functions/
├── backfill-daily-metrics/
│   └── index.ts           # Loops through dates, calls aggregate function
├── enrich-session-metadata/
│   └── index.ts           # Parses user_agent, updates browser/OS
└── enrich-geo-data/
    └── index.ts           # Fetches geolocation for sessions with IP
```

### Updates Required

```text
supabase/config.toml
  - Add new function entries for the backfill functions
```

---

## Execution Plan

### Step 1: Deploy Backfill Functions
1. Create all three edge functions
2. Deploy to Supabase

### Step 2: Run Daily Metrics Backfill (Priority)
```bash
# Call with date range covering all historical data
curl -X POST .../backfill-daily-metrics \
  -d '{"startDate": "2025-07-21", "endDate": "2026-02-02"}'
```
- Processes 196 days
- ~100 seconds total (500ms per day)
- Immediate dashboard improvement

### Step 3: Run User-Agent Parsing
```bash
# Parse all sessions with user_agent but missing browser
curl -X POST .../enrich-session-metadata \
  -d '{"batchSize": 500}'
```
- Processes 9,073 sessions in batches
- ~2-3 minutes total
- Tech stack accuracy improves dramatically

### Step 4: Run Geo Enrichment (Optional)
```bash
# Enrich sessions with IP but no country
curl -X POST .../enrich-geo-data \
  -d '{"batchSize": 45}'
```
- Processes 263 sessions
- ~6 minutes (respecting rate limits)
- Marginal geography improvement

---

## Expected Results After Backfill

| Metric | Before | After |
|--------|--------|-------|
| KPI Sparklines | All zeros | Real 7-day trends |
| Daily Chart | Empty or sparse | 7+ months of data |
| Browser Distribution | 57% unknown | ~95% known |
| OS Distribution | 57% unknown | ~95% known |
| Country Data | 4% known | 4-5% known (IP limitation) |
| Week-over-week | Inaccurate | Accurate comparisons |

---

## Limitations & Honest Assessment

### What CAN Be Fixed:
- Daily metrics aggregation (complete fix)
- Browser/OS/device parsing (complete fix for sessions with user_agent)
- Geolocation for sessions with stored IP (partial fix)

### What CANNOT Be Fixed:
- Sessions without stored IP addresses (14,557 records) - no geolocation possible
- Historical data before tracking was implemented (Jul 21, 2025 is earliest)
- User journeys for anonymous visitors from before visitor_id tracking

### Going Forward:
The current tracking implementation captures all necessary data:
- Browser, OS, device parsed on frontend before sending
- IP address captured by edge function for geolocation
- Visitor ID enables cross-session journey tracking

All new sessions will have complete data. The backfill addresses the historical gap.

---

## Technical Details

### Backfill Daily Metrics Function
```typescript
// Loops through date range
// For each date, calculates:
// - total_sessions from user_sessions
// - active_users from distinct user_ids
// - page_views count
// - bounce_rate (sessions with 1 page view)
// - connection_requests count
// - avg_session_duration
// Upserts to daily_metrics table
```

### User-Agent Parser Function
```typescript
// Queries sessions WHERE browser IS NULL AND user_agent IS NOT NULL
// Batch processes 500 at a time
// Updates browser, os, device_type columns
// Uses simple string matching (same as frontend)
```

### Geo Enrichment Function
```typescript
// Queries sessions WHERE country IS NULL AND ip_address IS NOT NULL
// Processes in batches of 45 (respecting ip-api rate limit)
// Adds 1.5s delay between batches
// Updates country, country_code, city, region, timezone
```

---

## Security Considerations

All backfill functions will:
- Require service role key (not publicly accessible)
- Log progress for monitoring
- Handle errors gracefully without data corruption
- Support resumption if interrupted
