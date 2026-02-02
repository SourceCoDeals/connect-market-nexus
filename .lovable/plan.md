
# Intelligence Center: Tooltips, Logos, Sort Toggle & Real Data Fix

## Summary of Issues Found

I've investigated deeply and identified **7 distinct issues** that need to be addressed:

---

## Issue 1: Sort Toggle (Visitors/Connections) Doesn't Work

**Current Behavior:** Clicking the Visitors ↓ toggle does nothing - the list doesn't re-sort.

**Root Cause in `SourcesCard.tsx` (lines 55-57, 145-185):**
```typescript
// sortBy state is defined correctly
const [sortBy, setSortBy] = useState<'visitors' | 'connections'>('visitors');

// Channels ARE sorted correctly (line 55-57)
const sortedChannels = [...channels].sort((a, b) => 
  sortBy === 'visitors' ? b.visitors - a.visitors : b.connections - a.connections
);

// BUT referrers tab doesn't use the sorted version!
{referrers.slice(0, 8).map((ref) => ...)} // ← Not sorted by sortBy!
```

**Same issue in:**
- `GeographyCard.tsx`: Regions tab doesn't use `sortBy`
- `PagesCard.tsx`: Entry/Exit pages don't have connection data to sort by
- `TechStackCard.tsx`: Has `sortBy` state but no connection data exists

**Fix:**
1. Sort referrers, campaigns, keywords by `sortBy` in SourcesCard
2. Sort regions by `sortBy` in GeographyCard
3. Add connection counts to geography, pages, and tech stack data

---

## Issue 2: Referrer Tooltips Need Visitors + Connections Data

**Current State:** Tooltips already exist in `SourcesCard.tsx` (lines 146-153) showing:
- Visitors
- Connections
- Conv. Rate

**What's Missing:** Connections data is always `0` in the referrers array because `useUnifiedAnalytics.ts` (line 433) doesn't calculate connections per referrer:

```typescript
const referrers = Object.keys(referrerVisitors)
  .map(domain => ({ 
    domain, 
    visitors: referrerVisitors[domain].size, 
    sessions: referrerSessions[domain] || 0,
    connections: 0,  // ← ALWAYS ZERO!
    favicon: `...`
  }))
```

**Fix:** Calculate referrer connections by mapping user's connection to their first-touch referrer.

---

## Issue 3: Referrer Logos Use Generic Google Favicons

**Current Implementation (line 163-168 in SourcesCard.tsx):**
```tsx
<img 
  src={ref.favicon}  // Uses Google favicon service
  alt="" 
  className="w-4 h-4 rounded"
/>
```

**The favicon URLs are:**
```typescript
favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
```

**Problem:** This works for known domains, but for Brevo email domains like `exdov.r.sp1-brevo.net`, the favicons are generic or broken.

**Fix:** Create a `ReferrerLogo` component that:
1. Checks for known platforms (Brevo, Mailchimp, Google, LinkedIn, etc.)
2. Shows custom SVG icons for recognized services
3. Falls back to Google favicon service only for unknown domains

---

## Issue 4: Geography Card Shows Wrong Connection Counts

**Database Reality:**
| Country | Sessions | Unique Visitors | Connections |
|---------|----------|-----------------|-------------|
| NULL (Unknown) | 253 | 64 | **ALL connections are from users with NULL country** |
| France | 38 | 8 | 0 |
| Netherlands | 29 | 3 | 0 |
| UK | 16 | 3 | 0 |

**Root Cause:** All users who made connections don't have country data on their sessions (checked via database query).

**Current Code (lines 510-518):**
```typescript
const countries = Object.keys(countryVisitors)
  .map(name => ({ 
    name, 
    code: name.substring(0, 2).toUpperCase(), 
    visitors: countryVisitors[name].size,
    sessions: countrySessions[name] || 0,
    connections: 0  // ← ALWAYS ZERO - no calculation!
  }))
```

**Fix:**
1. Calculate connections per country by joining user's connection with their session country
2. Handle NULL country gracefully (show as "Unknown Location")
3. Add proper connection attribution to geography breakdown

---

## Issue 5: Country Tooltips Missing Connection Data

**Current Tooltip (GeographyCard.tsx lines 145-152):**
```tsx
<AnalyticsTooltip
  title={country.name}
  rows={[
    { label: 'Visitors', value: country.visitors.toLocaleString() },
    { label: 'Connections', value: country.connections },  // Shows 0
    { label: 'Conv. Rate', value: `${...}%`, highlight: true },
  ]}
>
```

**The data is shown but values are wrong** - connections is always 0 because of Issue #4.

---

## Issue 6: Regions Tab Shows No Data

**Current Code (line 802):**
```typescript
regions: [],  // ← Empty array returned!
```

**The regions aggregation exists in the session data but isn't being processed.**

**Fix:** Aggregate region data from sessions with proper visitor counting:
```typescript
const regionVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
uniqueSessions.forEach(s => {
  if (s.region) {
    // ... aggregate region data
  }
});
```

---

## Issue 7: Pages, Tech Stack, and Funnel Cards Missing Connection Attribution

These cards show visitor counts but have no connection data:

**Pages Card:**
- Top pages show visitors but no "which pages led to connections"
- Entry pages show bounces but no conversion data
- Exit pages show exits but no connection correlation

**Tech Stack Card:**
- Shows browser/OS visitor counts
- No connection attribution (which browser converts best?)

**Funnel Card:**
- Uses real NDA/Fee Agreement data ✓
- But shows generic counts, not cohort analysis

