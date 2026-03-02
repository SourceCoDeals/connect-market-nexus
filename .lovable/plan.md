

## Fix: Email Notifications Not Sending for Messages

### Root Cause

The production URL `https://marketplace.sourcecodeals.com` is **not included** in the CORS allowed origins list in `supabase/functions/_shared/cors.ts`. The allowlist only contains:
- `https://connect-market-nexus.lovable.app`
- `https://app.sourcecoconnect.com`
- `https://sourcecoconnect.com`

When the browser sends the preflight OPTIONS request from `marketplace.sourcecodeals.com`, the CORS check fails, the browser blocks the request, and neither `notify-buyer-new-message` nor `notify-admin-new-message` ever executes. This is why there are zero logs for either function.

### Fix

**File: `supabase/functions/_shared/cors.ts`** (line 14-17)

Add `https://marketplace.sourcecodeals.com` to the `PRODUCTION_ALLOWED_ORIGINS` array.

```typescript
const PRODUCTION_ALLOWED_ORIGINS = [
  "https://connect-market-nexus.lovable.app",
  "https://app.sourcecoconnect.com",
  "https://sourcecoconnect.com",
  "https://marketplace.sourcecodeals.com",
];
```

### Deployment

After this change, **all edge functions** that import from `_shared/cors.ts` need to be redeployed. The two message notification functions specifically:
- `notify-buyer-new-message`
- `notify-admin-new-message`

Both should also be redeployed to ensure the latest code is live (they may not have been deployed previously).

### Secondary: Verify Deployment

Since there are zero logs for both functions ever, they may also need an initial deployment. The implementation plan includes deploying both functions after the CORS fix.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/cors.ts` | Add `https://marketplace.sourcecodeals.com` to allowed origins |

### Post-fix

After deploying, both admin replies (triggering buyer email) and buyer messages (triggering admin email) should work from the production domain. The fire-and-forget pattern in `useSendMessage` will successfully invoke the functions, and emails will be sent via Brevo.

