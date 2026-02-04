

## Fix: Add Missing `apikey` Header & Deploy Queue Processor

### Problem
The `process-buyer-enrichment-queue` function is calling `enrich-buyer` but receiving **401 Unauthorized** errors. The Supabase gateway requires an `apikey` header for project identification.

### Change Required

**File:** `supabase/functions/process-buyer-enrichment-queue/index.ts`  
**Lines:** 141-144

**From:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${supabaseServiceKey}`,
},
```

**To:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${supabaseServiceKey}`,
  'apikey': supabaseServiceKey,
},
```

### After Approval
1. Add the `apikey` header to the fetch call
2. Deploy `process-buyer-enrichment-queue` function
3. Enrichment should resume without 401 errors

