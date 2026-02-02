
# Investigation Summary: Why Anonymous Users Show Empty/Default Data

## Root Cause Analysis

I've identified **THREE critical issues** preventing journey data from appearing for anonymous users like "rose lion" and "crimson wolf":

---

## Issue #1: Dual Session ID Systems (Primary Cause)

The codebase has **two competing analytics systems** using different session ID formats:

| System | Session ID Format | Used By | Stored In |
|--------|-------------------|---------|-----------|
| **SessionContext** | UUID (`45d0257b-345b-4882-bc7e-ff7da11173c4`) | `track-session` edge function, `use-page-engagement.ts` | `user_sessions` table |
| **AnalyticsContext** | Timestamp (`session_1770035523309_tzpas1l5v`) | `trackPageView()`, `trackListingView()` | `page_views` table |

**The Problem:**
- Anonymous visitors from the production site (e.g., "rose lion") have their session created by `track-session` with a UUID session ID
- But when pages are viewed, `AnalyticsContext.tsx` generates its own timestamp-based session ID and inserts page_views with that ID
- When `useEnhancedRealTimeAnalytics` queries page_views using the UUID from `user_sessions`, it finds **zero matching records**
- Result: Empty `pageSequence[]` and `currentPage: null`

**Database Evidence:**

```text
user_sessions table (anonymous users):
session_id: 45d0257b-345b-4882-bc7e-ff7da11173c4  (UUID format)

page_views table (same time period):
session_id: session_1770035419278_2o9l7fss9  (timestamp format)
```

These IDs never match, so journey data cannot be linked.

---

## Issue #2: visitor_id NOT Being Stored for Anonymous Users

The database shows that `visitor_id` is only populated for authenticated users:

```sql
-- Query result: visitor_id only exists for admin user
session_id: 1f24867b-8800-47c1-b7a9-39dad47b959a
visitor_id: 61da54fb-f346-4de1-a2fe-62cb1295f450
user_id: 1d5727f8-2a8c-4600-9a46-bddbb036ea45  -- Admin

-- Anonymous sessions:
session_id: 45d0257b-345b-4882-bc7e-ff7da11173c4
visitor_id: NULL  -- Missing!
user_id: NULL
```

**The Problem:**
The edge function is receiving `visitor_id` from the frontend, but anonymous users aren't getting it stored because:
1. The `track-session` edge function only stores `visitor_id` on **new session creation**
2. Many anonymous sessions are **existing sessions** (the `if (existingSession)` branch) that get updated but the UPDATE query does NOT include `visitor_id`

---

## Issue #3: session_duration_seconds is NULL for Anonymous Users

```sql
-- Anonymous sessions:
session_id: 45d0257b-345b-4882-bc7e-ff7da11173c4
session_duration_seconds: NULL  -- Not 0, completely NULL
```

**The Problem:**
- The heartbeat function updates duration, but the initial session creation sets it to `time_on_page` (which may be 0)
- If no heartbeat runs before the dashboard queries, duration stays NULL
- The fallback calculation in `useEnhancedRealTimeAnalytics` (`calculateDuration`) tries to compute from timestamps, but if `last_active_at === started_at`, the result is 0s

---

## Solution Plan

### Fix #1: Consolidate Session IDs

Update `AnalyticsContext.tsx` to use the UUID from `SessionContext` instead of generating its own:

```typescript
// BEFORE (line 41-43):
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// AFTER:
// Remove generateSessionId function
// Import and use SessionContext's sessionId
import { useSessionContext } from '@/contexts/SessionContext';
```

### Fix #2: Store visitor_id on Session Update

In `track-session/index.ts`, update the "existing session" branch to also set `visitor_id`:

```typescript
// Line 130-143 - Update to include visitor_id
const { error: updateError } = await supabase
  .from('user_sessions')
  .update({
    ip_address: clientIP,
    country: geoData?.country || null,
    // ...existing fields
    visitor_id: body.visitor_id || null,  // ADD THIS
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq('session_id', body.session_id);
```

### Fix #3: Set Initial Duration on Session Creation

Ensure `session_duration_seconds` starts with the `time_on_page` value from the frontend:

```typescript
// Already implemented in track-session/index.ts:
session_duration_seconds: initialDuration,

// But verify use-initial-session-tracking.ts is calculating correctly:
const timeOnPage = Math.max(0, Math.floor((Date.now() - performance.timing.navigationStart) / 1000));
```

---

## Implementation Steps

### Step 1: Fix AnalyticsContext Session ID (Primary Fix)

Modify `src/context/AnalyticsContext.tsx`:
- Remove `generateSessionId()` function
- Import `useSessionContext` from `@/contexts/SessionContext`
- Use the shared `sessionId` from SessionContext
- Remove `currentSessionId` module-level variable

### Step 2: Fix track-session Edge Function

Modify `supabase/functions/track-session/index.ts`:
- Add `visitor_id` to the UPDATE query for existing sessions
- Ensure `session_duration_seconds` uses the `time_on_page` value

### Step 3: Ensure Page Views Use Correct Session ID

Verify these files use `sessionId` from `SessionContext`:
- `use-page-engagement.ts` - Already correct
- `use-analytics-tracking.ts` - Verify and fix if needed

### Step 4: Test Flow

After fixes:
1. Anonymous visitor lands on site
2. `track-session` creates session with UUID + visitor_id + initial duration
3. `AnalyticsContext.trackPageView()` inserts page_view with SAME UUID
4. `useEnhancedRealTimeAnalytics` joins correctly
5. Tooltip shows real journey data

---

## Files to Modify

| File | Change |
|------|--------|
| `src/context/AnalyticsContext.tsx` | Use SessionContext's sessionId instead of generating own |
| `supabase/functions/track-session/index.ts` | Add visitor_id to UPDATE query for existing sessions |
| `src/hooks/use-analytics-tracking.ts` | Verify uses SessionContext's sessionId |

---

## Expected Results After Fix

For "rose lion" (anonymous user from Amsterdam):

```text
PATH INTELLIGENCE
Source              → Direct (or actual referrer)
Landing             /welcome
Current             /marketplace
Session             4m 32s

Journey this session:
/welcome → /marketplace → /signup

CROSS-SESSION HISTORY
Total visits        3 sessions
First seen          Jan 28, 2026
Time spent          12 min total
```
