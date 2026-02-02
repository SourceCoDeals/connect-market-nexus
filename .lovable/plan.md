

# Premium Globe Design + Complete Anonymous Journey Tracking

## Overview

This plan addresses two critical issues:
1. **Design Quality** - Elevate Engagement and Buyer Breakdown sections to world-class "$10M design team" aesthetic
2. **Anonymous Journey Data** - Fix the broken tracking so "crimson wolf" (and all anonymous visitors) show their complete journey with accurate session times

---

## Part 1: Root Cause Analysis

### Why "Crimson Wolf" Shows 0s Session Time and No Journey

**Problem #1: Missing `visitor_id` in `user_sessions` Table**
The `user_sessions` table lacks a `visitor_id` column. While we capture `visitor_id` in `user_journeys`, we cannot query historical sessions across multiple visits for anonymous users.

| Table | Has `visitor_id`? | Effect |
|-------|-------------------|--------|
| `user_journeys` | Yes | Stores first-touch, last-session |
| `user_sessions` | **No** | Cannot link sessions to visitors |
| `page_views` | No | Only has `session_id` |

**Problem #2: Session Duration Starts at 0**
Duration is only updated by the heartbeat every 30 seconds. If a user lands and stays on one page for 20 seconds, their session shows "0 sec" because the first heartbeat hasn't fired yet.

**Problem #3: Page Sequence Not Displayed**
The `EnhancedActiveUser` type already has `pageSequence: string[]` but `MapboxTooltipCard` doesn't display it for anonymous users.

**Problem #4: Referrer Often Shows "Direct"**
The external referrer (e.g., `sourcecodeals.com/blog`) may be lost if:
- Cross-origin referrer policy strips it
- UTM parameters aren't set on inbound links

---

## Part 2: Database Schema Changes

### Add `visitor_id` to `user_sessions`

```sql
-- Migration: Add visitor_id to user_sessions for cross-session linking
ALTER TABLE user_sessions ADD COLUMN visitor_id TEXT;

-- Create index for fast lookups
CREATE INDEX idx_user_sessions_visitor_id ON user_sessions(visitor_id) WHERE visitor_id IS NOT NULL;
```

This allows us to query ALL sessions for an anonymous visitor:
```sql
SELECT * FROM user_sessions WHERE visitor_id = 'abc123' ORDER BY started_at DESC;
```

### Update `track-session` Edge Function

Modify to store `visitor_id` in `user_sessions`:

```typescript
// In track-session/index.ts - when inserting new session
const { error: insertError } = await supabase.from('user_sessions').insert({
  session_id: body.session_id,
  visitor_id: body.visitor_id, // NEW: Store visitor identity
  user_id: body.user_id || null,
  // ... rest of fields
});
```

---

## Part 3: Fix 0-Second Session Duration

### Immediate Duration Calculation

Update `track-session` to set initial duration based on time since page load:

```typescript
// In track-session - when creating session
const initialDuration = body.time_on_page || 0;

const { error: insertError } = await supabase.from('user_sessions').insert({
  // ...existing fields
  session_duration_seconds: initialDuration, // Start with actual time on page
});
```

### Update Frontend to Send Initial Duration

In `use-initial-session-tracking.ts`, capture time since page load:

```typescript
// Before calling track-session
const timeOnPage = Math.floor((Date.now() - window.performance.timing.navigationStart) / 1000);

await supabase.functions.invoke('track-session', {
  body: {
    ...sessionData,
    time_on_page: timeOnPage,
  },
});
```

---

## Part 4: Display Complete Journey for Anonymous Users

### Enhanced Tooltip for Anonymous Visitors

Replace the generic "Visitor Journey" section with rich path visualization:

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🐺 crimson wolf                                             ✕   │
│ 🇪🇸 Chamartin, Spain                                            │
│ 💻 Desktop  •  Chrome  •  Windows                               │
├─────────────────────────────────────────────────────────────────┤
│ PATH INTELLIGENCE                                               │
│                                                                 │
│ Entry point          sourcecodeals.com/blog                     │
│ Landing page         /welcome                                   │
│ Current page         /marketplace                               │
│ Session              4 min 32 sec                               │
│                                                                 │
│ Journey this session:                                           │
│ ○ /welcome → ○ /marketplace → ● /signup   (3 pages)            │
├─────────────────────────────────────────────────────────────────┤
│ CROSS-SESSION HISTORY                                           │
│                                                                 │
│ Total visits         3 sessions over 5 days                     │
│ First seen           Jan 28, 2026                               │
│ Time on marketplace  12 min total                               │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Journey Path Component

A horizontal path visualization showing the pages visited:

```tsx
function JourneyPath({ pages }: { pages: string[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {pages.map((page, i) => (
        <React.Fragment key={i}>
          <div className={cn(
            "flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono",
            i === pages.length - 1 
              ? "bg-coral-500/20 text-coral-600 border border-coral-500/30" 
              : "bg-muted/50 text-muted-foreground"
          )}>
            {page}
          </div>
          {i < pages.length - 1 && (
            <span className="text-muted-foreground/40 text-xs">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
```

---

## Part 5: Premium Design Overhaul ($10M Aesthetic)

