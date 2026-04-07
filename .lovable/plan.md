
Root cause is now clear.

What is actually happening:
1. The verification link does work.
2. Supabase verifies the email and creates a valid session for the new user.
3. The profile sync updates `profiles.email_verified`, which is why the admin dashboard shows the user as verified.
4. Your app then destroys that freshly-created session inside `/auth/callback`, so the callback page errors even though verification already succeeded.
5. Manual login works afterward because it creates a brand-new session.

Why I’m confident:
- In the callback code, `src/pages/auth/callback.tsx` explicitly does `supabase.auth.signOut({ scope: 'local' })` before `setSession()` / `exchangeCodeForSession()`.
- The auth logs show the exact sequence:
  - `/verify` succeeds
  - implicit login happens for `adambhaile00@gmail.com`
  - `/user` succeeds
  - `/logout` happens immediately after
  - then `/user` fails with session-not-found / auth-missing
- That means the app is logging the user out right after Supabase signs them in from the email link.

Why previous fixes failed:
- We focused on token-capture timing.
- But the deeper issue is not “missing tokens first”; it is “session created, then immediately revoked by our own callback logic.”
- So even a perfect hash capture cannot survive if the callback logs out the active session first.

Plan to fix:
1. Rewrite `src/pages/auth/callback.tsx` to be non-destructive.
   - Remove both pre-emptive `signOut({ scope: 'local' })` calls.
   - Never sign out inside the callback.
2. Change callback resolution order:
   - If hash tokens exist: call `setSession()` directly.
   - Else if PKCE code exists: call `exchangeCodeForSession()` directly.
   - Else: use `getSession()` instead of `getUser()` as the fallback source of truth.
3. Add a “session already exists” success path.
   - If token processing fails but `getSession()` already has a user, continue instead of throwing.
   - This handles the case where Supabase already restored the session automatically before our callback code runs.
4. Make the callback fast.
   - Redirect to `/pending-approval` or the final destination immediately after session/profile resolution.
   - Move verification-success emails / journey notifications to fire-and-forget after navigation so the user does not sit on a loading screen.
5. Reduce auth noise that can interfere during first load.
   - Update `src/hooks/use-initial-session-tracking.ts` to avoid calling `getUser()` on cold anonymous loads; use `getSession()` or a softer check first.
   - This won’t be the main fix, but it will reduce “Auth session missing” churn during startup.
6. Improve the fallback UX.
   - If the verification link has already been consumed, show a friendly “Email already verified — try logging in” state instead of a raw authentication error.

Files to change:
- `src/pages/auth/callback.tsx` — main fix
- `src/hooks/use-initial-session-tracking.ts` — reduce startup auth races/noise
- optionally `src/pages/SignupSuccess.tsx` — better “already verified / link already used” guidance

Expected result after this fix:
- Clicking the email link verifies the user
- The callback keeps the new session alive instead of revoking it
- The user is redirected straight to the pending-approval screen
- Admin still shows verified
- Logging in later also continues to work
- Callback becomes much faster because it no longer waits on extra work before redirecting

Technical note:
The admin “verified” badge is not the bug. It is correct. The real bug is frontend callback session handling after verification, not verification itself.

No database migration is needed for this fix.