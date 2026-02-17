

# Fix: Listing Creation Failure + Build Error

## Problem Summary

Two issues are blocking the admin listing creation flow:

1. **Database: LPAD truncation bug** -- The `generate_deal_identifier()` function uses `LPAD(sequence, 3, '0')`. The sequence is currently at **8000**, which gets truncated to `'800'` -- colliding with identifiers that already exist from when the sequence was at 800. Every new insert fails with a unique constraint violation.

2. **Build error: TypeScript signal incompatibility** -- `score-buyer-deal/index.ts` passes a plain `RequestInit` to `fetchWithAutoRetry()` which expects `RequestInit & { signal?: AbortSignal }`. The `null` possibility on `signal` in standard `RequestInit` doesn't match the stricter signature.

## Fix 1: Database Migration

A single SQL migration will:

- **Replace the function** with `LPAD(..., 5, '0')` -- supports up to 99,999 identifiers per year
- **Add a retry loop** -- if a generated identifier collides, increment and try again (up to 10 attempts)
- **Advance the sequence** to `7726` (current max suffix 7625 + 100 safety margin), resetting it below the danger zone since the wider LPAD now handles large numbers correctly

```text
Current: 'SCO-' || year || '-' || LPAD(seq, 3, '0')
  seq 8005 --> 'SCO-2026-800' (TRUNCATED! collision!)

Fixed:   'SCO-' || year || '-' || LPAD(seq, 5, '0')  
  seq 8005 --> 'SCO-2026-08005' (correct, unique)
```

## Fix 2: Build Error in score-buyer-deal

Change the local `fetchWithRetry` wrapper to cast the options parameter so the `signal` type aligns:

```typescript
// Line 229: cast to match the shared function's stricter type
return fetchWithAutoRetry(url, options as RequestInit & { signal?: AbortSignal }, {
```

## Fix 3: Chunk Error Recovery (secondary)

Add a global error handler in the Vite/React lazy-loading layer to catch `Failed to fetch dynamically imported module` errors and force a page reload. This prevents stale build artifacts from surfacing as "Critical Error" toasts.

## Bulletproofing

- 5-digit LPAD supports 99,999 identifiers per year before any risk
- Retry loop in the DB function auto-recovers from any future collision
- Sequence reset clears the current collision zone
- Chunk error handler prevents stale-deploy errors from blocking the UI

## Changes Summary

| File | Change |
|------|--------|
| SQL Migration | Replace `generate_deal_identifier()`, reset sequence |
| `supabase/functions/score-buyer-deal/index.ts` | Type cast on line 229 |
| `src/App.tsx` or router config | Add dynamic import error recovery handler |

