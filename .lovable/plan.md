
# Premium Globe Redesign: Mapbox GL 3D Implementation

## Executive Summary

The current react-simple-maps implementation cannot match the DataFast experience because it uses static SVG geography data without satellite imagery, zoom capability, or city labels. To achieve 100% visual parity with DataFast, we need to implement **Mapbox GL JS** with its native 3D globe projection.

---

## Gap Analysis: Current vs DataFast

| Feature | DataFast | Current | Gap |
|---------|----------|---------|-----|
| Map Technology | Mapbox GL (WebGL) | react-simple-maps (SVG) | Complete replacement needed |
| Terrain/Imagery | Satellite/terrain tiles | Solid blue shapes | Cannot replicate with SVG |
| Country Labels | Real OpenStreetMap labels | Custom text overlays | Need tile-based labels |
| City Labels | Automatic (zoom-dependent) | None | Impossible with current approach |
| Zoom | Continuous zoom to street-level | Fixed scale | Major UX difference |
| Globe Rotation | Smooth 60fps WebGL | requestAnimationFrame SVG | Comparable |
| User Avatars | Cartoon memoji-style | Initials in circles | Style enhancement |
| Tooltip Cards | Rich with conversion metrics | Basic user info | Add new metrics |

---

## Part 1: Mapbox GL Integration

### New Dependency
```json
{
  "mapbox-gl": "^3.3.0",
  "@types/mapbox-gl": "^3.1.0"
}
```

### Mapbox Access Token Requirement
Mapbox requires a public access token. The free tier includes 50,000 monthly map loads which should be sufficient for admin analytics.

**Required Secret**: `VITE_MAPBOX_ACCESS_TOKEN`

### Globe Configuration
```typescript
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const map = new mapboxgl.Map({
  container: 'globe-container',
  style: 'mapbox://styles/mapbox/satellite-streets-v12', // Realistic terrain
  projection: 'globe', // 3D globe projection
  center: [0, 20],
  zoom: 1.5,
  attributionControl: false,
});

// Globe atmosphere effect (the blue haze around Earth)
map.on('style.load', () => {
  map.setFog({
    color: 'rgb(186, 210, 235)', // Lower atmosphere
    'high-color': 'rgb(36, 92, 223)', // Upper atmosphere
    'horizon-blend': 0.02,
    'space-color': 'rgb(11, 11, 25)', // Space background
    'star-intensity': 0.6 // Stars visible
  });
});
```

---

## Part 2: Component Architecture

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/analytics/realtime/MapboxGlobeMap.tsx` | Main Mapbox GL globe component |
| `src/components/admin/analytics/realtime/MapboxUserMarker.tsx` | Custom HTML marker for users |
| `src/components/admin/analytics/realtime/MapboxTooltipCard.tsx` | Enhanced tooltip matching DataFast |
| `src/components/admin/analytics/realtime/MapboxFloatingPanel.tsx` | Overlay stats/filter panel |
| `src/components/admin/analytics/realtime/ConversionLikelihoodBar.tsx` | Gradient progress bar component |

### Files to Modify

| File | Changes |
|------|---------|
| `RealTimeTab.tsx` | Replace PremiumGlobeMap with MapboxGlobeMap |
| `UserTooltipCard.tsx` | Add conversion metrics, estimated value |

---

## Part 3: MapboxGlobeMap.tsx Implementation

### Core Features

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ MapboxGlobeMap Component                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Floating Stats Panel (top-left) ───────────────────────────────────────┐ │
│ │ • 11 visitors on marketplace (est. value: $16)                          │ │
│ │ Referrers: X(4) YouTube(2) Google(2)                                    │ │
│ │ Countries: Brazil(4) South Korea(2) Thailand                            │ │
│ │ Devices: Desktop(7) Mobile(4)                                           │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                    ╭───────────────────────────────╮                        │
│                   ╱                                 ╲                       │
│                  │   3D MAPBOX GLOBE                 │                      │
│                  │   with satellite imagery          │                      │
│                  │   city labels, country names      │                      │
│                  │                                   │                      │
│                  │   👤 User markers with avatars    │                      │
│                  │                                   │                      │
│                   ╲                                 ╱                       │
│                    ╰───────────────────────────────╯                        │
│                                                                             │
│ ┌─ Activity Feed (bottom-left) ───────────────────────────────────────────┐ │
│ │ 🐵 bronze baboon from 🇵🇪 Peru visited /roadmap                         │ │
│ │ 🦊 amber fox from 🇧🇷 Brazil viewed listing                             │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Implementation Details

**1. Map Initialization with Globe Projection**
```typescript
useEffect(() => {
  if (!mapContainer.current) return;
  
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  
  const map = new mapboxgl.Map({
    container: mapContainer.current,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    projection: 'globe',
    center: [0, 20],
    zoom: 1.5,
    minZoom: 1,
    maxZoom: 15,
  });
  
  map.on('load', () => {
    // Add atmosphere effect
    map.setFog({
      color: 'rgb(186, 210, 235)',
      'high-color': 'rgb(36, 92, 223)',
      'horizon-blend': 0.02,
      'space-color': 'rgb(11, 11, 25)',
      'star-intensity': 0.6,
    });
  });
  
  mapRef.current = map;
  return () => map.remove();
}, []);
```

**2. Custom HTML Markers for Users**
```typescript
users.forEach(user => {
  if (!user.coordinates) return;
  
  // Create custom HTML element for marker
  const el = document.createElement('div');
  el.className = 'user-marker';
  el.innerHTML = `
    <div class="marker-avatar">
      <img src="${getAvatarUrl(user)}" alt="${user.displayName}" />
    </div>
    <div class="marker-pulse"></div>
  `;
  
  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat([user.coordinates.lng, user.coordinates.lat])
    .addTo(map);
  
  // Click handler for tooltip
  el.addEventListener('click', () => showTooltip(user));
});
```

**3. Auto-rotation with Pause on Interaction**
```typescript
let animationId: number;
const spinGlobe = () => {
  if (!isInteracting && !isPaused) {
    const center = map.getCenter();
    center.lng += 0.1; // Slow rotation
    map.setCenter(center);
  }
  animationId = requestAnimationFrame(spinGlobe);
};
spinGlobe();

