

# Complete User Journey Analytics: Gap Analysis & Implementation Plan

## Executive Summary

After a thorough analysis, I've identified why the **user journey tracking is NOT working** despite the code being in place. The `user_journeys` table has **zero records** even though there are 2,195+ sessions in the last 7 days. This plan fixes the critical gaps and adds the missing milestone tracking to achieve complete visibility into every user's path.

---

## Part 1: Critical Issues Found

### Issue #1: Race Condition - Sessions Created Before Edge Function
**Root Cause**: Multiple places are creating sessions BEFORE the `track-session` edge function runs:

| Location | Creates Sessions | Sends visitor_id |
|----------|-----------------|------------------|
| `use-analytics-tracking.ts` (line 48) | Yes | No |
| `AnalyticsContext.tsx` (line 187) | Yes | No |
| `session-heartbeat/index.ts` (line 79) | Yes | No |
| `use-initial-session-tracking.ts` (line 197) | Yes (fallback) | Yes |
| `track-session/index.ts` (line 163) | Yes (intended) | Yes |

**Result**: When the edge function finally runs, it finds existing sessions and only UPDATES them (skipping journey upsert logic which only runs on INSERT).

### Issue #2: Edge Function Condition Bug
The journey upsert in `track-session/index.ts` only executes when a **NEW session is created**:
```typescript
if (existingSession) {
  // Only updates geo data - NO JOURNEY UPSERT
  return new Response(...);
}
// Journey upsert only happens here, after new session insert
```

### Issue #3: GA4 Client ID Never Captured (0% Rate)
```sql
SELECT COUNT(ga4_client_id) FROM user_sessions WHERE started_at > NOW() - INTERVAL '7 days'
-- Result: 0 out of 2,195 sessions
```
The GA4 cookie parsing runs too early (before GA4 sets the cookie).

### Issue #4: No Milestone Recording
When users complete key actions (signup, NDA signed, fee agreement, connection request), these are NOT being recorded in the `user_journeys.milestones` JSONB field.

---

## Part 2: What's Working Correctly

| Component | Status | Notes |
|-----------|--------|-------|
| `user_journeys` table schema | ✅ Exists | All columns present |
| `visitor_id` generation | ✅ Working | Logs show UUIDs being created |
| `useVisitorIdentity` hook | ✅ Working | First-touch captured in localStorage |
| Session geo-IP enrichment | ✅ Working | 139 sessions have country data |
| Page views tracking | ✅ Working | Recording scroll depth, time on page |
| Session heartbeat | ✅ Working | Duration tracking accurate |
| GA4 cross-domain config | ✅ Configured | Linker domains set correctly |
| Third-party tools | ✅ Installed | GTM, Hotjar, Heap, LinkedIn, Brevo, Vector |

---

## Part 3: Implementation Plan

### Step 1: Consolidate Session Creation (High Priority)

**Problem**: 5 different places create sessions, causing race conditions.

**Solution**: Make `track-session` edge function the ONLY place sessions are created.

**Files to modify**:
- `src/hooks/use-analytics-tracking.ts` - Remove session insert, use edge function
- `src/context/AnalyticsContext.tsx` - Remove session insert, use edge function  
- `supabase/functions/session-heartbeat/index.ts` - Change session creation to call track-session
- `src/hooks/use-initial-session-tracking.ts` - Remove fallback insert (already calls edge function)

### Step 2: Fix Edge Function Journey Logic

**Problem**: Journey upsert skipped when session already exists.

**Solution**: Always upsert journey when visitor_id is present, regardless of session state.

**Changes to `supabase/functions/track-session/index.ts`**:
```typescript
// MOVE journey upsert OUTSIDE the new/existing session conditional
// Always upsert journey when visitor_id is provided
if (body.visitor_id) {
  // Upsert logic here - runs for BOTH new and existing sessions
}
```

### Step 3: Fix GA4 Client ID Capture Timing

**Problem**: GA4 cookie not set when tracking fires.

**Solution**: Delay GA4 ID capture and retry mechanism.

**Changes to `src/hooks/useVisitorIdentity.ts`**:
- Add retry loop that checks for GA4 cookie every 500ms for up to 5 seconds
- Update first-touch data when GA4 ID becomes available
- Store GA4 ID update separately if first-touch already recorded

### Step 4: Add Milestone Tracking Integration

**Problem**: Key conversion events not updating journey milestones.

**Solution**: Create milestone update function and call it from relevant flows.

**New file**: `src/hooks/useJourneyMilestones.ts`
```typescript
export function useJourneyMilestones() {
  const { visitorId } = useVisitorIdentity();
  
  const recordMilestone = async (milestone: string) => {
    await supabase.rpc('update_journey_milestone', {
      p_visitor_id: visitorId,
      p_milestone_key: milestone,
      p_milestone_time: new Date().toISOString()
    });
  };
  
  return { recordMilestone };
}
```

