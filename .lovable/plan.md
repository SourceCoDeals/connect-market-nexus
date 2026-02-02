
# Intelligence Center Data Accuracy Issues & Complete Fix Plan

## Summary of Issues Found

I've investigated the entire Intelligence Center data pipeline and found **6 critical issues** causing incorrect data display:

---

## Issue 1: Historical `unique_visitors` is 0 (Chart Shows No Data Before Jan 26)

**What you see:** Chart shows 0 visitors for all dates before Jan 26, 2026

**Root Cause:** The `daily_metrics` table has `unique_visitors = 0` for all dates before Jan 26:

| Date | unique_visitors | total_sessions |
|------|-----------------|----------------|
| Jan 15 | **0** | 522 |
| Jan 20 | **0** | 58 |
| Jan 25 | **0** | 44 |
| Jan 26 | 36 | 107 |

**Why:** The backfill function ran for the first time on Jan 26, so older records were never populated with the new `unique_visitors` column. The original backfill had the old logic.

**Fix:** Re-run the updated backfill function for all historical dates with the corrected visitor counting logic.

---

## Issue 2: Newsletter/Email Traffic Miscategorized as "Referral"

**What you see:** 12 Newsletter visits, 52 Referral

**Reality:** You sent emails via Brevo (exdov.r.sp1-brevo.net, sendibt3.com). These should be "Newsletter", not "Referral"

**Database shows:**
- `https://exdov.r.sp1-brevo.net/` → 44 sessions → Currently categorized as "Referral"
- `https://exdov.r.bh.d.sendibt3.com/` → 77 sessions → Currently categorized as "Referral"
- Only 18 sessions have proper UTM tags (`utm_medium=email`)

**Root Cause in code (`categorizeChannel` function lines 84-118):**
```typescript
// Newsletter detection ONLY looks for utm_medium
if (medium.includes('email') || medium.includes('newsletter')) return 'Newsletter';

// But Brevo email URLs don't have UTM tags in the referrer!
// So they fall through to "Referral"
```

**Fix:** Add Brevo domain detection to `categorizeChannel`:
```typescript
// Add email platform detection
if (source.includes('brevo') || source.includes('sendibt') || source.includes('mailchimp') || source.includes('sendgrid')) return 'Newsletter';
```

---

## Issue 3: "38 Visitors from France" is Actually 8 Real People

**What you see:** France: 38 visitors

**Reality:**
| Metric | Value |
|--------|-------|
| Sessions from France | 38 |
| Sessions with visitor_id | 8 |
| Sessions with NO tracking (anonymous) | 30 |
| **TRUE unique visitors** | **8** |

**Root Cause:** 30 sessions from France have `visitor_id = NULL` and `user_id = NULL`. The `getVisitorKey()` function falls back to `session_id`, counting each anonymous session as a separate "visitor":

```typescript
function getVisitorKey(session) {
  return session.user_id || session.visitor_id || session.session_id; // ← session_id is NOT a visitor!
}
```

**Why are visitor_ids NULL?**
The 104.28.x.x IPs are **Cloudflare IPs** (proxy). These visitors may be:
- Using privacy browsers that block localStorage (where visitor_id is stored)
- Bots/crawlers that don't execute JavaScript
- Users with aggressive ad blockers

**Fix:** The code is correct, but the data has gaps. We need to:
1. **For display:** Don't count sessions with NULL visitor_id as unique visitors
2. **For tracking:** Already fixed in `track-session` - now stores visitor_id from frontend

---

## Issue 4: "Direct" Traffic is Overcounted (70% = 151 visitors)

**What you see:** Direct: 70% (151 visitors)

**Reality:** Many of those "Direct" visits are actually:
- Email clicks that lost UTM parameters
- Internal navigation from marketplace.sourcecodeals.com
- Broken referrer tracking

**Database shows:**
| Channel | Sessions | True Description |
|---------|----------|------------------|
| NULL referrer | 240 | Marked as "Direct" |
| exdov.r.sp1-brevo.net | 44 | Should be "Newsletter" |
| www.sourcecodeals.com | 31 | Should be "Referral (Main Site)" |
| marketplace.sourcecodeals.com | 19 | Internal navigation (should exclude?) |

**Fix:** 
1. Detect Brevo/email domains as "Newsletter"
2. Detect internal marketplace referrers as "Internal" (or exclude)
3. Consider excluding internal navigation from source breakdown

---

## Issue 5: Country Data is Inflated by Anonymous Sessions

**What you see:**
- France: 38
- Netherlands: 29
- UK: 16
- US: 8