### Design Principles
- No generic Lucide icons where data should speak
- Custom micro-visualizations for every metric
- Subtle gradients and depth through layering
- Typography hierarchy that guides the eye
- Coral/Peach/Navy brand palette throughout

### Floating Panel Redesign

**Before (Generic):**
```
BUYER BREAKDOWN
⌂ Logged in         25 (83%)
📄 NDA Signed        21
📄 Fee Agreement     21
○ Connections        0 this hour
```

**After (Premium):**
```
BUYER INTELLIGENCE

┌─ Composition ───────────────────────────┐
│ Authenticated     ████████████████░░░░  │
│                   83% (25 of 30)        │
├─────────────────────────────────────────┤
│ QUALIFIED BUYERS                        │
│                                         │
│ NDA Completed              21           │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░              │
│                                         │
│ Fee Agreement              21           │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░              │
├─────────────────────────────────────────┤
│ ACTIVITY VELOCITY                       │
│                                         │
│ Connections this hour       0           │
│ Average: 2.4/hr                         │
└─────────────────────────────────────────┘
```

### Tooltip Engagement Section Redesign

**Before:**
```
ENGAGEMENT
👁 Listings viewed  ▓▓░░░░░░░░  2
♥ Listings saved   ░░░░░░░░░░  0
○ Connections sent ░░░░░░░░░░  0
```

**After (No icons, pure data visualization):**
```
ENGAGEMENT DEPTH

Listings explored   ██████░░░░  6 of ~40
Intent signals      ██░░░░░░░░  2 saved
Outreach            ░░░░░░░░░░  0 connections

─────────────────────────────────────────
Engagement score: Above average
```

### Color-Coded Progress Bars

Use semantic colors instead of flat coral:
- **Gray**: 0 (no activity)
- **Blue gradient**: 1-3 (light engagement)  
- **Coral gradient**: 4-7 (moderate engagement)
- **Green gradient**: 8+ (high engagement)

```tsx
function getEngagementColor(value: number, max: number): string {
  const ratio = value / max;
  if (ratio === 0) return 'bg-muted/30';
  if (ratio < 0.3) return 'bg-gradient-to-r from-blue-400 to-blue-500';
  if (ratio < 0.7) return 'bg-gradient-to-r from-coral-400 to-coral-500';
  return 'bg-gradient-to-r from-emerald-400 to-emerald-500';
}
```

---

## Part 6: Implementation Files

### Files to Create
| File | Purpose |
|------|---------|
| `supabase/migrations/add_visitor_id_to_sessions.sql` | Schema migration |
| `src/components/admin/analytics/realtime/JourneyPath.tsx` | Visual path component |
| `src/components/admin/analytics/realtime/EngagementDepth.tsx` | Premium engagement viz |
| `src/components/admin/analytics/realtime/BuyerComposition.tsx` | Premium buyer breakdown |

### Files to Modify
| File | Changes |
|------|---------|
| `supabase/functions/track-session/index.ts` | Store `visitor_id` in sessions, set initial duration |
| `src/hooks/use-initial-session-tracking.ts` | Send `time_on_page` to edge function |
| `src/hooks/useEnhancedRealTimeAnalytics.ts` | Query sessions by `visitor_id` for history |
| `src/components/admin/analytics/realtime/MapboxTooltipCard.tsx` | Complete redesign with journey path |
| `src/components/admin/analytics/realtime/MapboxFloatingPanel.tsx` | Premium buyer intelligence layout |

---

## Part 7: Technical Implementation Details

### Session Query Enhancement

Update `useEnhancedRealTimeAnalytics.ts` to fetch cross-session data:

```typescript
// After fetching current sessions, get historical sessions for each visitor
const visitorIds = sessions.map(s => s.visitor_id).filter(Boolean);

const { data: historicalSessions } = await supabase
  .from('user_sessions')
  .select('visitor_id, session_id, started_at, session_duration_seconds')
  .in('visitor_id', visitorIds)
  .order('started_at', { ascending: false });

// Build visitor history map
const visitorHistory: Record<string, {
  totalSessions: number;
  firstSeen: string;
  totalTime: number;
}> = {};
```

### Enhanced User Type

Add new fields to `EnhancedActiveUser`:

```typescript
interface EnhancedActiveUser {
  // ...existing fields
  
  // Cross-session journey data (NEW)
  visitorFirstSeen: string | null;       // When they first visited
  visitorTotalSessions: number;          // Sessions across all time
  visitorTotalTime: number;              // Total time on site ever
  externalReferrer: string | null;       // Original external source (e.g., blog)
}
```

---

## Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| 0s session time | Heartbeat hasn't fired | Send initial `time_on_page` with session |
| No journey history | Sessions not linked by visitor | Add `visitor_id` to `user_sessions` |
| Missing external referrer | Not displaying first-touch data | Show `first_touch_referrer` from journey |
| Generic design | Using Lucide icons, flat layout | Custom visualizations, depth, hierarchy |

This plan achieves:
1. **Complete anonymous journey visibility** - See every page "crimson wolf" visited across all sessions
2. **Accurate real-time duration** - No more 0s from the moment they land
3. **Premium $10M aesthetic** - Data-driven visualizations, no generic icons
4. **Actionable intelligence** - Path visualization shows exactly where visitors go

