
# Comprehensive Real-Time Analytics Fixes

## Issues Identified

### Issue 1: Anonymous Visitors - Where Do They Come From?

**Root Cause Analysis:**
The database shows anonymous visitors (user_id = NULL) ARE being tracked, but they have limited data because:

1. **They ARE real external visitors** - The sessions from France (Aulnay-sous-Bois, Istres) and Spain (Chamartin) with geo-location data are genuine anonymous visitors detected by the `track-session` edge function via IP geolocation.

2. **Referrer/UTM data is mostly NULL** - The `referrer` field in user_sessions is NULL for most anonymous visitors because:
   - The referrer is captured on the client side via `document.referrer`
   - If someone types the URL directly or uses an incognito browser, referrer is empty
   - The current session tracking doesn't reliably pass referrer data to the edge function

3. **What they visited is tracked in page_views** - Anonymous visitors do visit more than just the index page:
   - `/` (index)
   - `/welcome` (redirect to welcome page)
   - Some visit `/admin` pages

**Fix Strategy:**
- Enhance the session tracking to capture referrer and UTM params more reliably
- The real-time dashboard should show pages visited for anonymous users more prominently
- Normalize referrer display to show meaningful source (Google, Direct, Facebook, etc.)

### Issue 2: Session Time Shows 0s

**Root Cause Analysis:**
Looking at the database:
- Sessions with `session_duration_seconds > 0` exist (e.g., 5008s, 13822s)
- BUT many sessions have `session_duration_seconds = NULL` or `0`

**Why this happens:**
1. The heartbeat system updates `session_duration_seconds` via the edge function
2. BUT the heartbeat uses the SessionContext's `sessionId` which is a UUID (`5e7bfdb4-af5a-4472-8d33-5f26b2b99849`)
3. The initial session tracking creates sessions with format `session_1769795849134_amvkq05kb`
4. **There's a session ID mismatch!** Two different session IDs are being created:
   - One from `SessionContext` using `uuidv4()`
   - One from `use-initial-session-tracking.ts` which uses the SessionContext's sessionId

The heartbeat works for sessions that use the UUID format, but fails for the `session_*` format sessions because:
- Many sessions are created by `track-session` edge function but never receive heartbeats
- The session_id in the heartbeat doesn't match the one created

**Fix Strategy:**
- Ensure the real-time analytics hook uses the CORRECT `session_duration_seconds` from sessions
- For sessions without duration, calculate duration from `started_at` to `last_active_at`
- Fallback to showing time since session started

### Issue 3: Globe Not Draggable

**Current State:**
The globe uses `react-simple-maps` with `geoOrthographic` projection, but:
- Only detects click-and-drag to STOP rotation
- Doesn't actually change the rotation angle based on drag direction
- User can't spin the globe to a specific location manually

**The DataFast Reference:**
In the reference image, users can drag the globe to rotate it to any angle, then the tooltip/card stays visible when clicking on a user.

**Fix Strategy:**
1. Implement actual drag-to-rotate functionality
2. Track mouse delta during drag and update rotation accordingly
3. When dragging, update rotation based on horizontal mouse movement
4. Keep the "stop rotation on drag" behavior but also update angle

### Issue 4: Tooltip Card Doesn't Stay On When Clicked

**Current State:**
- Tooltip appears on hover (`onMouseEnter`)
- Tooltip disappears on mouse leave (`onMouseLeave`)
- No "click to pin" functionality

