

# Fix: M&A Guide Generation 401 Authentication Error

## Problem
The M&A guide generation fails immediately with:
```
401 - {"code":401,"message":"Missing authorization header"}
```

When `process-ma-guide-queue` calls `generate-ma-guide`, it only sends the `apikey` header but **not** the `Authorization` header. Supabase's Edge Function gateway requires **both headers** for server-to-server calls.

## Root Cause

```text
┌─────────────────────────────┐
│  process-ma-guide-queue     │
│                             │
│  fetch('generate-ma-guide') │
│  headers: {                 │
│    apikey: ✓                │
│    Authorization: ✗ MISSING │
│  }                          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Supabase Gateway           │
│                             │
│  → 401 Missing auth header  │
└─────────────────────────────┘
```

## Solution

Add the `Authorization` header with the service role key to all server-to-server Edge Function calls.

### Files to Modify

**1. `supabase/functions/process-ma-guide-queue/index.ts`**

Change lines 86-91 from:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/generate-ma-guide`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
  },
  ...
```

To:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/generate-ma-guide`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
  },
  ...
```

**2. `supabase/functions/generate-ma-guide-background/index.ts`**

Change lines 91-96 from:
```typescript
fetch(`${supabaseUrl}/functions/v1/process-ma-guide-queue`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
  },
  ...
```

To:
```typescript
fetch(`${supabaseUrl}/functions/v1/process-ma-guide-queue`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
  },
  ...
```

### Deployment

After making the changes, deploy both functions:
```bash
supabase functions deploy process-ma-guide-queue generate-ma-guide-background
```

## Technical Notes

- The `apikey` header is used for project routing
- The `Authorization: Bearer <key>` header is used for authentication
- Even with `verify_jwt = false`, Supabase gateway still validates the presence of the Authorization header for edge function calls
- Using the service role key allows bypassing RLS, which is appropriate for background processing

