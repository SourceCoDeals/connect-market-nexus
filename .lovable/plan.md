

# Fix Auth Callback Timeout

## Root Cause

The Supabase JS client parses URL hash tokens (`#access_token=...&refresh_token=...`) only once during `createClient()` initialization. Since the client is a singleton created when the app first loads (not when `/auth/callback` mounts), by the time the callback component runs, the hash tokens have either already been consumed or were never seen by the client.

The current code calls `signOut()` then `getSession()` hoping it will re-parse the URL - it does not. Result: SIGNED_IN never fires, 15-second timeout hits.

## Fix

In `src/pages/auth/callback.tsx`:

1. When URL hash contains `access_token`, manually parse `access_token` and `refresh_token` from the hash
2. Call `supabase.auth.setSession({ access_token, refresh_token })` directly - this establishes the session immediately without waiting for any event
3. Remove the complex Promise/onAuthStateChange/timeout pattern - `setSession()` is synchronous and returns the user
4. Keep the `signOut({ scope: 'local' })` before `setSession()` to clear any conflicting session
5. For PKCE flow (`?code=` in query), use `supabase.auth.exchangeCodeForSession(code)` instead

This makes the callback near-instant (one API call) instead of waiting up to 15 seconds.

## Technical Detail

```text
Current (broken):
  signOut → onAuthStateChange listener → getSession() → ... timeout after 15s

Fixed:
  signOut → parse hash → setSession({ access_token, refresh_token }) → done (~200ms)
```

The hash parsing extracts parameters from `window.location.hash`:
- `access_token` (required)
- `refresh_token` (required)
- `type` (optional, indicates verification type)

## Files Changed

| File | Change |
|------|--------|
| `src/pages/auth/callback.tsx` | Replace onAuthStateChange/timeout pattern with direct `setSession()` call using parsed URL hash tokens |

