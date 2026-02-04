
# Plan: M&A Research Guide Timeout Improvements

**Status: ✅ IMPLEMENTED**

## Problem Analysis

The M&A Research Guide generation was experiencing timeouts and abrupt stops. Based on code analysis, the root causes were:

### Root Causes Identified

1. **Supabase Edge Function Hard Timeout (~150s)**: The platform has a maximum execution time. If the function runs too long, the connection is terminated without a graceful error message.

2. **Anthropic API Rate Limits (429)**: Claude API calls can hit rate limits, especially with parallel phase execution (2 phases per batch).

3. **Phase Timeouts (50s)**: Individual phases can timeout if Claude responses are slow.

4. **Silent Error State**: When errors occur, the UI transitions to an "error" state but provides minimal diagnostic information about what went wrong or how to fix it.

5. **Lack of Error Details Panel**: Users see a generic toast message but cannot see specific failure reasons, retry options, or troubleshooting steps.

---

## Solution Implemented

### Part 1: Enhanced User-Facing Error Messaging ✅

Added a dedicated error state panel (`GuideGenerationErrorPanel.tsx`) that shows:
- What phase/batch failed
- The specific error reason (rate limit, timeout, credits, network)
- Suggested actions to resolve the issue
- One-click retry/resume options
- Collapsible technical details

### Part 2: Better Timeout Detection and Communication ✅

Improved the edge function to:
- Track elapsed time with `FUNCTION_START` timestamp
- Check remaining time before each phase (`hasTimeForPhase()`)
- Send `timeout_warning` SSE event when approaching limit
- Gracefully exit with `timeout_approaching: true` in batch_complete
- Include `remaining_time_ms` in phase events for client awareness

### Part 3: Progress Persistence Improvements ✅

Enhanced error handling to:
- Save word count and batch index in error details
- Display resume buttons with context about saved progress
- Auto-retry with configurable backoff (30s for rate limits)

---

## Files Changed

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/components/remarketing/GuideGenerationErrorPanel.tsx` | **New** | Dedicated error display component with retry/resume |
| `src/components/remarketing/AIResearchSection.tsx` | Modified | Added error details state, error panel rendering, handlers |
| `supabase/functions/generate-ma-guide/index.ts` | Modified | Added timeout tracking, enhanced error events |

---

## Error Type Mappings

| Error Code | User Message | Action |
|------------|--------------|--------|
| `rate_limited` | "Rate limit reached. The AI service received too many requests." | Countdown timer, auto-retry after delay |
| `phase_timeout` | "Phase took too long to generate." | Retry button |
| `function_timeout` | "Generation timed out. Progress has been saved." | Resume button |
| `payment_required` | "AI credits depleted." | Link to billing settings |
| `service_overloaded` | "AI service is temporarily overloaded." | Retry with delay |
| `network_error` | "Connection lost during generation." | Check connection, retry |

---

## Technical Implementation

### Edge Function Timeout Constants
```javascript
const FUNCTION_TIMEOUT_MS = 140000; // 140s (below 150s hard limit)
const MIN_TIME_FOR_PHASE_MS = 35000; // Need 35s to safely complete a phase
```

### Timeout Check Logic
```javascript
const getRemainingTime = () => FUNCTION_TIMEOUT_MS - (Date.now() - FUNCTION_START);
const hasTimeForPhase = () => getRemainingTime() > MIN_TIME_FOR_PHASE_MS;

if (!hasTimeForPhase()) {
  send({ type: 'timeout_warning', remaining_ms: getRemainingTime() });
  send({ type: 'batch_complete', timeout_approaching: true, ... });
  return;
}
```

### Enhanced Error Event
```javascript
send({
  type: 'error',
  message: err.message,
  error_code: errorCode,
  recoverable,
  batch_index,
  saved_word_count: fullContent.split(/\s+/).length,
  retry_after_ms: errorCode === 'rate_limited' ? 30000 : undefined
});
```
