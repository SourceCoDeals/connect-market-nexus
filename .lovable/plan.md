

## Fix Plan: Transcript Extraction Auth Failure + Build Error

### Problem Summary

Two separate issues are preventing full enrichment:

1. **All 10 transcript extraction calls fail with `{"code":401,"message":"Invalid JWT"}`** -- The `enrich-deal` function calls `extract-deal-transcript` internally using the service role key as the Bearer token. The Supabase Edge Gateway is rejecting this, meaning the `verify_jwt = false` config is either not deployed or not being honored for this function.

2. **Build error** -- `parse-tracker-documents/index.ts` imports `npm:@anthropic-ai/sdk@0.30.1` which requires a Deno import map entry.

The 8 fields that did update (State, City, Street Address, Company Name, LinkedIn data) are all from website scraping, which works because it doesn't make internal function-to-function calls.

### Root Cause Analysis

The `enrich-deal` function sends this to `extract-deal-transcript`:

```text
Authorization: Bearer <SERVICE_ROLE_KEY>
apikey: <ANON_KEY>
```

The service role key is NOT a valid JWT in the traditional sense -- it's a special key. When the Edge Gateway has `verify_jwt = true` (or the config hasn't been synced), it tries to verify this as a standard JWT and rejects it.

The `extract-deal-transcript` function has `verify_jwt = false` in config.toml (line 134-135), but this configuration may not be deployed to the live Edge Gateway. Config.toml changes require explicit deployment/sync.

### Fix 1: Auth Pattern for Internal Calls

Modify `extract-deal-transcript` to not perform manual JWT validation that could conflict with the gateway, and ensure the internal call pattern works reliably.

**Option A (Recommended):** Change the internal call headers to use the anon key for both `apikey` AND `Authorization`, then pass the service role key in a custom header (e.g., `x-service-role-key`) for the function to validate internally. This avoids the gateway rejecting the service role key as a JWT.

**Option B:** Ensure `config.toml` is properly deployed and the `verify_jwt = false` is honored. Then the function's internal auth check (line 103) comparing bearer against service role key should work.

We will implement **Option A** as it's more robust:

- In `enrich-deal/index.ts`: Change the internal call to pass `Authorization: Bearer <ANON_KEY>` and add a custom header `x-internal-secret: <SERVICE_ROLE_KEY>`
- In `extract-deal-transcript/index.ts`: Update auth check to accept the custom header for internal calls while still supporting user JWTs for direct calls

### Fix 2: Build Error (parse-tracker-documents)

Change the import in `parse-tracker-documents/index.ts` from:
```typescript
import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";
```
to use `esm.sh` (consistent with other edge functions):
```typescript
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.30.1";
```

### Fix 3: Redeploy config.toml

Ensure `verify_jwt = false` is properly applied for `extract-deal-transcript` by redeploying both functions after the code changes.

### Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/enrich-deal/index.ts` | Update internal call headers to use anon key for Authorization + custom header for service role |
| `supabase/functions/extract-deal-transcript/index.ts` | Update auth check to accept custom internal header |
| `supabase/functions/parse-tracker-documents/index.ts` | Fix Anthropic SDK import to use esm.sh |

### After Implementation

1. Deploy all three edge functions
2. Re-run enrichment on the failing deal using "Re-extract All Transcripts"
3. Verify all 10 transcripts process successfully and transcript-derived fields (executive summary, business model, services, owner goals, etc.) are populated