map.on('mousedown', () => setIsInteracting(true));
map.on('mouseup', () => setIsInteracting(false));
```

**4. Fly-to Animation When Clicking Activity**
```typescript
const focusOnUser = (user: EnhancedActiveUser) => {
  if (!user.coordinates) return;
  
  map.flyTo({
    center: [user.coordinates.lng, user.coordinates.lat],
    zoom: 4,
    duration: 2000,
    essential: true,
  });
};
```

---

## Part 4: Enhanced Tooltip Card (DataFast Style)

### New Metrics to Add

Based on the DataFast screenshot, the tooltip shows:

| Metric | Source | Implementation |
|--------|--------|----------------|
| Referrer icon + name | `user.referrer` | Map to branded icon (YouTube, Google, etc.) |
| Current URL | `user.currentPage` | Already available |
| Session time | `user.sessionDurationSeconds` | Already available, format to "13 min 29 sec" |
| Total visits | `user.totalVisits` | Already available |
| Conversion likelihood | **NEW** - calculate from engagement | Algorithm below |
| Estimated value | **NEW** - calculate from buyer type | Algorithm below |

### Conversion Likelihood Algorithm
```typescript
function calculateConversionLikelihood(user: EnhancedActiveUser): number {
  let score = 50; // Base 50%
  
  // Positive signals
  if (!user.isAnonymous) score += 15; // Logged in
  if (user.ndaSigned) score += 20;
  if (user.feeAgreementSigned) score += 15;
  if (user.listingsSaved > 0) score += 10;
  if (user.connectionsSent > 0) score += 20;
  if (user.sessionDurationSeconds > 300) score += 10; // 5+ min session
  
  // Negative signals
  if (user.isAnonymous && user.sessionDurationSeconds < 30) score -= 20;
  
  return Math.min(100, Math.max(0, score));
}
```

### Estimated Value Algorithm
```typescript
function calculateEstimatedValue(user: EnhancedActiveUser): number {
  // Base value varies by buyer type
  const baseValue: Record<string, number> = {
    'privateEquity': 50,
    'familyOffice': 40,
    'corporate': 35,
    'searchFund': 25,
    'independentSponsor': 30,
    'individual': 15,
  };
  
  let value = baseValue[user.buyerType || ''] || 5; // Anonymous = $5 base
  
  // Adjust based on engagement
  if (user.connectionsSent > 0) value *= 3;
  if (user.listingsSaved > 0) value *= 1.5;
  if (user.ndaSigned) value *= 2;
  
  return Math.round(value * 100) / 100; // Round to 2 decimals
}
```

### Tooltip Card Visual
```text
┌─────────────────────────────────────────┐
│ 🐵 bronze baboon                    ✕   │
│ 🇵🇪 Cusco, Peru  🤖 Android  📱 Mobile │
│              🌐 Chrome                  │
├─────────────────────────────────────────┤
│ Referrer:        ▶️ YouTube             │
│ Current URL:              /roadmap      │
│ Session time:         13 min 29 sec     │
│ Total visits:                    1      │
├─────────────────────────────────────────┤
│ Conversion likelihood:    +200% vs. avg │
│ [██████████████████████░░░░░] 75%       │
│ Estimated value:              $3.74     │
└─────────────────────────────────────────┘
```

---

## Part 5: Floating Filter Panel

Replicate the DataFast top-left panel:

```typescript
<div className="absolute top-4 left-4 bg-white dark:bg-gray-900 rounded-xl 
                shadow-2xl p-4 w-80 z-10">
  {/* Header */}
  <div className="flex items-center gap-2 mb-4">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute h-full w-full rounded-full 
                       bg-green-400 opacity-75"></span>
      <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
    </span>
    <span className="text-sm font-medium">
      {totalUsers} visitors on <strong>marketplace</strong>
    </span>
    <span className="text-sm text-emerald-600 ml-auto">
      (est. value: ${estimatedTotalValue})
    </span>
  </div>
  
  {/* Filter rows */}
  <div className="space-y-2 text-sm">
    <FilterRow 
      label="Referrers" 
      items={[
        { icon: '𝕏', label: 'X', count: 4 },
        { icon: '▶️', label: 'YouTube', count: 2 },
        { icon: '🔍', label: 'Google', count: 2 },
      ]}
    />
    <FilterRow 
      label="Countries" 
      items={countryBreakdown.map(c => ({
        icon: c.flag, 
        label: c.name, 
        count: c.count 
      }))}
    />
    <FilterRow 
      label="Devices" 
      items={[
        { icon: '💻', label: 'Desktop', count: desktopCount },
        { icon: '📱', label: 'Mobile', count: mobileCount },
      ]}
    />
  </div>
