

# Fix Real Names & Add Globe Drag-to-Stop Functionality

## Issues Identified

### Issue 1: "gold owl" Appearing Instead of Real Names

**Root Cause:**
The `recentEvents` logic tries to match page_view sessions with active sessions. However:
- Active sessions are filtered by `last_active_at >= 2 minutes ago`
- Many sessions have `NULL` in `last_active_at` (only have `started_at`)
- When no match is found, `createDefaultUser()` is called which generates an anonymous name like "gold owl"
- This happens even when the session HAS a `user_id` linked to a real profile

**Database Evidence:**
- Session `session_1769794934143_hvmyix7n2` has `user_id: 1d5727f8-2a8c-4600-9a46-bddbb036ea45`
- This user_id belongs to "Admin User" from "SourceCo"
- But the session has `last_active_at: NULL`, so it's excluded from activeUsers
- The page view falls back to "gold owl" (anonymous name)

**Fix:**
1. Modify the session query to use `COALESCE(last_active_at, started_at)` for filtering
2. For `recentEvents`, directly fetch profile data for page_view sessions instead of relying on activeUsers matching
3. Ensure every page_view with a `user_id` gets the real name from profiles

### Issue 2: Globe Should Stop When Dragged

**Current Behavior:**
- Globe auto-rotates at 0.3° per 50ms
- Globe pauses only on hover (over a user marker)
- No drag detection

**Desired Behavior:**
- Globe spins by default
- When user drags the globe to focus on a region (e.g., France), rotation stops
- Globe stays focused on that area until user navigates away

**Fix:**
Add mouse/touch drag detection to the globe:
- Track `isDragging` state
- On mousedown/touchstart: set `isDragging = true`
- On mouseup/touchend: if dragged, set `isManuallyPaused = true`
- The `isManuallyPaused` flag permanently stops rotation until page refresh

---

## Implementation Details

### File 1: `src/hooks/useEnhancedRealTimeAnalytics.ts`

**Changes:**
1. Update session filtering to use `COALESCE(last_active_at, started_at)` via OR condition
2. For `recentEvents`, create a map of session_id → user_id from page_views
3. Fetch profiles for ALL user_ids found in page_views (not just active sessions)
4. When building recentEvents, look up the user_id directly from the session, then fetch profile

```typescript
// Modified session query - also include sessions with recent started_at
.or(`last_active_at.gte.${twoMinutesAgo},started_at.gte.${twoMinutesAgo}`)

// For recentEvents - get user_id directly from sessions for each page_view
// Then look up profile for that user_id
```

### File 2: `src/components/admin/analytics/realtime/PremiumGlobeMap.tsx`

**Changes:**
1. Add `isManuallyPaused` state to track if user has dragged
2. Add `onMouseDown`, `onMouseUp`, `onMouseMove` handlers for drag detection
3. Add `onTouchStart`, `onTouchEnd` handlers for mobile support
4. Track actual drag movement (not just click) before pausing

```typescript
const [isManuallyPaused, setIsManuallyPaused] = useState(false);
const [isDragging, setIsDragging] = useState(false);
const dragStartPos = useRef<{ x: number; y: number } | null>(null);

// Auto-rotate only if not manually paused
useEffect(() => {
  if (isPaused || isManuallyPaused) return;
  // ... rotation logic
}, [isPaused, isManuallyPaused]);

// Drag detection
const handleMouseDown = (e: React.MouseEvent) => {
  dragStartPos.current = { x: e.clientX, y: e.clientY };
};

const handleMouseUp = (e: React.MouseEvent) => {
  if (dragStartPos.current) {
    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);
    // If moved more than 5px, consider it a drag
    if (dx > 5 || dy > 5) {
      setIsManuallyPaused(true);
    }
  }
  dragStartPos.current = null;
};
```

---

## Technical Details

### Session Filtering Fix

The current query filters by:
```typescript
.gte('last_active_at', twoMinutesAgo)
```

This excludes sessions where `last_active_at` is NULL. Change to:
```typescript
.or(`last_active_at.gte.${twoMinutesAgo},and(last_active_at.is.null,started_at.gte.${twoMinutesAgo})`)
```

### Recent Events Profile Lookup

Currently:
1. Fetch active sessions → build `activeUsers` array
2. Fetch page_views
3. For each page_view, try to find matching user in `activeUsers`
4. If not found, create anonymous user

Problem: Page view session might not be in activeUsers (filtered out)

Fix:
1. Fetch page_views with session join to get user_id
2. Collect all user_ids from page_views
3. Fetch profiles for those user_ids
4. When building recentEvents, look up profile by user_id

### Drag Detection Logic

```
State Machine:
  SPINNING (default)
    → onMouseDown: record start position
    → onMouseUp: if moved > 5px → PAUSED_BY_DRAG
    → onHover marker: PAUSED_TEMP

  PAUSED_BY_DRAG
    → stays paused until page refresh
    → onHover marker: no effect (already paused)

  PAUSED_TEMP (hover on marker)
    → onLeave marker: → SPINNING (unless PAUSED_BY_DRAG)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useEnhancedRealTimeAnalytics.ts` | Fix session filtering, fetch profiles for page_view sessions, ensure recentEvents uses real names |
| `src/components/admin/analytics/realtime/PremiumGlobeMap.tsx` | Add drag detection with `isManuallyPaused` state, add mouse/touch event handlers |

---

## Expected Results

After implementation:
1. Activity feed shows "Admin User from 🇭🇺 Hungary visited /admin" (real name)
2. Globe spins automatically on page load
3. User can drag globe to France → rotation stops
4. Globe stays focused on France until page refresh
5. Hovering on markers still shows tooltip (existing behavior)

