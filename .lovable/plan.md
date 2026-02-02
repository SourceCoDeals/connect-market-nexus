

# Plan: Fix Users Tab to Show Real Names and Accurate Data

## Problem Analysis

Based on investigation, I found the following issues:

### Issue 1: All Visitors Showing with Animal Names
The current logic incorrectly determines `isAnonymous` based on the session's `user_id` presence rather than checking if a profile exists. The key line is:
```typescript
const isAnonymous = sessionData?.isAnonymous ?? !profile;
```

But `sessionData?.isAnonymous` is set from `!s.user_id` on the **latest session**, which can be wrong if:
1. A registered user's session was tracked before their `user_id` was linked
2. The `profileMap.get(id)` lookup fails because `id` is a `visitor_id`, not a `user_id`

**Root Cause**: When tracking by unified key (`user_id || visitor_id`), if we use `visitor_id` as the key (even when `user_id` exists), the profile lookup by that `visitor_id` will fail since profiles are keyed by `user_id`.

### Issue 2: User Detail Panel Missing "How They Landed"
The detail panel shows:
- "Found site via" for the referrer
- But doesn't explicitly show the **landing page** (first page visited on marketplace)

The session table has `first_touch_landing_page` column that should be displayed.

### Issue 3: Anonymous Users Not Being Queried Correctly
For anonymous users (only `visitor_id`), the `useUserDetail` hook needs to also fetch page views by joining through sessions since `page_views.visitor_id` doesn't exist.

---

## Solution

### Part A: Fix `isAnonymous` Detection

Modify `useUnifiedAnalytics.ts` to properly determine if a visitor is registered:

1. **Always prefer `user_id` as the tracking key** when both exist
2. **Look up profile by `user_id`**, not by the unified key
3. **Set `isAnonymous = true` only when there's no `user_id` in any session** for that visitor

```text
// When processing sessions, track the user_id separately
const visitorToUserId = new Map<string, string>(); // visitor_id -> user_id

uniqueSessions.forEach(s => {
  // If session has user_id, map any visitor_id to it
  if (s.user_id && s.visitor_id) {
    visitorToUserId.set(s.visitor_id, s.user_id);
  }
});

// When building topUsers:
const userId = visitorToUserId.get(id) || (profileMap.has(id) ? id : null);
const profile = userId ? profileMap.get(userId) : null;
const isAnonymous = !profile;

const name = !isAnonymous
  ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown'
  : generateAnimalName(id);
```

### Part B: Add Landing Page to User Detail Panel

1. Update `useUserDetail.ts` to include `first_touch_landing_page` from the first session
2. Update `UserDetailPanel.tsx` to display "Landed on" section showing the first page visited

```text
// In source data returned by useUserDetail:
source: {
  referrer: firstSession?.referrer,
  landingPage: firstSession?.first_touch_landing_page, // NEW
  channel: categorizeChannel(...),
  ...
}
```

```text
// In UserDetailPanel acquisition section:
{data.source.landingPage && (
  <div>
    <span className="text-xs text-muted-foreground block mb-1">Landing Page</span>
    <code className="text-xs bg-muted px-2 py-1 rounded">
      {data.source.landingPage}
    </code>
  </div>
)}
```

### Part C: Fix Page Views Query for Anonymous Users

For anonymous visitors, fetch page views by joining through sessions:

```typescript
// In useUserDetail.ts
const pageViewsQuery = isUserId
  ? supabase.from('page_views')...
  : supabase.from('page_views')
      .select('*')
      .in('session_id', sessions.map(s => s.session_id))
      .gte('created_at', sixMonthsAgo)
      .order('created_at', { ascending: true });
```

This requires fetching sessions first, then using the session IDs to query page views.

---

## Technical Changes

### File 1: `src/hooks/useUnifiedAnalytics.ts`

**Lines ~1154-1270**: Rewrite the visitor tracking logic

1. Create `visitorToUserId` map to link visitor_ids to user_ids
2. When building `topUsers`, resolve the `user_id` for each visitor
3. Only mark as `isAnonymous` if no user_id can be found
4. Use the resolved profile to get real names

### File 2: `src/hooks/useUserDetail.ts`

**Lines ~142-150**: Fix page views query for anonymous users
- Fetch sessions first
- Then use session IDs to query page views

**Lines ~255-293**: Add `landingPage` to source data
- Include `first_touch_landing_page` in the returned source object

### File 3: `src/components/admin/analytics/datafast/UserDetailPanel.tsx`

**Lines ~252-312**: Add landing page display in Acquisition section
- Display "Landing Page" field showing where the user first landed

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Fix `isAnonymous` detection to use profile lookup; map visitor_id to user_id for registered users |
| `src/hooks/useUserDetail.ts` | Fix page views query for anonymous users; add `landingPage` to source data |
| `src/components/admin/analytics/datafast/UserDetailPanel.tsx` | Display landing page in acquisition section |

---

## Expected Outcome

After these changes:

| Before | After |
|--------|-------|
| "Violet Whale" for Admin User | "Admin User" |
| "Golden Orca" for registered users | Real names from profile |
| Animal names for everyone | Animal names ONLY for truly anonymous visitors |
| No landing page shown | Shows "Landed on /marketplace" etc. |
| Missing page views for anonymous | Complete event timeline for anonymous users |

The Users tab will show:
- Real names for registered users (Adam Haile, Tomos Mughan, Champ Warren, etc.)
- Animal names only for genuinely anonymous visitors (no user_id in any session)
- Complete acquisition data including where they landed on the marketplace