**New database function**: `update_journey_milestone`
```sql
CREATE OR REPLACE FUNCTION update_journey_milestone(
  p_visitor_id TEXT,
  p_milestone_key TEXT,
  p_milestone_time TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  UPDATE public.user_journeys
  SET 
    milestones = jsonb_set(
      COALESCE(milestones, '{}'::jsonb),
      ARRAY[p_milestone_key],
      to_jsonb(p_milestone_time)
    ),
    journey_stage = CASE 
      WHEN p_milestone_key = 'first_connection_at' THEN 'converted'
      WHEN p_milestone_key IN ('nda_signed_at', 'fee_agreement_at') THEN 'qualified'
      WHEN p_milestone_key = 'signup_at' THEN 'registered'
      ELSE journey_stage
    END,
    updated_at = NOW()
  WHERE visitor_id = p_visitor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Integrate into existing flows**:
| Event | File | Add Milestone Call |
|-------|------|-------------------|
| Signup | `src/context/AuthContext.tsx` | `recordMilestone('signup_at')` |
| NDA Signed | `src/hooks/admin/requests/use-lead-status-updates.ts` | `recordMilestone('nda_signed_at')` |
| Fee Agreement | Same file | `recordMilestone('fee_agreement_at')` |
| Connection Request | `src/hooks/marketplace/use-connections.ts` | `recordMilestone('first_connection_at')` |

### Step 5: Link User ID on Authentication

**Problem**: When anonymous user signs up, their journey isn't updated with `user_id`.

**Solution**: Update journey on successful auth.

**Add to `src/context/AuthContext.tsx`**:
```typescript
// After successful signup/login
const visitorId = localStorage.getItem('sourceco_visitor_id');
if (visitorId) {
  await supabase.from('user_journeys').update({
    user_id: user.id,
    journey_stage: 'registered',
    updated_at: new Date().toISOString()
  }).eq('visitor_id', visitorId);
}
```

### Step 6: Backfill Existing Sessions into Journeys

**One-time migration**: Create journeys from existing session data.

```sql
-- Backfill user_journeys from existing sessions
INSERT INTO user_journeys (
  visitor_id,
  first_seen_at,
  first_landing_page,
  first_referrer,
  first_utm_source,
  first_utm_medium,
  first_utm_campaign,
  first_device_type,
  first_browser,
  first_os,
  first_country,
  first_city,
  last_seen_at,
  last_session_id,
  total_sessions,
  journey_stage
)
SELECT 
  session_id as visitor_id, -- Use session_id as temporary visitor_id for existing sessions
  MIN(started_at) as first_seen_at,
  -- ... aggregate from user_sessions
FROM user_sessions
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY session_id
ON CONFLICT (visitor_id) DO NOTHING;
```

---

## Part 4: Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/hooks/useJourneyMilestones.ts` | Milestone recording hook |
| `supabase/migrations/xxx_journey_milestone_function.sql` | Database function for milestone updates |
| `supabase/migrations/xxx_backfill_journeys.sql` | One-time backfill of existing sessions |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/functions/track-session/index.ts` | Move journey upsert outside conditional |
| `src/hooks/use-initial-session-tracking.ts` | Remove fallback session creation |
| `src/hooks/use-analytics-tracking.ts` | Remove direct session insert |
| `src/context/AnalyticsContext.tsx` | Remove direct session insert |
| `supabase/functions/session-heartbeat/index.ts` | Delegate session creation to track-session |
| `src/hooks/useVisitorIdentity.ts` | Add GA4 ID retry logic |
| `src/context/AuthContext.tsx` | Add journey update on auth |
| `src/hooks/marketplace/use-connections.ts` | Add milestone on connection request |
| `src/hooks/admin/requests/use-lead-status-updates.ts` | Add milestones for NDA/fee agreement |

---

## Part 5: Verification Checklist

After implementation, verify:

1. **Journey Creation**: New visitors create `user_journeys` records
2. **Session Counting**: `total_sessions` increments on return visits
3. **GA4 Capture**: `ga4_client_id` populated for 90%+ of journeys
4. **First Touch**: `first_utm_source`, `first_landing_page` captured
5. **Milestone Recording**: Signup → NDA → Fee Agreement → Connection flow updates milestones
6. **Stage Progression**: `journey_stage` updates from anonymous → registered → qualified → converted
7. **User Linking**: Authenticated users have `user_id` in their journey

---

## Part 6: What You Still Need to Do (Outside Lovable)

### Already Mentioned Previously - Cross-Domain on sourcecodeals.com
Your main website still needs the GA4 cross-domain linker config:
```html
gtag('config', 'G-N5T31YT52K', {
  linker: {
    domains: ['sourcecodeals.com', 'marketplace.sourcecodeals.com'],
    accept_incoming: true
  },
  cookie_domain: '.sourcecodeals.com'
});
```

### Add UTM Parameters to All Marketplace Links
Every link from sourcecodeals.com → marketplace should have UTMs:
```
?utm_source=website&utm_medium=nav&utm_campaign=header_cta
```

---

## Expected Outcome

After these fixes, you'll see in your User Journeys dashboard:

```
Visitor: azure-wolf-42
├─ Source: google (organic)
├─ First Landing: /welcome
├─ First Seen: Jan 28, 2026 10:30 AM
├─ Sessions: 5
├─ Milestones:
│   ├─ signup_at: Jan 29, 2026 2:15 PM
│   ├─ nda_signed_at: Jan 30, 2026 9:00 AM
│   └─ first_connection_at: Jan 30, 2026 9:30 AM
├─ Stage: CONVERTED
└─ User: John Smith (john@example.com)
```

This gives you complete visibility into:
- Where every user came from (first-touch attribution)
- How many sessions it took to convert
- Exact time between first visit → signup → qualified actions
- Which landing pages drive conversions
- GA4 data stitching for external analytics

