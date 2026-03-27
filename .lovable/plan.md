
Fix the bulk scoring flow by treating this as a client-side auth/session deadlock first, not an edge-function bug.

## What I found

- The button click is definitely firing:
  - console shows: `[AdminUsers] Starting bulk score for 130 unscored users`
  - session replay shows the button changing to `Scoring…`
- But there is no actual request reaching Supabase:
  - network snapshot shows no `calculate-buyer-quality-score` request
  - edge-function logs show no executions at all
  - edge gateway analytics also show nothing
- The function itself is configured in `supabase/config.toml` with:
  - `[functions.calculate-buyer-quality-score]`
  - `verify_jwt = false`
- There are currently 134 unscored buyer profiles in the database, so this is a real backlog.

## Root cause

The hang is most likely happening before `fetch()` is ever called, inside this line in `src/lib/invoke-with-timeout.ts`:

```ts
const { data: { session } } = await supabase.auth.getSession();
```

This code has no timeout around `getSession()`. In this project there are already comments/workarounds elsewhere about avoiding Supabase auth deadlocks. That matches the symptom perfectly:

```text
Click button
→ setIsBulkScoring(true)
→ toast + console log
→ invokeEdgeFunction()
→ invokeWithTimeout()
→ await supabase.auth.getSession() hangs
→ no fetch request
→ no edge logs
→ UI stays "Scoring…"
```

So the main issue is not “the scorer logic is broken”; it is “the request builder can stall forever before the network call starts.”

## Implementation plan

### 1. Harden edge invocation auth retrieval
Update `src/lib/invoke-with-timeout.ts` so session/token retrieval cannot hang forever.

Changes:
- wrap `supabase.auth.getSession()` in a short timeout helper
- if it times out, surface a clear error immediately
- prefer a token path that does not silently hang the whole request flow
- add minimal debug logs around:
  - session lookup start
  - session lookup success/failure
  - fetch start

Goal: if auth/session is the blocker, the UI should fail fast with a real error instead of appearing stuck.

### 2. Make the bulk button fail fast and show useful feedback
Update `src/pages/admin/AdminUsers.tsx`.

Changes:
- show immediate “Starting…” toast as now
- add a per-round timeout message if round 1 never begins
- reduce retry behavior for this admin action:
  - either set `maxRetries: 0` for this specific action
  - or use shorter timeout/retry values just for bulk scoring
- surface a descriptive toast if token/session lookup fails

Goal: no more endless `Scoring…` state with no explanation.

### 3. Add stronger instrumentation for this exact flow
Add temporary targeted logs in:
- `src/lib/invoke-with-timeout.ts`
- possibly `src/pages/admin/AdminUsers.tsx`

Specifically log:
- entering bulk round
- before session lookup
- after session lookup
- before fetch
- after fetch/error

This will let the next run prove whether the freeze is at auth lookup or network.

### 4. Verify edge function assumptions while we’re in there
Even though the current blocker is earlier, I would also harden `supabase/functions/calculate-buyer-quality-score/index.ts` so the next failure mode is explicit, not silent.

Changes:
- validate presence of:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
- return structured 500s if missing
- add one startup/request log showing:
  - function entered
  - batch mode requested
  - caller auth mode (admin/self/internal), without logging secrets

Goal: once requests start reaching the function, any backend misconfiguration is immediately visible.

### 5. Re-test the actual admin flow
After the above, the expected sequence should be:

```text
Click "Score All Unscored"
→ Starting toast
→ Round 1 starts
→ request reaches edge function
→ edge logs appear
→ progress toast(s) / completion toast
→ users refetch with score + tier populated
```

## Files to update

- `src/lib/invoke-with-timeout.ts`
- `src/pages/admin/AdminUsers.tsx`
- `supabase/functions/calculate-buyer-quality-score/index.ts`

## Expected outcome

This should fix the real blocker:
- requests will actually leave the browser
- the button won’t sit forever in `Scoring…`
- we’ll either get working scoring or a precise error message
- once it runs, it should populate both:
  - `buyer_quality_score`
  - `buyer_tier`

## Technical note

I do not think the primary issue is deployment or `verify_jwt` anymore, because if that were the problem we would still see a network request and likely edge/gateway traces. We currently see neither. That strongly points to a client-side stall before `fetch()`, with `supabase.auth.getSession()` being the most likely culprit.
