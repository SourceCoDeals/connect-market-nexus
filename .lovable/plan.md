

# Fix: `receive-valuation-lead` — Buyer Lane Field Mapping Bug

## Status

The edge function **is deployed and working**. I just successfully tested it — the submission was received, stored in both `incoming_leads` and `valuation_leads`, and all fields populated correctly **except one**:

- **`buyer_lane` is always `null`** — The code reads `buyerLane?.lane` but the payload sends `buyerLane.title`. This is a one-line fix.

## What's Actually Wrong with Your External App

The function has **no recent logs from your app**, meaning your external calculator app is either:
1. Sending to a different URL
2. Getting a network error before reaching Supabase
3. Not actually firing the POST

The correct endpoint is:
```
POST https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/receive-valuation-lead
```

**You should check your external app's network tab / console to see what URL it's hitting and what response it gets.**

## Code Fix

In `supabase/functions/receive-valuation-lead/index.ts`, line 168:

```typescript
// BEFORE (bug):
buyer_lane: buyerLane?.lane ?? null,

// AFTER (fix):
buyer_lane: buyerLane?.title ?? null,
```

Also add a more prominent log of the full incoming body for easier debugging:

```typescript
console.log("[receive-valuation-lead] Full body:", JSON.stringify(body));
```

## Cleanup

Delete the two test rows I just created:
- `plan-check-test@example.com` from `incoming_leads` and `valuation_leads`

## Everything Else is Correct

- `config.toml`: `verify_jwt = false` ✓
- `incoming_leads` table: all columns present ✓
- CORS: `Access-Control-Allow-Origin: *` ✓
- Upsert on email: ✓
- Service role key used: ✓
- Error handling with 400/500: ✓

