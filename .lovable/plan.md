

# Fix: "Score All Unscored" Button Stuck — Edge Function Not Responding

## Root Cause

The `calculate-buyer-quality-score` edge function has **zero logs** in Supabase, meaning it's either not deployed or crashing on boot. The button enters "Scoring..." state correctly but the `invokeEdgeFunction` call never gets a response. With 120s timeout per attempt and 2 retries, the button could stay stuck for up to 6 minutes before showing an error toast.

The function exists in the codebase (`supabase/functions/calculate-buyer-quality-score/index.ts`) but unlike other functions (score-deal-buyers, process-scoring-queue, etc.), it has **no `config.toml`** file. This shouldn't prevent deployment but could cause JWT verification issues.

## Fix

### 1. Redeploy the edge function

Add a `config.toml` to ensure consistent deployment configuration, matching the pattern used by other scoring functions:

**New file: `supabase/functions/calculate-buyer-quality-score/config.toml`**
```toml
verify_jwt = false
```

Setting `verify_jwt = false` is safe here because the function already does its own auth checks (admin check, self-score check, service-role check). This matches the pattern of `score-deal-buyers`, `process-scoring-queue`, etc. The missing config.toml with default `verify_jwt = true` may be causing JWT validation failures at the Supabase gateway level before the function code even runs.

### 2. Add better client-side feedback

Update the handler in `src/pages/admin/AdminUsers.tsx` to show immediate feedback when starting, and reduce the timeout to something more reasonable:

- Show a toast immediately: "Starting scoring of X users..."
- Reduce `timeoutMs` to 90s (still generous, but not 120s)
- Add a `console.log` before the fetch so we can diagnose future issues

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/calculate-buyer-quality-score/config.toml` | New — set `verify_jwt = false` |
| `src/pages/admin/AdminUsers.tsx` | Add immediate toast feedback when scoring starts |

