
# Fullscreen Globe Optimization Plan

## Problem Analysis

### 1. Whitespace at Top Issue
The globe is not truly fullscreen because:
- The fixed overlay is rendering inside the React component tree, which may be inside a container with CSS transforms or positioned ancestors
- The AdminLayout has a sticky header that may affect stacking context
- React Portal is not being used, so the overlay is subject to parent container constraints

### 2. Slow Loading Issue
Current loading sequence (3+ network requests):
1. User clicks globe → Component mounts
2. `useEnhancedRealTimeAnalytics` fetches session data from Supabase
3. MapboxGlobeMap fetches token from `get-mapbox-token` edge function  
4. Mapbox GL JS initializes and loads satellite tiles

### 3. Default Visibility
Currently the globe is hidden and toggled via the floating button.

---

## Solution Architecture

### Part 1: True Fullscreen with React Portal

Render the fullscreen overlay using `ReactDOM.createPortal` directly into `document.body` to escape all parent container constraints.

**Changes to `FullscreenGlobeView.tsx`:**
- Wrap the entire overlay in a Portal that renders to `document.body`
- This ensures it sits at the document root, completely bypassing AdminLayout

### Part 2: Performance Optimization Strategy

**A. Preload Mapbox Token on App Mount**
- Create a global token cache that fetches the Mapbox token once on app initialization
- Store in React Context or module-level variable
- The globe component reads from cache instead of making a network request

**B. Preload Analytics Data**
- Use `staleTime: Infinity` with background refetch so data is always instantly available from cache
- Prefetch analytics data when the Dashboard tab is active (before globe is opened)

**C. Lazy Load Mapbox GL JS**
- The library is already loaded via npm, but we can optimize tile loading
- Use lower-resolution style initially, then upgrade

**D. Map Instance Persistence**
- Keep the Mapbox map instance alive in memory when globe is closed (just hide it)
- This prevents re-initialization on subsequent opens

### Part 3: Globe-First Dashboard Experience

**New Flow:**
1. Admin lands on `/admin` → Globe visible by default (fullscreen)
2. Press ESC or click X → Globe hides, dashboard content visible
3. Click globe icon → Toggle back to fullscreen globe

**Implementation:**
- Store globe visibility state in localStorage for persistence
- On first visit: globe is shown
- User preference is remembered

---

## Technical Implementation

### File Changes

#### 1. `src/components/admin/analytics/datafast/FullscreenGlobeView.tsx`
- Add React Portal wrapper using `createPortal()`
- Portal target: `document.body`
- Add CSS to ensure truly fullscreen (position fixed, all insets 0)

#### 2. `src/hooks/useMapboxToken.ts` (new file)
- Create a dedicated hook for Mapbox token with caching
- Fetch once on mount, store in module-level variable
- Subsequent calls return cached value instantly

#### 3. `src/components/admin/analytics/datafast/FloatingGlobeToggle.tsx`
- Add localStorage persistence for globe visibility
- Default to `true` (globe open) on first visit
- Read from localStorage on mount

#### 4. `src/hooks/useEnhancedRealTimeAnalytics.ts`
- Increase `staleTime` to serve cached data instantly
- Background refetch keeps data fresh

#### 5. `src/components/admin/analytics/realtime/MapboxGlobeMap.tsx`
- Use the new `useMapboxToken` hook
- Add option to persist map instance across show/hide cycles

---

## Detailed Code Strategy

### Portal Implementation
```text
createPortal(
  <div className="fixed inset-0 z-[99999]" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}>
    {/* Globe content */}
  </div>,
  document.body
)
```

### Token Caching
```text
// Module-level cache
let cachedToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

export function useMapboxToken() {
  // Return cached immediately if available
  // Otherwise fetch and cache
}
```

### Visibility Persistence
```text
const STORAGE_KEY = 'globe-visible-default';

// On mount
const stored = localStorage.getItem(STORAGE_KEY);
const defaultOpen = stored === null ? true : stored === 'true';

// On toggle
localStorage.setItem(STORAGE_KEY, String(!isGlobeOpen));
```

---

## Expected Performance Improvement

| Metric | Before | After |
|--------|--------|-------|
| Time to globe visible | ~2-3s | ~0.3s (cached) |
| Network requests on toggle | 3+ | 0 (all cached) |
| Map re-initialization | Every toggle | Never (persisted) |
| Fullscreen accuracy | 95% (whitespace) | 100% |

---

## Summary

1. **Fix whitespace**: Use React Portal to render directly to `document.body`
2. **Speed up loading**: 
   - Cache Mapbox token at app level
   - Prefetch analytics data
   - Persist map instance
3. **Default visibility**: Globe shown on landing, ESC to hide, toggle to show