---

## Implementation Plan

### Phase 1: Fix Sort Toggle (All Cards)

**Files to modify:**
- `src/components/admin/analytics/datafast/SourcesCard.tsx`
- `src/components/admin/analytics/datafast/GeographyCard.tsx`

Add proper sorting to all tabs based on `sortBy` state.

### Phase 2: Add Connection Attribution to Referrers

**File:** `src/hooks/useUnifiedAnalytics.ts`

```typescript
// Map connections to referrers via user's first session referrer
const referrerConnections: Record<string, number> = {};
connections.forEach(c => {
  if (c.user_id) {
    const userSession = uniqueSessions.find(s => s.user_id === c.user_id);
    if (userSession) {
      const domain = extractDomain(userSession.referrer);
      referrerConnections[domain] = (referrerConnections[domain] || 0) + 1;
    }
  }
});

// Use in referrers array
const referrers = Object.keys(referrerVisitors)
  .map(domain => ({ 
    domain, 
    visitors: referrerVisitors[domain].size,
    sessions: referrerSessions[domain] || 0,
    connections: referrerConnections[domain] || 0,  // ← Now populated!
    favicon: `...`
  }))
```

### Phase 3: Create ReferrerLogo Component

**New file:** `src/components/admin/analytics/datafast/ReferrerLogo.tsx`

```typescript
interface ReferrerLogoProps {
  domain: string;
  className?: string;
}

// Known platform logos (SVG inline)
const KNOWN_PLATFORMS: Record<string, React.FC> = {
  'brevo': BrevoLogo,
  'sendibt': BrevoLogo,  // Brevo's tracking domain
  'mailchimp': MailchimpLogo,
  'google': GoogleLogo,
  'linkedin': LinkedInLogo,
  'twitter': XLogo,
  'facebook': FacebookLogo,
  'sourcecodeals': SourceCodealsLogo,
};

export function ReferrerLogo({ domain, className }: ReferrerLogoProps) {
  const lowerDomain = domain.toLowerCase();
  
  // Check for known platforms
  for (const [key, LogoComponent] of Object.entries(KNOWN_PLATFORMS)) {
    if (lowerDomain.includes(key)) {
      return <LogoComponent className={className} />;
    }
  }
  
  // Fallback to favicon
  return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} ... />;
}
```

### Phase 4: Add Connection Attribution to Geography

**File:** `src/hooks/useUnifiedAnalytics.ts`

```typescript
// Map connections to countries via user's session
const countryConnections: Record<string, number> = {};
connections.forEach(c => {
  if (c.user_id) {
    const userSession = uniqueSessions.find(s => s.user_id === c.user_id);
    if (userSession?.country) {
      countryConnections[userSession.country] = (countryConnections[userSession.country] || 0) + 1;
    } else {
      // User has no country - count as Unknown
      countryConnections['Unknown'] = (countryConnections['Unknown'] || 0) + 1;
    }
  }
});

const countries = Object.keys(countryVisitors)
  .map(name => ({ 
    name, 
    code: name.substring(0, 2).toUpperCase(), 
    visitors: countryVisitors[name].size,
    sessions: countrySessions[name] || 0,
    connections: countryConnections[name] || 0,  // ← Now populated!
  }))
```

### Phase 5: Populate Regions Data

**File:** `src/hooks/useUnifiedAnalytics.ts`

Add region aggregation (currently returns empty array):
```typescript
const regionVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
uniqueSessions.forEach(s => {
  if (s.region) {
    const key = s.region;
    if (!regionVisitors[key]) {
      regionVisitors[key] = { visitors: new Set(), sessions: 0, country: s.country || 'Unknown' };
    }
    const visitorKey = getVisitorKey(s);
    if (visitorKey) regionVisitors[key].visitors.add(visitorKey);
    regionVisitors[key].sessions++;
  }
});

const regions = Object.entries(regionVisitors)
  .map(([name, data]) => ({
    name,
    country: data.country,
    visitors: data.visitors.size,
    sessions: data.sessions,
    connections: 0, // Would need region-level connection tracking
  }))
  .sort((a, b) => b.visitors - a.visitors)
  .slice(0, 10);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Add connection attribution to referrers, countries, cities; populate regions |
| `src/components/admin/analytics/datafast/SourcesCard.tsx` | Fix sort toggle for referrers/campaigns/keywords tabs |
| `src/components/admin/analytics/datafast/GeographyCard.tsx` | Fix sort toggle for regions tab |
| `src/components/admin/analytics/datafast/ReferrerLogo.tsx` | NEW: Create component with known platform logos |

---

## Expected Results After Fix

| Feature | Before | After |
|---------|--------|-------|
| Sort toggle | Only works on first tab | Works on all tabs |
| Referrer connections | Always 0 | Shows real attribution |
| Referrer logos | Generic favicons for Brevo | Brand logos for known platforms |
| Country connections | Always 0 | Shows user-country attribution |
| Regions data | Empty | Populated from session data |
| Tooltips | Show zeros | Show real visitor + connection counts |

---

## Technical Note: Connection Attribution Limitation

Currently, ~22 users have made connections, but **none of them have country data in their sessions**. This means:
- Country connections will show 0 until more users with country data convert
- Going forward, new sessions should have country data (geo-tracking is now working)
- The code fix will work correctly once session geo-data is populated

This is a **data gap**, not a code bug. The fix ensures the infrastructure is ready to display connection attribution once the data exists.
