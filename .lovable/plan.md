
# Plan: M&A Research Guide Timeout Improvements

## Problem Analysis

The M&A Research Guide generation is experiencing timeouts and abrupt stops. Based on code analysis, the root causes are:

### Root Causes Identified

1. **Supabase Edge Function Hard Timeout (~150s)**: The platform has a maximum execution time. If the function runs too long, the connection is terminated without a graceful error message.

2. **Anthropic API Rate Limits (429)**: Claude API calls can hit rate limits, especially with parallel phase execution (2 phases per batch).

3. **Phase Timeouts (50s)**: Individual phases can timeout if Claude responses are slow.

4. **Silent Error State**: When errors occur, the UI transitions to an "error" state but provides minimal diagnostic information about what went wrong or how to fix it.

5. **Lack of Error Details Panel**: Users see a generic toast message but cannot see specific failure reasons, retry options, or troubleshooting steps.

---

## Solution Overview

### Part 1: Enhanced User-Facing Error Messaging

Add a dedicated error state panel in the UI that shows:
- What phase/batch failed
- The specific error reason (rate limit, timeout, credits, network)
- Suggested actions to resolve the issue
- One-click retry options

### Part 2: Better Timeout Detection and Communication

Improve the edge function to:
- Detect approaching timeouts and gracefully conclude with a resumable state
- Send periodic "time remaining" heartbeats so the client knows if a timeout is imminent
- Return structured error codes for different failure modes

### Part 3: Progress Persistence Improvements

Enhance the resume functionality to:
- Save progress more granularly (after each phase, not just each batch)
- Display clearer resume prompts with context about what was completed
- Auto-retry transient failures with better backoff strategy

---

## Implementation Details

### File Changes

**1. `src/components/remarketing/AIResearchSection.tsx`**

Add a new error details panel that displays when `state === 'error'`:

```text
Changes:
- Add errorDetails state object to track: errorCode, errorMessage, batch, phase, timestamp, isRecoverable
- Create ErrorDetailsPanel component showing:
  • Error icon with severity color (red for critical, amber for retryable)
  • Clear heading: "Generation Failed" or "Rate Limit Reached"
  • Specific message explaining what happened
  • Action buttons: "Retry", "Resume from Last Checkpoint", "Contact Support"
  • Collapsible technical details for debugging
- Modify SSE event handlers to capture detailed error info
- Add retry countdown timer for rate limit errors
```

**2. `supabase/functions/generate-ma-guide/index.ts`**

Add timeout awareness and enhanced error reporting:

```text
Changes:
- Add FUNCTION_TIMEOUT_MS constant (~140s - below platform limit)
- Track function start time and calculate remaining time
- Send 'timeout_warning' SSE event when <30s remaining
- On approaching timeout: gracefully complete current phase, save progress, return structured 'timeout' error
- Add more specific error codes: 'phase_timeout', 'function_timeout', 'api_rate_limit', 'api_overload'
- Include batch/phase context in all error events
```

**3. New: `src/components/remarketing/GuideGenerationErrorPanel.tsx`**

Create a dedicated error display component:

```text
Contents:
- ErrorPanel component with:
  • Error type icons (AlertTriangle for timeout, Clock for rate limit, XCircle for critical)
  • Error-specific messaging and suggested actions
  • Retry button with countdown for rate-limited errors
  • Resume button when checkpoint is available
  • "What happened" expandable section with technical details
  • Link to troubleshooting docs
```

### Error Type Mappings

| Error Code | User Message | Action |
|------------|--------------|--------|
| `rate_limited` | "Rate limit reached. The AI service is processing too many requests." | Show countdown timer, auto-retry after delay |
| `phase_timeout` | "Phase took too long to generate. This sometimes happens with complex industries." | Offer retry with faster model |
| `function_timeout` | "Generation timed out. Progress has been saved." | Prominent resume button |
| `payment_required` | "AI credits depleted. Add credits to continue." | Link to billing settings |
| `service_overloaded` | "AI service is temporarily overloaded." | Retry button with 30s delay |
| `network_error` | "Connection lost during generation." | Check connection, retry |

### UI Mockup (Error State)

```text
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Generation Interrupted                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Rate limit reached during Batch 3, Phase 6            │
│                                                         │
│  The AI service received too many requests. This is    │
│  temporary and your progress has been saved.           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Progress saved: 12,450 words (Batches 1-2 done) │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [ Resume in 28s ]  [ Retry Now ]  [ Cancel ]          │
│                                                         │
│  ▼ Technical Details                                    │
│    Error code: rate_limited                             │
│    Batch: 3 of 7                                        │
│    Phase: 6 (Financial Attractiveness)                  │
│    Timestamp: 2026-02-04 06:19:00                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Details

### Edge Function Timeout Handling

The Supabase edge function will be updated to track elapsed time:

```javascript
// At function start
const FUNCTION_START = Date.now();
const FUNCTION_TIMEOUT_MS = 140000; // 140s (below 150s hard limit)

// Before each phase
const elapsed = Date.now() - FUNCTION_START;
const remaining = FUNCTION_TIMEOUT_MS - elapsed;

if (remaining < 35000) {
  // Not enough time for another phase (~30s needed)
  send({
    type: 'timeout_warning',
    message: 'Approaching time limit, completing current batch...',
    remaining_ms: remaining
  });
  
  // Return partial success with resumption point
  send({
    type: 'batch_complete',
    content: fullContent,
    is_final: false,
    next_batch_index: batch_index + 1,
    timeout_approaching: true
  });
  break; // Exit phase loop gracefully
}
```

### Frontend Error State Enhancement

```typescript
interface ErrorDetails {
  code: string;
  message: string;
  batchIndex: number;
  phaseIndex: number;
  phaseName: string;
  isRecoverable: boolean;
  retryAfterMs?: number;
  savedWordCount?: number;
  timestamp: number;
}

// In catch block
if ((error as any).isRateLimited) {
  setErrorDetails({
    code: 'rate_limited',
    message: 'Rate limit reached. The AI service needs a brief cooldown.',
    batchIndex: currentBatch,
    phaseIndex: currentPhase,
    phaseName,
    isRecoverable: true,
    retryAfterMs: 30000,
    savedWordCount: wordCount,
    timestamp: Date.now()
  });
}
```

---

## Summary of Changes

| File | Change Type | Purpose |
|------|-------------|---------|
| `AIResearchSection.tsx` | Modify | Add error details state, error panel rendering |
| `GuideGenerationErrorPanel.tsx` | New | Dedicated error display component |
| `generate-ma-guide/index.ts` | Modify | Add timeout awareness, enhanced error events |

This solution provides clear user feedback about what went wrong, whether it can be fixed, and exactly what action to take - eliminating the confusion of silent failures.