**Reality (TRUE unique visitors by country):**
| Country | Sessions Shown | Actual Unique Visitors |
|---------|----------------|----------------------|
| France | 38 | **8** |
| Netherlands | 29 | **3** |
| UK | 16 | **3** |
| Spain | 7 | **0** (all anonymous) |
| US | 8 | **0** (all anonymous) |

**Root Cause:** Same as Issue #3 - each anonymous session is counted as a visitor.

---

## Issue 6: Backfill Never Completed (Times Out)

The `backfill-daily-metrics` function times out before processing all historical dates (196 days since July 2025).

**Fix:** Modify the function to process in smaller batches with pagination, or I'll run it myself in chunks.

---

## Implementation Plan

### Phase 1: Fix Channel Categorization (Immediate)

**File:** `src/hooks/useUnifiedAnalytics.ts`

Update `categorizeChannel` function:
```typescript
function categorizeChannel(referrer, utmSource, utmMedium): string {
  const source = (referrer || utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();
  
  // Newsletter/Email - check domains first!
  if (source.includes('brevo') || source.includes('sendibt') || 
      source.includes('mailchimp') || source.includes('sendgrid') ||
      source.includes('hubspot') || source.includes('klaviyo')) return 'Newsletter';
  if (medium.includes('email') || medium.includes('newsletter')) return 'Newsletter';
  
  // Internal navigation (exclude from sources)
  if (source.includes('marketplace.sourcecodeals.com')) return 'Internal';
  
  // ... rest of function
}
```

### Phase 2: Fix Visitor Counting for Anonymous Sessions

**File:** `src/hooks/useUnifiedAnalytics.ts`

Update `getVisitorKey` to handle anonymous sessions better:
```typescript
// Option A: Exclude anonymous sessions from "unique visitors" count
// These should only count toward "sessions", not "visitors"
function getVisitorKey(session): string | null {
  if (session.user_id) return session.user_id;
  if (session.visitor_id) return session.visitor_id;
  return null; // Don't count anonymous sessions as visitors
}

// Then filter out nulls when counting unique visitors
const uniqueVisitorKeys = new Set(
  uniqueSessions.map(s => getVisitorKey(s)).filter(Boolean)
);
const currentVisitors = uniqueVisitorKeys.size;
```

### Phase 3: Re-run Historical Backfill

**Update backfill function** to use corrected visitor counting:
1. Only count sessions with `user_id` OR `visitor_id` as unique visitors
2. Filter out dev traffic
3. Use proper email domain detection

**Run backfill in batches:**
- July-September 2025
- October-December 2025
- January 2026

### Phase 4: Update daily_metrics for All Dates

After code fixes, re-run:
```bash
curl -X POST ".../backfill-daily-metrics" \
  -d '{"startDate": "2025-07-21", "endDate": "2026-02-02", "delayMs": 100}'
```

---

## Expected Results After Fix

| Metric | Current (Wrong) | After Fix (Correct) |
|--------|-----------------|---------------------|
| France visitors | 38 | 8 |
| Netherlands visitors | 29 | 3 |
| Newsletter channel | 12 (6%) | ~150+ (recognizes Brevo) |
| Direct channel | 151 (70%) | ~46 (only true direct) |
| Historical chart | Empty before Jan 26 | Full data since July 2025 |
| Total unique visitors | 182 | ~78 (excluding anonymous) |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUnifiedAnalytics.ts` | Fix `categorizeChannel`, fix `getVisitorKey`, add internal navigation filter |
| `supabase/functions/backfill-daily-metrics/index.ts` | Add email domain detection, fix visitor counting |
| `supabase/functions/aggregate-daily-metrics/index.ts` | Same fixes for ongoing aggregation |

---

## Technical Notes

### Why visitor_id is NULL for some sessions

The 104.28.x.x IP range is **Cloudflare's proxy network**. These visitors:
1. May have JavaScript disabled (visitor_id is set via JS)
2. May be using privacy browsers that block localStorage
3. May be bots that don't execute client-side code
4. May have hit the site before visitor_id tracking was implemented

### True Data Quality Assessment

| Tracking Quality | Sessions | % |
|------------------|----------|---|
| Has user_id (logged in) | 78 | 22% |
| Has visitor_id (anonymous tracked) | ~170 | 48% |
| No tracking (anonymous sessions) | 97 | 27% |
| **Total production sessions (Jan 26+)** | 351 | 100% |

Going forward, 70-75% of visitors can be uniquely identified. The 27% anonymous gap is due to privacy settings and bots - this is normal for any analytics platform.
