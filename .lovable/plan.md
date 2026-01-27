
# M&A Guide Generation Fix Plan

## Problem Summary
The M&A Guide generation shows "1 words generated" and silently fails because **the Lovable AI Gateway is returning a 402 Payment Required error (out of credits)**. The error isn't being surfaced to users properly.

## Immediate Action Required
**Add credits to the Lovable workspace** - Go to Settings → Workspace → Usage and top up your AI credits. The system is working correctly; it just needs credits to call the AI models.

---

## Technical Fixes (To Prevent Future Confusion)

### Fix 1: Enhanced Error Messaging in Edge Function
**File:** `supabase/functions/generate-ma-guide/index.ts`

Update the SSE error event to include error codes:
- Add `error_code` field to error events ("payment_required", "rate_limited", "timeout", "unknown")
- Include user-friendly messages for each error type
- Log the full error context for debugging

### Fix 2: Frontend Error Classification
**File:** `src/components/remarketing/AIResearchSection.tsx`

Update the error handling in `generateBatch()` to:
- Parse SSE error events for `error_code`
- Show specific toast messages:
  - 402: "AI credits depleted. Please add credits in Settings → Workspace → Usage to continue."
  - 429: "Rate limit reached. Please wait a moment and try again."
  - Timeout: "Generation timed out. Click 'Resume' to continue from where you left off."
- Add a "Add Credits" button link when 402 is detected
- Stop retrying on billing errors (402) since retries won't help

### Fix 3: HTTP-Level 402/429 Handling
**File:** `src/components/remarketing/AIResearchSection.tsx`

For cases where the edge function itself returns 402/429 (before SSE starts):
- Check `response.status` for 402/429 before starting stream parsing
- Show appropriate credit/rate-limit messaging
- Preserve user progress for resume after adding credits

### Fix 4: Clarification Flow Error Handling
**File:** `src/components/remarketing/AIResearchSection.tsx`

Update `handleStartClarification()` to:
- Parse the error response JSON for specific error types
- Show credit messaging instead of falling back to direct generation
- Prevent wasted attempts when credits are exhausted

---

## Technical Details

### Error Event Structure (Edge Function)
```typescript
send({ 
  type: 'error', 
  message: 'AI credits depleted. Please add credits to continue.',
  error_code: 'payment_required',  // NEW
  recoverable: false,              // NEW
  phase: currentPhaseId            // NEW - for resume
});
```

### Frontend Error Handler
```typescript
case 'error':
  if (event.error_code === 'payment_required') {
    toast.error('AI credits depleted. Add credits in Settings → Usage.', {
      action: { label: 'Add Credits', onClick: () => window.open('/settings/usage', '_blank') }
    });
    setState('error');
    return; // Don't retry
  }
  if (event.error_code === 'rate_limited') {
    toast.warning('Rate limit reached. Retrying in 30 seconds...');
    await new Promise(r => setTimeout(r, 30000));
    // Retry current batch
  }
  throw new Error(event.message);
```

### Files to Modify
1. `supabase/functions/generate-ma-guide/index.ts` - Add error codes to SSE events
2. `src/components/remarketing/AIResearchSection.tsx` - Enhanced error handling and user messaging
3. Optional: `supabase/functions/clarify-industry/index.ts` - Already has 402 handling, just needs frontend to respect it

---

## Summary
The M&A Guide system is architecturally sound but has a **user experience gap** where billing errors appear as generation failures. The fix involves:
1. **Immediate:** Add Lovable AI credits to your workspace
2. **Code changes:** Add error classification and user-friendly messaging so future credit issues are immediately clear to users
