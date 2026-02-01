
# Strategic Cleanup & User Journey Analytics Enhancement

## Part 1: Cleanup - Remove RB2B, Warmly & Companies Tab

The following components will be removed since they're not needed:

### Files to Delete
| File/Directory | Description |
|----------------|-------------|
| `src/components/admin/analytics/companies/` | Entire folder (5 files) |
| `src/hooks/useVisitorCompanies.ts` | Visitor companies hook |
| `supabase/functions/webhook-visitor-identification/` | Webhook receiver |

### Files to Modify
| File | Change |
|------|--------|
| `index.html` | Remove RB2B script (lines 108-138) and Warmly script (lines 140-141) |
| `src/components/admin/analytics/AnalyticsTabContainer.tsx` | Remove Companies tab and import |
| `supabase/config.toml` | Remove webhook-visitor-identification from verify_jwt = false list |

### Database Cleanup
```sql
DROP TABLE IF EXISTS public.visitor_companies;
```

---

## Part 2: Strategic Analysis - Current State of User Journey Tracking

### What's Already Working

| Capability | Status | Data Location |
|------------|--------|---------------|
| Session creation with geo-IP | Active | `user_sessions` |
| Page views with scroll depth | Active | `page_views` |
| Session heartbeat/duration | Active | `user_sessions.session_duration_seconds` |
| Referrer tracking | Active | 93% of sessions have referrer |
| UTM parameter capture | Active | Stored but 0% populated (no UTMs on traffic) |
| GA4 Client ID capture | Code exists | **0% captured** - GA4 cookie not being read |
| First-touch attribution | Code exists | **0% populated** - localStorage not syncing |
| Search analytics | Active | `search_analytics` |
| Listing interactions | Active | `listing_analytics` |
| User events | Active | `user_events` |

### Critical Gaps Identified

1. **GA4 Client ID Not Populating** - The `getGA4ClientId()` function looks for `_ga` cookie but GA4 cookie may have different format or not set yet when tracking fires

2. **First-Touch Attribution Always Empty** - The localStorage-based first-touch system isn't being initialized on first visit

3. **No Cross-Domain Journey Stitching** - When users come from sourcecodeals.com → marketplace, we can't connect the sessions

4. **Page Sequence Only Per-Session** - We reconstruct journeys from `page_views` but it's expensive and not real-time

5. **Missing Conversion Funnel Events** - Key conversion milestones (NDA signed, fee agreement, connection request) tracked but not easily correlated to journey

---

## Part 3: Enhanced User Journey Architecture

### New `user_journeys` Table

Create a dedicated table to track complete user journeys across sessions:

```sql
CREATE TABLE user_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity (can link anonymous → authenticated)
  visitor_id TEXT NOT NULL,           -- Persistent across sessions (localStorage UUID)
  ga4_client_id TEXT,                 -- For GA4 data stitching
  user_id UUID REFERENCES profiles(id), -- NULL until authenticated
  
  -- First Touch (never changes after set)
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  first_landing_page TEXT,
  first_referrer TEXT,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_device_type TEXT,
  first_country TEXT,
  first_city TEXT,
  
  -- Latest Session Info (updated on each visit)
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_session_id TEXT,
  last_page_path TEXT,
  
  -- Aggregates
  total_sessions INTEGER DEFAULT 1,
  total_page_views INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  
  -- Conversion Milestones (JSONB for flexibility)
  milestones JSONB DEFAULT '{}'::jsonb,
  -- Example: {"signup_at": "...", "nda_signed_at": "...", "first_connection_at": "..."}
  
  -- Journey Status
  journey_stage TEXT DEFAULT 'anonymous',
  -- Values: anonymous, registered, engaged, qualified, converted
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_journeys_visitor ON user_journeys(visitor_id);
CREATE INDEX idx_user_journeys_ga4 ON user_journeys(ga4_client_id) WHERE ga4_client_id IS NOT NULL;
CREATE INDEX idx_user_journeys_user ON user_journeys(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_journeys_stage ON user_journeys(journey_stage);
```

### New Frontend Hook: `useVisitorIdentity`

Create a persistent visitor identity that survives across sessions:

```typescript
// src/hooks/useVisitorIdentity.ts
const VISITOR_ID_KEY = 'sourceco_visitor_id';
const FIRST_TOUCH_KEY = 'sourceco_first_touch';

export function useVisitorIdentity() {
  // Get or create persistent visitor ID
  const visitorId = useMemo(() => {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  }, []);

  // Capture first-touch attribution on FIRST visit only
  useEffect(() => {
    const existing = localStorage.getItem(FIRST_TOUCH_KEY);
    if (!existing) {
      const firstTouch = {
        landing_page: window.location.pathname,
        referrer: document.referrer || null,
        utm_source: new URLSearchParams(window.location.search).get('utm_source'),
        utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
        utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
        timestamp: new Date().toISOString(),
        ga4_client_id: getGA4ClientId(),
      };
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
    }
  }, []);

  return { visitorId, getFirstTouch: () => JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || '{}') };
}
```

