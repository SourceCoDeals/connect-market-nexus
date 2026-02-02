
# Plan: Fix Users Tab to Show Real Data Like Datafast

## Problem Summary

The Users tab in the ConversionCard shows mostly "Anonymous Visitor" entries from days ago because:

1. **Anonymous visitors (visitor_id only) are excluded entirely** - The `topUsers` logic in `useUnifiedAnalytics.ts` only processes sessions with `user_id`, completely ignoring anonymous visitors who have `visitor_id` but no `user_id`

2. **"Anonymous Visitor" entries are actually registered users without profile names** - Users with `user_id` but no first/last name in their profile show as "Anonymous Visitor" instead of using the animal-name system

3. **Missing Datafast-style features**:
   - Animal-based naming for anonymous visitors (e.g., "sapphire pigeon")
   - Full country name with flag in row
   - Source with proper favicon (currently shows channel text)
   - "Spent" column (time on site) instead of "Conv"
   - Proper "Last seen" formatting

## Solution

### Part A: Include Anonymous Visitors in topUsers

Modify `useUnifiedAnalytics.ts` to track visitors by both `user_id` AND `visitor_id`:

1. **Create unified visitor key**: Use `user_id` if available, otherwise `visitor_id`
2. **Track session data by visitor key** (not just user_id)
3. **Include anonymous visitors in allUserIds set**
4. **Generate animal names for anonymous visitors** using the same algorithm from `useUserDetail.ts`

### Part B: Update TopUser Interface

Add missing fields to support Datafast-style display:

```text
interface TopUser {
  // Existing fields
  id: string;
  name: string;
  company: string;
  sessions: number;
  pagesViewed: number;
  connections: number;
  
  // Enhanced fields
  isAnonymous: boolean;  // NEW
  country?: string;
  city?: string;         // NEW  
  device?: string;
  browser?: string;
  os?: string;
  source?: string;       // Channel name
  referrerDomain?: string; // NEW: For favicon
  lastSeen?: string;
  timeOnSite?: number;   // NEW: Total seconds
  activityDays?: Array<...>;
}
```

### Part C: Update Users Tab UI

Modify `ConversionCard.tsx` to match Datafast style:

1. **Replace "CONV" column with "SPENT"** - Show formatted time on site
2. **Add animal avatars or colored initials** for anonymous visitors
3. **Show country flag + full name** in the visitor row (not just tooltip)
4. **Source column**: Show favicon + domain name (not just channel)
5. **Fix row styling** to match Datafast's clean look

### Part D: Fix useUserDetail for visitor_id Support

The detail panel currently only queries by `user_id`. Need to:
1. Accept either `user_id` or `visitor_id`
2. Query sessions by appropriate ID type
3. Handle anonymous visitor data display

---

## Technical Changes

### File 1: `src/hooks/useUnifiedAnalytics.ts`

**Location: Around line 1133-1220 (topUsers logic)**

