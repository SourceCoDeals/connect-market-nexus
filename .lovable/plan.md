
# Fix Referrer Display, User Count Accuracy, and Missing Globe Markers

## Root Cause Analysis

### Issue #1: 23 "Other" Referrers Should Show "Lovable"
**Root Cause:** Two different normalization logics are used:
- `useEnhancedRealTimeAnalytics.ts` has a comprehensive `normalizeReferrer()` function that correctly identifies `lovable.dev` → "Lovable"
- `MapboxGlobeMap.tsx` (lines 92-101) has its OWN inline normalization that checks for google, youtube, facebook, linkedin, twitter but NOT lovable.dev

The inline code:
```typescript
const normalized = source.toLowerCase().includes('google') ? 'Google' :
  source.toLowerCase().includes('youtube') ? 'YouTube' :
  // ... no check for lovable.dev!
  source === 'Direct' || !source ? 'Direct' : 'Other';
```

**Database Evidence:** 23 sessions have `referrer: https://lovable.dev/`

---

### Issue #2: Inflated User Count (29 users shown, but only ~6 unique sessions)
**Root Cause:** The `user_sessions` table has duplicate rows for the same session_id:
- Session `1f24867b-8800-47c1-b7a9-39dad47b959a` appears **24 times**
- The query in `useEnhancedRealTimeAnalytics.ts` doesn't deduplicate by session_id

**Database Evidence:**
```sql
SELECT session_id, COUNT(*) as count 
FROM user_sessions WHERE is_active = true
-- Result: session 1f24867b... has 24 duplicate rows
```

---

### Issue #3: "coral orca" Doesn't Appear on Globe
**Root Cause:** Users without geo data get `coordinates: null` and are skipped:
1. `getCoordinates(city, country)` returns `null` when both are missing
2. `MapboxGlobeMap.tsx` line 214: `if (!user.coordinates) return;` skips these users

**Additional Issue:** Country name mismatch:
- Database stores: `"The Netherlands"`
- Lookup table has: `"Netherlands"` (without "The")
- Result: Amsterdam users get `null` coordinates

---

## Implementation Plan

### Step 1: Use Unified Referrer Normalization

**File:** `src/components/admin/analytics/realtime/MapboxGlobeMap.tsx`

Replace the inline `referrerBreakdown` logic (lines 92-101) to use the user's already-normalized `entrySource` field:

```typescript
// BEFORE (inline duplication):
const referrerBreakdown = users.reduce((acc, user) => {
  const source = user.referrer || user.utmSource || 'Direct';
  const normalized = source.toLowerCase().includes('google') ? 'Google' :
    // ... missing lovable.dev
    source === 'Direct' || !source ? 'Direct' : 'Other';
  acc[normalized] = (acc[normalized] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// AFTER (use pre-normalized entrySource):
const referrerBreakdown = users.reduce((acc, user) => {
  const source = user.entrySource || 'Direct';
  acc[source] = (acc[source] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
```

---

### Step 2: Deduplicate Sessions in Query

**File:** `src/hooks/useEnhancedRealTimeAnalytics.ts`

After fetching sessions, deduplicate by session_id to prevent counting the same user multiple times:

```typescript
// After supabase query, deduplicate:
const sessionsRaw = sessionsResult.data || [];

// Deduplicate by session_id - keep the one with most geo data
const sessionMap = new Map<string, typeof sessionsRaw[0]>();
sessionsRaw.forEach(session => {
  const existing = sessionMap.get(session.session_id);
  if (!existing) {
    sessionMap.set(session.session_id, session);
  } else if (!existing.country && session.country) {
    // Prefer the row with geo data
    sessionMap.set(session.session_id, session);
  }
});
const sessions = Array.from(sessionMap.values());
```

---

### Step 3: Default Coordinates for Users Without Geo Data

**File:** `src/hooks/useEnhancedRealTimeAnalytics.ts`

Provide fallback coordinates so users without geo data still appear on the globe:

```typescript
// When getting coordinates:
let coordinates = getCoordinates(session.city, session.country);

// Fallback: use a random but consistent location if no geo data
if (!coordinates) {
  coordinates = getDefaultCoordinates(session.session_id);
}
```

New helper function:
```typescript
function getDefaultCoordinates(sessionId: string): { lat: number; lng: number } {
  // Use session ID to generate consistent random position in Atlantic Ocean
  // This keeps users visible but clearly "unknown location"
  const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    lat: 25 + (hash % 30), // Between 25°N and 55°N
    lng: -30 + (hash % 20), // Atlantic Ocean area
  };
}
```

---

### Step 4: Fix Country Name Variations

**File:** `src/lib/geoCoordinates.ts`

Add common variations of country names:

```typescript
const countryCoordinates: Record<string, Coordinates> = {
  // ... existing entries
  'Netherlands': { lat: 52.1326, lng: 5.2913 },
  'The Netherlands': { lat: 52.1326, lng: 5.2913 },  // Add variation
  // ... other variations as needed
};
```

Also add a normalization step in `getCoordinates()`:

```typescript
export function getCoordinates(city: string | null, country: string | null): Coordinates | null {
  // Normalize country name
  const normalizedCountry = country?.replace(/^The /, '') || null;
  
  if (city && cityCoordinates[city]) {
    return cityCoordinates[city];
  }
  
  if (normalizedCountry && countryCoordinates[normalizedCountry]) {
    return countryCoordinates[normalizedCountry];
  }
  if (country && countryCoordinates[country]) {
    return countryCoordinates[country];
  }
  
  return null;
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `MapboxGlobeMap.tsx` | Use `user.entrySource` instead of inline referrer normalization |
| `useEnhancedRealTimeAnalytics.ts` | Add session deduplication by `session_id`, add fallback coordinates |
| `geoCoordinates.ts` | Add "The Netherlands" variation, normalize country names |

---

## Expected Results After Fix

**Referrers Panel:**
- Shows "Lovable 23" instead of "Other 23"
- Shows "Direct 6" for null referrers
- Future: Shows actual sources (ChatGPT, LinkedIn, etc.) as visitors arrive

**User Count:**
- Shows actual unique sessions (~6) instead of inflated count (29)

**Globe Markers:**
- "coral orca" and other users without geo data appear in Atlantic Ocean area
- All active users visible regardless of geo data availability
- Click from Live Activity feed navigates to user on map
