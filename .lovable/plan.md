
# Fix: `generate-listing-content` Auth Call

## Root Cause

Line 181 of `generate-listing-content/index.ts` calls:
```typescript
const adminResult = await requireAdmin(authHeader, supabaseAdmin);
```

But `requireAdmin` expects `(req: Request, supabaseAdmin)`. It then calls `req.headers.get('Authorization')` on a string, causing `Cannot read properties of undefined (reading 'get')`.

## Fix

**File: `supabase/functions/generate-listing-content/index.ts`**

Line 181: Change `requireAdmin(authHeader, supabaseAdmin)` to `requireAdmin(req, supabaseAdmin)`. Remove the unused `authHeader` variable on line 180.

One-line fix, then redeploy the function.