```typescript
// Add animal name generation (copy from useUserDetail.ts)
const ANIMALS = ['Wolf', 'Eagle', ...];
const COLORS = ['Azure', 'Crimson', ...];
function generateAnimalName(id: string): string { ... }

// Replace user-only logic with unified visitor tracking
// Create visitorSessionCounts and visitorSessionData maps
// Key = user_id || visitor_id (unified key)

const visitorSessionCounts = new Map<string, number>();
const visitorSessionData = new Map<string, {
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  source?: string;
  referrerDomain?: string;
  lastSeen?: string;
  totalTimeOnSite?: number;
  isAnonymous: boolean;
}>();

uniqueSessions.forEach(s => {
  const visitorKey = s.user_id || s.visitor_id;
  if (!visitorKey) return; // Skip sessions without any identifier
  
  visitorSessionCounts.set(visitorKey, (visitorSessionCounts.get(visitorKey) || 0) + 1);
  
  const existing = visitorSessionData.get(visitorKey);
  const isNewer = !existing || new Date(s.started_at) > new Date(existing.lastSeen || 0);
  
  if (isNewer) {
    visitorSessionData.set(visitorKey, {
      country: s.country,
      city: s.city,
      device: s.device_type,
      browser: s.browser,
      os: s.os,
      source: categorizeChannel(s.referrer, s.utm_source, s.utm_medium),
      referrerDomain: extractDomain(s.referrer),
      lastSeen: s.started_at,
      totalTimeOnSite: (existing?.totalTimeOnSite || 0) + (s.session_duration_seconds || 0),
      isAnonymous: !s.user_id,
    });
  } else if (existing) {
    existing.totalTimeOnSite = (existing.totalTimeOnSite || 0) + (s.session_duration_seconds || 0);
  }
});

// Build allVisitorIds from all sessions with any identifier
const allVisitorIds = new Set<string>();
if (filters.length > 0) {
  uniqueSessions.forEach(s => {
    const key = s.user_id || s.visitor_id;
    if (key) allVisitorIds.add(key);
  });
} else {
  visitorSessionCounts.forEach((_, id) => allVisitorIds.add(id));
}

// Generate topUsers with animal names for anonymous
const topUsers = Array.from(allVisitorIds)
  .map(id => {
    const profile = profileMap.get(id); // Only exists if id is user_id
    const sessionData = visitorSessionData.get(id);
    const isAnonymous = sessionData?.isAnonymous ?? !profile;
    
    const name = isAnonymous
      ? generateAnimalName(id)
      : [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Unknown';
    
    return {
      id,
      name,
      isAnonymous,
      company: profile?.company || '',
      sessions: visitorSessionCounts.get(id) || 0,
      pagesViewed: ...,
      connections: userConnectionCounts.get(id) || 0,
      country: sessionData?.country,
      city: sessionData?.city,
      device: sessionData?.device,
      browser: sessionData?.browser,
      os: sessionData?.os,
      source: sessionData?.source,
      referrerDomain: sessionData?.referrerDomain,
      lastSeen: sessionData?.lastSeen,
      timeOnSite: sessionData?.totalTimeOnSite,
      activityDays,
    };
  })
  .filter(u => u.sessions > 0)
  .sort((a, b) => {
    // Sort by lastSeen (most recent first)
    const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
    const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
    return bTime - aTime;
  })
  .slice(0, 50);
```

### File 2: `src/components/admin/analytics/datafast/ConversionCard.tsx`

**Location: UsersTab component (lines 224-337)**

1. Update header row: Change "Conv" to "Spent"
2. Update row layout:
   - Show country flag + name inline
   - Show source with favicon
   - Show formatted time instead of connection count
   - Keep connections as a badge only if > 0

**Location: Interface TopUser (lines 20-35)**

Add new fields: `isAnonymous`, `city`, `referrerDomain`, `timeOnSite`

### File 3: `src/hooks/useUserDetail.ts`

**Location: useUserDetail hook (lines 110-288)**

1. Accept `visitorId` parameter in addition to `userId`
2. Query sessions by `visitor_id` when not a user_id
3. Handle case where profile doesn't exist (anonymous visitor)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Add animal name generation, track visitors by unified key (user_id OR visitor_id), include anonymous visitors in topUsers, add timeOnSite calculation |
| `src/components/admin/analytics/datafast/ConversionCard.tsx` | Update TopUser interface, change "Conv" to "Spent", update row layout for Datafast style, show source favicon |
| `src/hooks/useUserDetail.ts` | Support visitor_id lookup for anonymous visitor details |

---

## Expected Outcome

After these changes:

| Before | After |
|--------|-------|
| Only registered users shown | All visitors (registered + anonymous) shown |
| "Anonymous Visitor" for nameless profiles | Animal names like "Sapphire Pigeon" |
| "Conv" column with connection count | "Spent" column with time on site |
| Source shows channel text | Source shows favicon + domain |
| Old visitors from days ago | Recent visitors sorted by last seen |
| 10 users max | 50 visitors, recent first |

The Users tab will now match Datafast's real-time visitor list, showing a mix of anonymous visitors (with animal names) and registered users, sorted by most recent activity.
