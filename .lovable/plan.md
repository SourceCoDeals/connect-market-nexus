
# Live Activity Feed Improvements: Real Names, Click-to-Focus & Extended History

## Analysis of Current State

### Why "teal wolf" and "sage dolphin" Are Showing

After investigating the database, I found these are **genuinely anonymous visitors**:
- Session `session_1769795252781_5jmlfhula` has `user_id: NULL` - no logged-in user
- Session `90a55368-baf9-411d-acb9-bec77344e6db` (Spain) has `user_id: NULL`

The code IS working correctly for logged-in users (Admin User shows properly). Anonymous names appear for visitors who haven't logged in.

**However**, there's room to improve by:
1. Fetching session data more comprehensively to catch any edge cases
2. Extending the time window to capture more data

### Current Time Windows
- Active sessions: 2 minutes
- Page views: 5 minutes

### Proposed Changes

---

## Implementation Plan

### 1. Extend Time Windows to 1 Hour

**File: `src/hooks/useEnhancedRealTimeAnalytics.ts`**

Current:
```typescript
const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
```

Change to:
```typescript
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
```

- For activity feed: Show page views from last 1 hour
- For "active" sessions: Still use 2 minutes as the cutoff for "currently active"
- Add `isActive` status based on last_active_at or started_at

### 2. Add "Session Ended" Status

**Add to interface:**
```typescript
interface EnhancedActiveUser {
  // ... existing fields
  isSessionActive: boolean;  // true if activity in last 2 mins
  sessionStatus: 'active' | 'idle' | 'ended';  // for display
}
```

**Logic:**
- `active`: last_active_at within 2 minutes
- `idle`: last_active_at 2-10 minutes ago
- `ended`: last_active_at > 10 minutes ago (or is_active = false)

### 3. Click-to-Focus on Map

**Files to modify:**
- `src/components/admin/analytics/realtime/RealTimeTab.tsx`
- `src/components/admin/analytics/realtime/PremiumGlobeMap.tsx`
- `src/components/admin/analytics/realtime/LiveActivityFeed.tsx`

**Approach:**

1. Add `focusedSessionId` state to RealTimeTab
2. Pass to PremiumGlobeMap as prop
3. When activity item clicked, set focusedSessionId
4. PremiumGlobeMap uses sessionId to:
   - Calculate user's coordinates
   - Rotate globe to center on that location
   - Stop auto-rotation (already implemented)
   - Highlight the user with a special effect

**Globe focus implementation:**
```typescript
// In PremiumGlobeMap
useEffect(() => {
  if (focusedSessionId) {
    const user = users.find(u => u.sessionId === focusedSessionId);
    if (user?.coordinates) {
      // Set rotation to center on this user
      setRotation(-user.coordinates.lng);
      setIsManuallyPaused(true);
      setHighlightedSession(focusedSessionId);
    }
  }
}, [focusedSessionId, users]);
```

### 4. Enhanced Activity Feed with Status

**File: `src/components/admin/analytics/realtime/LiveActivityFeed.tsx`**

Add visual indicators:
- Active sessions: Green pulsing dot
- Idle sessions: Yellow dot
- Ended sessions: Gray dot with "Session ended" text

Update header:
```text
● LIVE ACTIVITY          Last 1 hour
```

Show session status in each row:
```text
[AU] Admin User from 🇭🇺 Hungary visited /admin
     less than a minute ago • Active

[TW] teal wolf from 🌍 Unknown visited /welcome
     12 minutes ago • Session ended
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useEnhancedRealTimeAnalytics.ts` | Extend page view window to 1 hour, add `isSessionActive` and `sessionStatus` fields, improve session matching |
| `src/components/admin/analytics/realtime/RealTimeTab.tsx` | Add `focusedSessionId` state, pass to globe and activity feed, wire up the click handler |
| `src/components/admin/analytics/realtime/PremiumGlobeMap.tsx` | Add `focusedSessionId` prop, implement globe rotation to focus on user, add highlight effect for focused user |
| `src/components/admin/analytics/realtime/LiveActivityFeed.tsx` | Update header to "Last 1 hour", add session status indicator (active/idle/ended), make items clickable with focus effect |

---

## Technical Details

### Session Status Logic
```typescript
function getSessionStatus(lastActiveAt: string): 'active' | 'idle' | 'ended' {
  const lastActive = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastActive) / (60 * 1000);
  
  if (diffMinutes < 2) return 'active';
  if (diffMinutes < 10) return 'idle';
  return 'ended';
}
```

### Globe Focus Animation
```typescript
// Smooth rotation to user's longitude
const targetRotation = -user.coordinates.lng;
// Use the existing rotation state, just set to target
setRotation(targetRotation);
setIsManuallyPaused(true);
```

### Activity Feed Click Handler
```typescript
// In LiveActivityFeed
<div onClick={() => onUserClick?.(event.user.sessionId)}>
  {/* event row */}
</div>

// In RealTimeTab
const handleActivityClick = (sessionId: string) => {
  setFocusedSessionId(sessionId);
};

<LiveActivityFeed 
  events={data.recentEvents}
  onUserClick={handleActivityClick}
/>
```

---

## Expected Results

After implementation:
1. Activity feed shows last 1 hour of events (not just 5 minutes)
2. Each event shows session status: "Active", "Idle", or "Session ended"
3. Clicking on an activity item focuses the globe on that user's location
4. Globe stops spinning and highlights the focused user
5. Anonymous visitors still show anonymous names (correct behavior - they have no profile)
6. Logged-in users show real names (already working for Admin User)
