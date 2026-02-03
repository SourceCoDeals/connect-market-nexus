

# Accurate Attribution Data Plan

## Problem Summary

The Sources card (Channel/Referrer/Campaign/Keyword) is showing **incorrect attribution data** because it only uses the immediate `referrer` field, ignoring the TRUE discovery source stored in `utm_source` and `original_external_referrer`.

### Specific Example
**Violet Fox** (session `7c66aa59-...`):
- Shows as coming from `sourcecodeals.com` in the Referrer card
- But the TRUE discovery source is `chatgpt.com` (stored in `utm_source`)
- The user's journey was: ChatGPT → Blog → Marketplace

### Data Hierarchy in Database

| Field | Purpose | Example |
|-------|---------|---------|
| `original_external_referrer` | First external discovery source (cross-domain tracking) | `www.google.com` |
| `utm_source` | Explicit attribution parameter | `chatgpt.com`, `brevo` |
| `referrer` | Immediate HTTP referrer | `https://www.sourcecodeals.com/` |

---

## Root Cause Analysis

### Current Code (useUnifiedAnalytics.ts, lines 741-750)

```
uniqueSessions.forEach(s => {
  const domain = extractDomain(s.referrer);  // PROBLEM: Only uses immediate referrer!
  // ...counts visitors by this domain...
});
```

This logic ignores:
1. `utm_source` - The ChatGPT visitor has `utm_source='chatgpt.com'` but it's never checked
2. `original_external_referrer` - Cross-domain tracking data is ignored for visitor aggregation

### Same issue in Channel aggregation (line 673)

```
const channel = categorizeChannel(s.referrer, s.utm_source, s.utm_medium);
```

The `categorizeChannel` function receives `utm_source` but for referrer extraction, we only use `s.referrer`.

---

## Solution: "Discovery Source" Priority System

Implement a consistent priority system for determining the TRUE discovery source:

```
Priority 1: original_external_referrer (most accurate cross-domain tracking)
Priority 2: utm_source (explicit attribution from URL params)
Priority 3: referrer (immediate HTTP referrer - fallback)
```

### Implementation

**1. Create helper function: `getDiscoverySource(session)`**

```text
function getDiscoverySource(session: SessionData): string | null {
  // Priority 1: Cross-domain tracking (most accurate)
  if (session.original_external_referrer) {
    return session.original_external_referrer;
  }
  
  // Priority 2: Explicit UTM source (e.g., chatgpt.com, brevo)
  if (session.utm_source) {
    return session.utm_source;
  }
  
  // Priority 3: Immediate referrer (fallback)
  return session.referrer;
}
```

**2. Update Referrer aggregation**

Change from:
```text
const domain = extractDomain(s.referrer);
```

To:
```text
const discoverySource = getDiscoverySource(s);
const domain = extractDomain(discoverySource);
```

**3. Update Channel aggregation**

Already uses `categorizeChannel(s.referrer, s.utm_source, s.utm_medium)` which checks `utm_source`, but the priority order needs adjustment to check `original_external_referrer` first.

---

## Files to Modify

### 1. `src/hooks/useUnifiedAnalytics.ts`

**Add new helper function (~line 155):**
```text
function getDiscoverySource(session: {
  original_external_referrer?: string | null;
  utm_source?: string | null;
  referrer?: string | null;
}): string | null {
  if (session.original_external_referrer) return session.original_external_referrer;
  if (session.utm_source) return session.utm_source;
  return session.referrer || null;
}
```

**Update Referrer aggregation (~line 741-750):**
```text
uniqueSessions.forEach(s => {
  const discoverySource = getDiscoverySource(s);
  const domain = extractDomain(discoverySource);
  // ... rest of aggregation logic
});
```

**Update Referrer signup attribution (~line 765-787):**
Apply same discovery source priority.

**Update Referrer connections attribution (~line 753-761):**
Apply same discovery source priority.

**Update Channel aggregation for visitor counting (~line 672-681):**
```text
const channel = categorizeChannel(
  getDiscoverySource(s),  // Use discovery source instead of just referrer
  s.utm_source, 
  s.utm_medium
);
```

**Add `original_external_referrer` to session query (~line 219):**
Currently the query doesn't fetch this field for all sessions.

### 2. `src/hooks/useUserDetail.ts`

**Update `categorizeChannel` function (~line 98-112):**
```text
function categorizeChannel(
  discoverySource: string | null,  // Already has priority applied
  utmSource: string | null, 
  utmMedium: string | null
): string {
  // Use discoverySource as primary, fall back to utmSource
  const source = (discoverySource || utmSource || '').toLowerCase();
  // ... rest of categorization logic
}
```

---

## Expected Results

### Before Fix (Current)

| Referrer | Visitors |
|----------|----------|
| Direct Traffic | 71 |
| sourcecodeals.com | 56 |
| Brevo (Email) | 27 |
| Google | 2 |

ChatGPT doesn't appear even though `utm_source=chatgpt.com` exists in the data.

### After Fix

| Referrer | Visitors |
|----------|----------|
| Direct Traffic | 71 |
| sourcecodeals.com | 55 |
| Brevo | 27 |
| Google | 6 |
| ChatGPT | 1 |

ChatGPT and other sources with `utm_source` attribution will now appear correctly.

---

## Technical Notes

1. **Backward Compatible**: Sessions without `utm_source` or `original_external_referrer` will fall back to `referrer` as before

2. **No Database Changes**: All required fields already exist in `user_sessions`

3. **Query Update Needed**: Add `original_external_referrer` to the main session select query

4. **Affects All Cards**: This fix will cascade to Channel, Referrer, Campaign aggregations consistently

---

## Summary

The core issue is that the referrer aggregation only looks at `s.referrer` (immediate HTTP referrer) instead of the TRUE discovery source which may be stored in `utm_source` or `original_external_referrer`. 

The fix is to implement a consistent `getDiscoverySource()` helper that applies priority-based source resolution across all attribution logic.

