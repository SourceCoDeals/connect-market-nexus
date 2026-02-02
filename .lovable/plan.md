
# Fix Channel Attribution for Signups

## Problem Identified

The Channel tab shows incorrect data because:

1. **Current logic** uses `original_external_referrer` (which is NULL for all sessions) → falls back to `referrer` (which is `sourcecodeals.com`) → categorized as "Referral"
2. **But** the `profiles.referral_source` contains the actual user-reported discovery source (google, linkedin, friend, ai, etc.)

**Current incorrect data:**
| Channel | Signups |
|---------|---------|
| Referral | 21 |
| Direct | 7 |
| Internal | 1 |

**What it should show (based on user-reported data):**
| Channel | Signups |
|---------|---------|
| Organic Search (Google) | 15 |
| Organic Social (LinkedIn/Instagram) | 7 |
| Referral (Friend/Other) | 10 |
| AI | 1 |

## Root Cause

In `src/hooks/useUnifiedAnalytics.ts` (lines 492-502), the signup channel attribution only checks:
```typescript
const effectiveReferrer = firstSession.original_external_referrer || firstSession.referrer;
const channel = categorizeChannel(effectiveReferrer, ...);
```

It **never** uses `profiles.referral_source`, which is where the actual discovery source is stored.

## Solution

### Step 1: Create a mapping function for self-reported sources to channels

Add a helper function to convert `profiles.referral_source` values to standard channel names:

```typescript
function selfReportedSourceToChannel(source: string | null): string | null {
  if (!source) return null;
  const s = source.toLowerCase().trim();
  
  // Map self-reported sources to standard channels
  if (s === 'google') return 'Organic Search';
  if (s === 'linkedin' || s === 'instagram' || s === 'twitter' || s === 'facebook') return 'Organic Social';
  if (s === 'ai' || s === 'chatgpt' || s === 'perplexity') return 'AI';
  if (s === 'friend') return 'Referral';  // Word of mouth is a referral
  if (s === 'other') return null;  // Fall back to session data for "other"
  
  return null;  // Unknown - fall back to session data
}
```

### Step 2: Update signup channel attribution logic

Modify the signup attribution (lines 492-502) to use this priority:

1. Check `original_external_referrer` (for future cross-domain tracking)
2. If NULL, use `profiles.referral_source` (user-reported)
3. If still NULL or "other", fall back to session referrer

```typescript
profiles.forEach(p => {
  const firstSession = profileToFirstSession.get(p.id);
  
  // Priority 1: Cross-domain tracking (if we have it)
  if (firstSession?.original_external_referrer) {
    const channel = categorizeChannel(firstSession.original_external_referrer, firstSession.utm_source, firstSession.utm_medium);
    channelSignups[channel] = (channelSignups[channel] || 0) + 1;
    return;
  }
  
  // Priority 2: User-reported discovery source (this is real data!)
  const selfReportedChannel = selfReportedSourceToChannel(p.referral_source);
  if (selfReportedChannel) {
    channelSignups[selfReportedChannel] = (channelSignups[selfReportedChannel] || 0) + 1;
    return;
  }
  
  // Priority 3: Fall back to session referrer
  if (firstSession) {
    const channel = categorizeChannel(firstSession.referrer, firstSession.utm_source, firstSession.utm_medium);
    channelSignups[channel] = (channelSignups[channel] || 0) + 1;
  }
});
```

## Why This Is NOT Fake Data

The `profiles.referral_source` field is:
- Collected from users during signup when you ask "How did you hear about us?"
- Real answers like "Google", "LinkedIn", "Friend", "AI"
- Includes specific keywords like "M&A deal sourcing" in `referral_source_detail`

This is the most accurate data we have for "original discovery source" because:
- Technical tracking shows `sourcecodeals.com` (the blog) as the immediate referrer
- But users tell you they found the blog via Google search
- Until cross-domain tracking is implemented, this is the only source of original discovery data

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Add `selfReportedSourceToChannel()` function; update signup channel attribution to use it |

## Expected Results After Fix

| Channel | Before | After |
|---------|--------|-------|
| Organic Search | 0 | 15 |
| Organic Social | 0 | 7 |
| Referral | 21 | 10 |
| AI | 0 | 1 |
| Direct | 7 | 0 (absorbed into above) |
| Internal | 1 | 1 |

## Technical Notes

1. **Visitors and Connections** will continue to use session-based attribution (immediate referrer)
2. **Signups** will use user-reported discovery source (more accurate for this metric)
3. When cross-domain tracking is implemented (via the blog JavaScript), `original_external_referrer` will take priority
4. The "other" responses (6 signups) will fall back to session referrer attribution

This approach gives you accurate data NOW while remaining compatible with the future cross-domain tracking solution.