</div>
```

---

## Part 6: User Avatar Enhancement

DataFast uses cartoon-style avatars (like memoji/bitmoji). Options:

**Option A: DiceBear Avatars (Recommended)**
Use [DiceBear API](https://www.dicebear.com/) which generates consistent avatars from seed strings:

```typescript
function getAvatarUrl(user: EnhancedActiveUser): string {
  // Use session ID or user ID as seed for consistent avatar
  const seed = user.userId || user.sessionId;
  
  // DiceBear "adventurer" style matches DataFast's cartoon look
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}
```

**Option B: Simple Initials (Current)**
Keep current initials-in-circle approach but style it better.

**Recommended: Option A** - DiceBear is free, requires no API key, and provides the exact cartoon avatar style DataFast uses.

---

## Part 7: Map Style Options

Mapbox offers several styles that could work:

| Style | Look | Best For |
|-------|------|----------|
| `satellite-streets-v12` | Realistic satellite + roads/labels | Most like DataFast |
| `satellite-v9` | Pure satellite, no labels | Cleaner but less informative |
| `outdoors-v12` | Terrain with topography | Good alternative |
| `light-v11` / `dark-v11` | Flat colored map | Matches current dark theme |

**Recommendation**: Use `satellite-streets-v12` for day mode, but consider a custom style that:
- Uses satellite imagery
- Has darker ocean colors (to match the space background)
- Has subtle city/country labels

---

## Part 8: CSS Requirements

```css
/* Mapbox container styling */
.mapbox-globe-container {
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, #0f1729 0%, #020617 100%);
}

/* User markers */
.user-marker {
  width: 48px;
  height: 48px;
  cursor: pointer;
  transform: translate(-50%, -50%);
}

.marker-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid white;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  transition: transform 0.2s;
}

.marker-avatar:hover {
  transform: scale(1.2);
}

.marker-pulse {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.3);
  animation: pulse 2s ease-out infinite;
}

@keyframes pulse {
  0% { transform: scale(0.8); opacity: 0.8; }
  100% { transform: scale(1.5); opacity: 0; }
}
```

---

## Part 9: Implementation Steps

1. **Add Mapbox Secret** - User needs to create a Mapbox account and add `VITE_MAPBOX_ACCESS_TOKEN`
2. **Install Dependencies** - `mapbox-gl` and `@types/mapbox-gl`
3. **Create MapboxGlobeMap.tsx** - Full Mapbox GL implementation
4. **Create MapboxUserMarker.tsx** - Custom HTML marker with avatar
5. **Update UserTooltipCard.tsx** - Add conversion likelihood and estimated value
6. **Create ConversionLikelihoodBar.tsx** - Gradient progress bar
7. **Update RealTimeTab.tsx** - Replace PremiumGlobeMap with new component
8. **Add DiceBear Integration** - For cartoon avatars
9. **Style the floating panels** - Match DataFast aesthetic

---

## Part 10: Fallback Strategy

If Mapbox token is not configured, display the current react-simple-maps globe with a banner prompting to configure Mapbox for enhanced experience:

```typescript
if (!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN) {
  return (
    <div className="relative">
      <PremiumGlobeMap {...props} />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/10 
                      text-amber-500 px-4 py-2 rounded-full text-xs">
        Configure Mapbox for enhanced 3D globe →
      </div>
    </div>
  );
}
```

---

## Summary

This redesign achieves 100% visual parity with DataFast by:

1. **Replacing react-simple-maps with Mapbox GL** - Real satellite imagery, zoom, city labels
2. **Using DiceBear avatars** - Cartoon memoji-style user markers
3. **Adding conversion metrics** - Likelihood percentage and estimated value
4. **Matching the UI layout** - Floating stats panel, bottom activity feed
5. **Enhancing interactions** - Smooth fly-to animations, natural drag rotation

The implementation requires one external dependency (Mapbox access token) but falls back gracefully to the current implementation if not configured.