### Updated Session Tracking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ARRIVES                             │
│  (sourcecodeals.com → marketplace.sourcecodeals.com/welcome)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. useVisitorIdentity initializes                              │
│     - Get/create visitor_id (localStorage UUID)                 │
│     - Capture first-touch if new visitor                        │
│     - Read GA4 client ID from cookie                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. track-session edge function                                 │
│     - Creates user_session with geo data                        │
│     - Upserts user_journeys (create or update)                  │
│     - Links visitor_id → session_id                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. On Auth (login/signup)                                      │
│     - Update user_journeys.user_id                              │
│     - Merge anonymous journey with registered identity          │
│     - Record milestone: signup_at                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. On Key Actions                                              │
│     - NDA signed → milestone: nda_signed_at                     │
│     - Fee agreement → milestone: fee_agreement_at               │
│     - Connection request → milestone: first_connection_at       │
│     - Update journey_stage accordingly                          │
└─────────────────────────────────────────────────────────────────┘
```

### New Intelligence Center: "User Journeys" Tab

Replace the removed Companies tab with a **User Journeys** dashboard:

**Features:**
1. **Journey Timeline Visualization** - See every page a visitor viewed across all sessions
2. **Conversion Funnel** - Anonymous → Registered → Engaged → Qualified → Converted
3. **Attribution Analysis** - Which sources drive complete journeys vs bounces
4. **Journey Stage Distribution** - How many visitors at each stage
5. **Time-to-Conversion** - Average days from first visit to conversion milestones

### Fix GA4 Client ID Capture

The current `getGA4ClientId()` function has issues. Updated approach:

```typescript
function getGA4ClientId(): string | null {
  try {
    // Try standard _ga cookie format
    const gaCookie = document.cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
    if (gaCookie) return gaCookie[1];
    
    // Try _ga_MEASUREMENTID format (newer GA4)
    const ga4Cookie = document.cookie.match(/_ga_[A-Z0-9]+=[^;]+/);
    if (ga4Cookie) {
      const parts = ga4Cookie[0].split('.');
      if (parts.length >= 3) return `${parts[2]}.${parts[3]}`;
    }
    
    // Fallback: wait for gtag to be ready and get client_id
    if (window.gtag) {
      return new Promise((resolve) => {
        window.gtag('get', 'G-N5T31YT52K', 'client_id', resolve);
      });
    }
    
    return null;
  } catch {
    return null;
  }
}
```

---

## Part 4: Implementation Files

### Files to Create
| File | Purpose |
|------|---------|
| `src/hooks/useVisitorIdentity.ts` | Persistent visitor ID & first-touch capture |
| `src/components/admin/analytics/journeys/UserJourneysDashboard.tsx` | Main journeys dashboard |
| `src/components/admin/analytics/journeys/JourneyTimeline.tsx` | Individual journey visualization |
| `src/components/admin/analytics/journeys/JourneyStageFunnel.tsx` | Stage distribution chart |
| `src/components/admin/analytics/journeys/AttributionTable.tsx` | Source attribution analysis |
| `supabase/migrations/xxx_user_journeys.sql` | New table creation |

### Files to Modify
| File | Change |
|------|---------|
| `src/hooks/use-initial-session-tracking.ts` | Add visitor_id, fix GA4 client ID capture |
| `supabase/functions/track-session/index.ts` | Upsert user_journeys record |
| `src/components/SessionTrackingProvider.tsx` | Integrate useVisitorIdentity |
| `src/lib/ga4.ts` | Fix getGA4ClientId function |
| `src/components/admin/analytics/AnalyticsTabContainer.tsx` | Replace Companies with Journeys tab |

---

## Part 5: Expected Outcomes

After implementation, you'll have:

| Capability | Before | After |
|------------|--------|-------|
| Cross-session visitor tracking | No | Yes - via persistent visitor_id |
| GA4 data stitching | 0% | ~95% via proper cookie reading |
| First-touch attribution | 0% | 100% for all new visitors |
| Journey stage visibility | None | Full funnel view |
| Time-to-conversion metrics | None | Days from first visit to each milestone |
| Anonymous → registered linking | Manual | Automatic on auth |

**Example Journey You'll See:**
```
Visitor: azure-wolf-42 (visitor_id: abc123)
├── Session 1: Jan 28 via Google Organic
│   ├── /welcome (landed)
│   ├── /explore
│   └── /listing/xyz (viewed)
├── Session 2: Jan 29 via Direct
│   ├── / 
│   ├── /signup (milestone: registered)
│   └── /explore
├── Session 3: Jan 30 - Now linked to "John Smith" (user_id: xyz)
│   ├── /listing/abc (viewed)
│   ├── /nda (milestone: nda_signed)
│   └── /connection-request (milestone: first_connection)
└── Journey Stage: QUALIFIED
```

---

## Summary: What This Achieves

This plan transforms your analytics from **session-based** to **journey-based**, enabling:

1. **True Cross-Session Attribution** - Know that the user who converted today first found you 2 weeks ago via a specific campaign

2. **Anonymous-to-Registered Linking** - When someone signs up, you instantly see their entire history as an anonymous visitor

3. **Conversion Funnel Clarity** - See exactly where in the journey users drop off

4. **First-Touch ROI** - Calculate which acquisition sources drive the most conversions (not just visits)

5. **Real-Time Journey Monitoring** - Watch users progress through stages in the Intelligence Center
