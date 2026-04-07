

# Fix Auth Callback Session Conflict + Resend Verification

## Root Cause Analysis

### Issue 1: "Auth session missing" on verification callback
When user clicks the verification link while logged in as a different user in the same browser:
1. Supabase `/verify` endpoint processes the token server-side (confirmed: `user_signedup` for `adambhaile00@gmail.com` returned 303)
2. Browser redirects to `/auth/callback` with token fragments in the URL
3. The callback page calls `supabase.auth.getUser()` which uses the **existing session** (the other logged-in user)
4. The token exchange from the URL hash never happens because there's no explicit call to handle it

**Fix:** Before calling `getUser()`, the callback must explicitly exchange the URL hash/query tokens. Supabase's `onAuthStateChange` listener or a manual check for hash params should handle this. The correct approach is to wait for the auth state change event triggered by the URL tokens, or call `supabase.auth.exchangeCodeForSession()` if using PKCE.

### Issue 2: PendingApproval resend redirects to wrong URL
Line 74 in `PendingApproval.tsx` sets `emailRedirectTo: '/pending-approval'` instead of `/auth/callback`. This bypasses the token exchange entirely, meaning the verification link from a resend on PendingApproval would never actually establish a session.

### Issue 3: SignupSuccess resend button
The resend itself works (auth logs show `/resend` returned 200). The issue is the same session conflict when the user clicks the new link.

## Changes

### 1. `src/pages/auth/callback.tsx` - Handle session conflict on verification
Before processing, the callback should:
- Check for auth tokens in the URL hash/query params
- If tokens are present, sign out the current session first (to clear the conflicting session)
- Then let Supabase process the URL tokens via `onAuthStateChange` or explicit exchange
- Only after the new session is established, proceed with profile lookup and routing

```text
Flow:
1. Page loads at /auth/callback#access_token=...
2. Detect URL has auth tokens (hash contains access_token or query has code)
3. If a different user is currently logged in, sign out first
4. Wait for onAuthStateChange to fire with the new session
5. Proceed with existing profile lookup + routing logic
```

### 2. `src/pages/PendingApproval.tsx` - Fix resend redirect URL
Change line 74 from `emailRedirectTo: '/pending-approval'` to `emailRedirectTo: '/auth/callback'` so the verification link properly goes through the token exchange flow.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/auth/callback.tsx` | Add URL token detection + session cleanup before `getUser()`; listen for `onAuthStateChange` to get the correct new session |
| `src/pages/PendingApproval.tsx` | Fix `emailRedirectTo` on line 74 to use `/auth/callback` |

## Technical Detail

The callback will:
1. Parse `window.location.hash` for `access_token` or `window.location.search` for `code` (PKCE)
2. If tokens found, call `supabase.auth.signOut({ scope: 'local' })` to clear any existing session without invalidating refresh tokens for the other user
3. Set up a one-time `onAuthStateChange` listener waiting for `SIGNED_IN` event
4. When the new session arrives, proceed with the existing profile lookup logic using the new `event.session.user`
5. If no auth state change fires within 10 seconds, show an error

This ensures that even if the user has another account logged in, the verification link correctly establishes the new user's session.

