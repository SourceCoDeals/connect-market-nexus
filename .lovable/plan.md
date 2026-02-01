# User Journey Analytics Implementation

## Status: ✅ COMPLETED

All components of the user journey analytics system have been implemented.

---

## What Was Implemented

### Part 1: Session Consolidation ✅
- **Removed duplicate session creation** from:
  - `src/hooks/use-analytics-tracking.ts` 
  - `src/context/AnalyticsContext.tsx`
  - `supabase/functions/session-heartbeat/index.ts`
  - `src/hooks/use-initial-session-tracking.ts` (fallback removed)
- **Single source of truth**: `track-session` edge function now handles all session creation

### Part 2: Journey Upsert Fix ✅
- Fixed `track-session/index.ts` to always upsert journey even for existing sessions
- Previously, journey upsert was skipped when session already existed

### Part 3: GA4 Client ID Capture ✅
- Enhanced retry mechanism in `useVisitorIdentity.ts`
- Exponential backoff: 500ms, 1s, 2s, 3s, 5s (total 11.5s of retries)
- Improved cookie parsing for multiple GA4 cookie formats

### Part 4: Milestone Tracking ✅
- Created `useJourneyMilestones.ts` hook
- Created database functions:
  - `update_journey_milestone(visitor_id, milestone_key, time)` 
  - `link_journey_to_user(visitor_id, user_id)`
- Integrated milestones into:
  - Authentication flow (`use-nuclear-auth.ts`) - signup_at
  - Connection requests (`use-connections.ts`) - first_connection_at
  - NDA signing (`use-lead-status-updates.ts`) - nda_signed_at
  - Fee agreements (`use-lead-status-updates.ts`) - fee_agreement_at

### Part 5: User Linking ✅
- Journey automatically linked to user on successful authentication
- Anonymous → registered stage transition on signup/login

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/track-session/index.ts` | Journey upsert for existing sessions |
| `supabase/functions/session-heartbeat/index.ts` | Removed session creation |
| `src/hooks/use-analytics-tracking.ts` | Removed session creation |
| `src/context/AnalyticsContext.tsx` | Removed session creation |
| `src/hooks/use-initial-session-tracking.ts` | Removed fallback creation |
| `src/hooks/useVisitorIdentity.ts` | GA4 retry mechanism |
| `src/hooks/use-nuclear-auth.ts` | Journey linking on auth |
| `src/hooks/marketplace/use-connections.ts` | Connection milestone |
| `src/hooks/admin/requests/use-lead-status-updates.ts` | NDA/Fee milestones |

## Files Created

| File | Purpose |
|------|---------|
| `src/hooks/useJourneyMilestones.ts` | Milestone recording hook |

---

## What Still Needs Your Action (Outside Lovable)

### Cross-Domain on sourcecodeals.com
Add this config to your main website's GA4 setup:
```html
gtag('config', 'G-N5T31YT52K', {
  linker: {
    domains: ['sourcecodeals.com', 'marketplace.sourcecodeals.com'],
    accept_incoming: true
  },
  cookie_domain: '.sourcecodeals.com'
});
```

### Add UTMs to Marketplace Links
Every link from sourcecodeals.com → marketplace should include:
```
?utm_source=website&utm_medium=nav&utm_campaign=header_cta
```

---

## Expected Behavior After Implementation

New visitors will now:
1. Get a `user_journeys` record created with first-touch attribution
2. Have `total_sessions` increment on return visits
3. Progress through stages: anonymous → registered → qualified → converted
4. Have milestones recorded: signup_at, nda_signed_at, fee_agreement_at, first_connection_at
5. Be linked to their user account when they authenticate

---

## Verification

Check the Journeys tab in Intelligence Center to see:
- Journey stage funnel
- First-touch attribution sources
- Top landing pages
- Live journey activity feed
