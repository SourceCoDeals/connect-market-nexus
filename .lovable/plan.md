

# Plan: Fix Anonymous Name Bug & Add Full Referrer History

## Problem Summary

Three issues identified:

### Issue 1: Registered Users Showing Animal Names
**Root Cause**: The `profiles` query only fetches profiles created within the 30-day time range (for signup counting). However, the `topUsers` logic uses this same `profileMap` to resolve user names. Users who registered before the time range (like Champ Warren from Nov 2025) are not in `profileMap`, causing them to appear anonymous.

**Evidence**: 
- Champ Warren's profile ID: `0e633bf9-c20f-4003-a5d9-65f72b005cdf`
- Profile created: `2025-11-20` (outside 30-day window)
- Has session from today with `user_id` set
- Still shows as "Pearl Griffin" because profile lookup fails

### Issue 2: Missing Full Referrer History
Anonymous visitors should display all their referrers across sessions in the detail panel, not just the first session's referrer. This provides complete visibility into their discovery path.

### Issue 3: Traffic Source Clarification
The traffic is **real** but includes development activity:
- 18 sessions from `lovable.dev` (preview window)
- 34 sessions with null country (development traffic)
- The European visitors (Amsterdam, France, UK, Spain, Hungary) are actual visitors or preview loads

This isn't "fake" data but does include development traffic that could optionally be filtered.

---

## Solution

### Part A: Fix Profile Lookup for All Users

Add a **separate query** to fetch profiles for ALL users who have sessions in the time period, not just new signups:

```text
Location: src/hooks/useUnifiedAnalytics.ts (around line 205-275)

1. Keep existing profiles query for signup counting (lines 263-268)
2. Add new query to get profiles for ALL users with sessions

// NEW: Fetch profiles for all users who have sessions (for name display)
const allUserIdsFromSessions = new Set<string>();
rawSessions.forEach(s => {
  if (s.user_id) allUserIdsFromSessions.add(s.user_id);
});

const { data: allProfilesForUsers } = await supabase
  .from('profiles')
  .select('id, first_name, last_name, company')
  .in('id', Array.from(allUserIdsFromSessions));

// Build complete profile map for name resolution
const allProfilesMap = new Map(allProfilesForUsers?.map(p => [p.id, p]) || []);
```

Then update line 1217 to use `allProfilesMap` instead of `profileMap` for the `topUsers` logic.

### Part B: Add Full Session History to User Detail

Modify `useUserDetail.ts` to include all session referrers:

```text
// In the UserDetailData interface, add:
source: {
  referrer?: string;
  landingPage?: string;
  channel?: string;
  // NEW: All sessions with their referrers for full journey visibility
  allSessions?: Array<{
    referrer: string | null;
    landingPage: string | null;
    startedAt: string;
    channel: string;
  }>;
  // ... existing fields
}

// In the query function, build allSessions:
const allSessions = sessions.map(s => ({
  referrer: s.referrer,
  landingPage: s.first_touch_landing_page,
  startedAt: s.started_at,
  channel: categorizeChannel(s.referrer, s.utm_source, s.utm_medium),
}));
```

### Part C: Display Session History in User Detail Panel

Update `UserDetailPanel.tsx` to show the full journey:

```text
// New "Journey" section in Acquisition showing all sessions
{data.source.allSessions && data.source.allSessions.length > 1 && (
  <div>
    <span className="text-xs text-muted-foreground block mb-2">
      Visit History ({data.source.allSessions.length} sessions)
    </span>
    <div className="space-y-2 max-h-32 overflow-y-auto">
      {data.source.allSessions.map((session, i) => (
        <div key={i} className="text-xs bg-muted/20 p-2 rounded flex items-center gap-2">
          <span className="text-muted-foreground">
            {format(new Date(session.startedAt), 'MMM d, HH:mm')}
          </span>
          <span>via</span>
          <Badge variant="outline" className="text-[9px]">{session.channel}</Badge>
          {session.referrer && (
            <span className="truncate text-blue-600">{session.referrer}</span>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Technical Changes

### File 1: `src/hooks/useUnifiedAnalytics.ts`

| Location | Change |
|----------|--------|
| Lines 275-280 | After fetching sessions, extract all user_ids and query their profiles |
| Lines 1215-1217 | Create `allProfilesMap` from ALL user profiles, not just recent signups |
| Lines 1240-1253 | Use `allProfilesMap` instead of `profileMap` for topUsers name resolution |

### File 2: `src/hooks/useUserDetail.ts`

| Location | Change |
|----------|--------|
| Lines 52-63 | Add `allSessions` field to `UserDetailData.source` interface |
| Lines 298-305 | Build `allSessions` array from all fetched sessions |

### File 3: `src/components/admin/analytics/datafast/UserDetailPanel.tsx`

| Location | Change |
|----------|--------|
| Lines 290-300 | Add "Visit History" section showing all sessions with referrers |

---

## Expected Outcome

| Before | After |
|--------|-------|
| Champ Warren shows as "Pearl Griffin" | Shows as "Champ Warren" with real company/email |
| Anonymous visitors show single referrer | Shows full session history with all referrers |
| All registered users appear anonymous | Only truly anonymous visitors (no `user_id` ever) show animal names |

---

## Optional Enhancement: Filter Development Traffic

To exclude development/preview sessions from the Users tab, add a filter to exclude sessions where:
- `referrer` contains `lovable.dev` or `lovableproject.com`
- OR `country` is null/empty

This is optional and can be implemented as a toggle "Hide dev traffic" if desired.

