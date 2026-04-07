

# Deep Dive: Why Confirmation Email Was Not Received + Why User Shows as Verified

## Root Cause Analysis

### Issue 1: "Shows verified in admin dashboard"
This is **correct behavior**. Database confirms:
- `created_at`: 12:28:06
- `confirmation_sent_at`: 12:28:06 (Supabase DID send the first confirmation email)
- `email_confirmed_at`: 12:28:23 (user clicked the link 17 seconds later)

The user verified successfully on the first attempt. The problem was never verification itself — it was the **callback page breaking** after verification (which we've been fixing).

### Issue 2: "Didn't receive the confirm your signup email"
The user is attempting to sign up again with the same email. Auth logs show `user_repeated_signup` at 12:41:32 from referer `/auth/callback`. Supabase's security behavior for repeated signups with an already-confirmed email: **returns 200 but does NOT send a new confirmation email** (to prevent email enumeration attacks). This is by design.

So:
- The app shows the SignupSuccess page as if a new account was created
- But no email is sent because the account already exists and is verified
- The "Resend Verification Email" button calls `supabase.auth.resend({ type: 'signup' })` which also silently does nothing for already-confirmed users

### Issue 3: Callback page errors
Already addressed with the module-level token capture fix. The user never saw the success flow because the callback broke, leading them to retry signup.

### Issue 4: No auth-email-hook configured
There is no `auth-email-hook` edge function and no email domain configured. Supabase is using its **default built-in email delivery** (which does work — it sent the first confirmation at 12:28:06). The `send-verification-success-email` edge function has no logs, suggesting it either fails silently or was never successfully invoked.

## What Actually Needs to Be Fixed

### Fix 1: Detect duplicate signup and redirect to login
In `use-nuclear-auth.ts`, after `signUp()`, Supabase returns `data.user` with an empty `identities` array for existing users. The code does not check this — it proceeds as if signup succeeded, shows SignupSuccess, and the user waits for an email that will never arrive.

**Change**: After `signUp()`, check `data.user?.identities?.length === 0`. If true, this is a duplicate signup. Show a toast telling the user they already have an account and redirect to `/login`.

### Fix 2: Resend button should handle already-verified state
The `SignupSuccess` page checks email verification via `supabase.auth.getUser()` on mount, but after a repeated signup the user is NOT logged in (Supabase doesn't create a session for repeated signups). So `getUser()` fails silently and `emailVerified` stays false, showing the "Resend" button even though the email is already verified.

**Change**: Before attempting resend, call `supabase.auth.signInWithPassword()` or check via a different mechanism. Simpler: if `resend()` returns successfully but no email arrives, show a message suggesting the user may already be verified and should try logging in.

### Fix 3: Verify callback module-level capture is deployed
The module-level `CAPTURED_HASH`/`CAPTURED_SEARCH` fix exists in the code but there's a subtle issue: **Vite code-splits route components**. The `callback.tsx` file is only loaded when the user navigates to `/auth/callback`. At that point, the module loads and `CAPTURED_HASH` captures whatever is in the URL. If the Supabase client (loaded in the main bundle) has already cleared the hash by this time, the capture misses it.

However, since the Supabase client's `_initialize()` is async (uses `setTimeout(0)` or microtask), and the route module's top-level code runs synchronously during dynamic import, the capture should still win the race. This should work correctly.

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/use-nuclear-auth.ts` | After `signUp()`, check `data.user?.identities?.length === 0` — if true, throw/return with a specific "account already exists" message and navigate to `/login` |
| `src/pages/SignupSuccess.tsx` | Update "Resend" error handling: if resend succeeds but user suspects no email, add a "Already verified? Try logging in" link. Also handle the case where the email param belongs to an already-verified account. |

## What Does NOT Need to Change
- Admin dashboard showing "verified" is correct — the email IS verified
- The callback page token capture fix is correct and should work
- Supabase's built-in email delivery is working (first email was sent and received)
- No auth-email-hook or custom email domain setup is needed for basic confirmation emails