**Fix Strategy:**
- Add "pinned" state for tooltip
- On click: pin the tooltip (don't close on mouse leave)
- Add close button to pinned tooltip
- Only one tooltip can be pinned at a time

---

## Implementation Plan

### Phase 1: Fix Session Duration Display

**File: `src/hooks/useEnhancedRealTimeAnalytics.ts`**

Calculate duration dynamically for sessions without `session_duration_seconds`:

```typescript
// In the user mapping section
const calculateDuration = (session: any): number => {
  // If we have actual duration, use it
  if (session.session_duration_seconds && session.session_duration_seconds > 0) {
    return session.session_duration_seconds;
  }
  
  // Calculate from timestamps
  const startedAt = new Date(session.started_at).getTime();
  const lastActive = session.last_active_at 
    ? new Date(session.last_active_at).getTime() 
    : Date.now();
  
  return Math.floor((lastActive - startedAt) / 1000);
};

// Use it:
sessionDurationSeconds: calculateDuration(session),
```

### Phase 2: Globe Drag-to-Rotate

**File: `src/components/admin/analytics/realtime/PremiumGlobeMap.tsx`**

Implement actual rotation control during drag:

```typescript
// New state for drag rotation
const [dragOffset, setDragOffset] = useState(0);
const isDragging = useRef(false);

// Handle mouse move during drag
const handleGlobeMouseMove = (e: React.MouseEvent) => {
  if (isDragging.current && dragStartPos.current) {
    // Calculate horizontal delta
    const dx = e.clientX - dragStartPos.current.x;
    // Convert to rotation degrees (scaled for sensitivity)
    setDragOffset(dx * 0.3);
  }
  // Also update tooltip position if hovered
  if (hoveredUser) {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }
};

// On mouse down: start drag, record position
const handleGlobeMouseDown = (e: React.MouseEvent) => {
  dragStartPos.current = { x: e.clientX, y: e.clientY };
  isDragging.current = true;
};

// On mouse up: if dragged significantly, apply rotation and stop auto-rotate
const handleGlobeMouseUp = (e: React.MouseEvent) => {
  if (dragStartPos.current) {
    const dx = e.clientX - dragStartPos.current.x;
    if (Math.abs(dx) > 5) {
      // Apply the drag offset to base rotation
      setRotation(prev => (prev + dragOffset) % 360);
      setIsManuallyPaused(true);
    }
  }
  isDragging.current = false;
  setDragOffset(0);
  dragStartPos.current = null;
};

// In the projection config, combine rotation + dragOffset
projectionConfig={{
  scale: 280,
  rotate: [-(rotation + dragOffset), -20, 0],
  center: [0, 0],
}}
```

### Phase 3: Click-to-Pin Tooltip

**File: `src/components/admin/analytics/realtime/PremiumGlobeMap.tsx`**

Add pinned tooltip functionality:

```typescript
// New state
const [pinnedUser, setPinnedUser] = useState<EnhancedActiveUser | null>(null);
const [pinnedTooltipPos, setPinnedTooltipPos] = useState<{x: number; y: number} | null>(null);

// On marker click: pin the user
const handleMarkerClick = (user: EnhancedActiveUser, e: React.MouseEvent) => {
  e.stopPropagation();
  if (pinnedUser?.sessionId === user.sessionId) {
    // Clicking same user unpins
    setPinnedUser(null);
    setPinnedTooltipPos(null);
  } else {
    setPinnedUser(user);
    setPinnedTooltipPos({ x: e.clientX, y: e.clientY });
  }
  onUserClick?.(user);
};

// Click on globe (not marker) closes pinned tooltip
const handleGlobeBackgroundClick = () => {
  setPinnedUser(null);
  setPinnedTooltipPos(null);
};

// Render both hover tooltip and pinned tooltip
{hoveredUser && !pinnedUser && tooltipPos && (
  <UserTooltipCard user={hoveredUser} position={tooltipPos} />
)}

{pinnedUser && pinnedTooltipPos && (
  <UserTooltipCard 
    user={pinnedUser} 
    position={pinnedTooltipPos}
    pinned={true}
    onClose={() => { setPinnedUser(null); setPinnedTooltipPos(null); }}
  />
)}
```

**File: `src/components/admin/analytics/realtime/UserTooltipCard.tsx`**

Add close button for pinned state:

```typescript
interface UserTooltipCardProps {
  user: EnhancedActiveUser;
  position?: { x: number; y: number };
  pinned?: boolean;
  onClose?: () => void;
}

// In the component header:
{pinned && (
  <button 
    onClick={onClose}
    className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted"
  >
    <X className="w-4 h-4" />
  </button>
)}
```

### Phase 4: Better Referrer Display for Anonymous Users

**File: `src/hooks/useEnhancedRealTimeAnalytics.ts`**

For anonymous visitors, try to get more data from the session:

```typescript
// Improve referrer normalization with more sources
const normalizeReferrer = (referrer: string | null, utmSource: string | null): string => {
  const source = referrer?.toLowerCase() || utmSource?.toLowerCase() || '';
  
  if (!source) return 'Direct';
  if (source.includes('google')) return 'Google';
  if (source.includes('facebook') || source.includes('fb.')) return 'Facebook';
  if (source.includes('linkedin')) return 'LinkedIn';
  if (source.includes('twitter') || source.includes('x.com') || source.includes('t.co')) return 'X (Twitter)';
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('tiktok')) return 'TikTok';
  if (source.includes('youtube')) return 'YouTube';
  if (source.includes('reddit')) return 'Reddit';
  if (source.includes('lovable.dev')) return 'Lovable Preview';
  if (source.includes('bing')) return 'Bing';
  
  // Try to extract domain name
  try {
    const url = new URL(source.startsWith('http') ? source : `https://${source}`);
    return url.hostname.replace('www.', '');
  } catch {
    return 'Referral';
  }
};
```

### Phase 5: Show Pages Visited for Anonymous Users

**File: `src/components/admin/analytics/realtime/UserTooltipCard.tsx`**

Make current page more prominent for anonymous users:

```typescript
{/* For anonymous users, show their journey */}
{user.isAnonymous && (
  <div className="p-4 border-b border-border/50">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      Visitor Journey
    </p>
    <div className="text-xs text-muted-foreground">
      <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">
        {user.currentPage || '/'}
      </span>
    </div>
  </div>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useEnhancedRealTimeAnalytics.ts` | Calculate session duration from timestamps when not available, improve referrer normalization |
| `src/components/admin/analytics/realtime/PremiumGlobeMap.tsx` | Implement drag-to-rotate, add pinned tooltip state, handle click-to-pin |
| `src/components/admin/analytics/realtime/UserTooltipCard.tsx` | Add close button prop for pinned state, show visitor journey for anonymous |

---

## Technical Details

### Drag-to-Rotate Math

```
Rotation Calculation:
- Base rotation: auto-rotate value (0-360°)
- Drag offset: mouse delta X * sensitivity (0.3)
- Final rotation: base + dragOffset
- On drag end: merge dragOffset into base rotation
```

### Session Duration Fallback

```
Priority:
1. session_duration_seconds from database (if > 0)
2. Calculate: last_active_at - started_at
3. Calculate: now() - started_at (for very recent sessions)
```

### Tooltip Pinning State Machine

```
States:
  IDLE: No tooltip visible
  HOVER: Temporary tooltip on hover
  PINNED: Locked tooltip with close button

Transitions:
  IDLE → HOVER: Mouse enters marker
  HOVER → IDLE: Mouse leaves marker
  HOVER → PINNED: Click on marker
  PINNED → IDLE: Click close button OR click background
  PINNED → PINNED (different user): Click another marker
```

---

## Expected Results

After implementation:
1. Session time shows actual duration (calculated from timestamps if needed)
2. Globe can be dragged to rotate to any angle
3. Clicking on a user pins the tooltip card (stays visible)
4. Pinned card has X button to close
5. Anonymous visitor referrer shows normalized source (Google, Direct, etc.)
6. Better understanding of anonymous visitor behavior through current page display
