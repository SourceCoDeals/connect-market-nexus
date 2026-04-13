# Authentication Flow Audit

**Date:** 2026-04-13
**Scope:** Sign up, sign in, password reset — end to end

---

## CRITICAL — Users actively blocked or at risk

### C1: Password minimum length mismatch (6 vs 8 chars)

**Where:** Self-service password reset allows 6-char passwords. Profile change and admin reset require 8.

- `src/pages/ResetPassword.tsx` line 63: checks `password.length < 6`
- `supabase/functions/password-reset/index.ts` line 156: checks `< 6`
- `supabase/functions/admin-reset-password/index.ts`: checks `< 8`
- `src/pages/Profile/useProfileData.ts`: checks `< 8`

**Impact:** User resets password to 6 chars, then can't change it in profile settings (requires 8). Inconsistent security.

**Fix:** Change both ResetPassword.tsx and password-reset edge function to require 8 chars.

### C2: No session invalidation after password reset

**Where:** `supabase/functions/password-reset/index.ts` — after `updateUserById()`, existing sessions remain valid.

- Compare: Profile password change (`useProfileData.ts`) correctly calls `signOut({ scope: 'others' })` after update.

**Impact:** If a user's password was compromised and they reset it, the attacker's existing session stays active.

**Fix:** Add session invalidation after password update in the reset function.

### C3: Extended profile data silently lost on signup

**Where:** `src/hooks/use-nuclear-auth.ts` lines 306-314 — fire-and-forget `.then()` for 75 buyer profile fields.

**Impact:** If the profile update fails (network, RLS, constraint), user has auth account but incomplete profile. No retry, no error shown. User appears registered but is missing all buyer criteria, target locations, etc.

**Fix:** Make the profile update await-able with retry. If it fails after retries, store the data in localStorage and retry on next login.

### C4: Hardcoded redirect URLs in password reset

**Where:** `supabase/functions/password-reset/index.ts` lines 104-111 — `ALLOWED_ORIGINS` hardcoded to production domains only.

**Impact:** If deployed to staging or Lovable preview URL, reset emails contain links to production — user clicks link but lands on production (different environment, possibly different auth state).

**Fix:** Use `SITE_URL` environment variable with fallback to hardcoded production domain.

---

## HIGH — Works but fragile or fails in edge cases

### H1: ProtectedRoute loading check order

**Where:** `src/components/ProtectedRoute.tsx` line 23 — checks `isLoading || !authChecked`

**Impact:** If `isLoading` becomes false before `authChecked` is set to true (timing issue), the route renders content before auth state is confirmed. Could flash protected content to unauthenticated users.

**Fix:** Change to `!authChecked || isLoading` — check authChecked first.

### H2: Email verification sync timeout too short

**Where:** `src/pages/auth/callback.tsx` lines 89-102 — retries 5 times with 400ms backoff (max 2.5s).

**Impact:** Under database load, profile.email_verified may not sync within 2.5s. User sent to /pending-approval with stale verification state even though their email IS verified.

**Fix:** Increase to 8 retries with exponential backoff (max ~8 seconds).

### H3: No rate limiting on password reset requests

**Where:** `supabase/functions/password-reset/index.ts` — no rate limit check before generating token and sending email.

**Impact:** Attacker can flood a user's inbox with reset emails. Generic response prevents email enumeration but doesn't prevent spam.

**Fix:** Add rate limit: max 3 reset requests per email per hour.

### H4: No rate limiting on login attempts

**Where:** `src/pages/Login.tsx` — no client-side rate limiting. Relies entirely on Supabase's built-in rate limits.

**Impact:** Brute force possible if Supabase rate limits are too generous.

**Fix:** Add exponential backoff on failed attempts (1s, 2s, 4s, 8s delays).

### H5: Expired token cleanup missing

**Where:** `password_reset_tokens` table — expired tokens accumulate forever.

**Impact:** Table grows unbounded. No current impact on functionality but violates data hygiene.

**Fix:** Add a cron job to delete tokens where `expires_at < NOW() - interval '24 hours'`.

### H6: Reset token in URL query string

**Where:** Reset URL format: `/reset-password?token=<token>`

**Impact:** Token visible in browser history, server logs, referrer headers. If user copies URL and shares it, token exposed.

**Fix:** Accept but not critical — token is single-use and expires in 1 hour. Standard practice for most systems.

---

## LOW — UX issues, minor gaps

### L1: Logout always redirects to /login

**Where:** `src/hooks/use-nuclear-auth.ts` line 176

**Impact:** Admin users are redirected to `/login` instead of `/admin-login`. Minor UX confusion.

### L2: Approval status polling interval (30s)

**Where:** `src/pages/PendingApproval.tsx` lines 40-46

**Impact:** User waits up to 30 seconds to see approval. No realtime subscription.

### L3: Password validated twice in signup

**Where:** `src/pages/Signup/index.tsx` line 171 AND `useSignupValidation.ts` line 15

**Impact:** Redundant check, no functional issue.

### L4: Deal context parsing fails silently

**Where:** `src/pages/Signup/useSignupSubmit.ts` lines 113-135

**Impact:** If localStorage JSON corrupt, deal attribution lost. No user notification.

### L5: Global scope logout

**Where:** `supabase.auth.signOut({ scope: 'global' })` — logs out all tabs/devices.

**Impact:** User logged out of all sessions including mobile. May be unexpected.

---

## Flow Diagrams

### Signup: form → auth → profile → redirect

```
User fills form → useSignupSubmit → use-nuclear-auth.signup()
  → supabase.auth.signUp({ email, password, data: 10 core fields })
  → [Supabase creates auth.users row]
  → [Trigger: handle_new_user creates profiles row from core fields]
  → [Client: fire-and-forget profile.update() with 75 extended fields]
  → [Client: fire-and-forget welcome email, admin notification, firm creation, scoring]
  → navigate('/signup-success')
  → User sees "Check your email"
  → User clicks verification link → /auth/callback
  → Callback: verify token → check profile → retry sync → redirect
  → /pending-approval (if not yet approved)
```

### Signin: form → auth → session → redirect

```
User enters email+password → Login.tsx → use-nuclear-auth.login()
  → supabase.auth.signInWithPassword()
  → [Supabase verifies, creates session]
  → onAuthStateChange('SIGNED_IN')
  → loadProfile() → fetch from profiles table
  → set user state
  → ProtectedRoute checks: authChecked, approved, admin
  → redirect to /admin or /marketplace or /pending-approval
```

### Password Reset: request → email → link → new password

```
User enters email → ForgotPassword.tsx
  → invoke('password-reset', { action: 'request', email })
  → Edge function: find profile by email
  → Generate 32-byte random token, store in password_reset_tokens (1hr TTL)
  → Send email with link: marketplace.sourcecodeals.com/reset-password?token=XXX
  → Generic success message (no email leak)

User clicks link → ResetPassword.tsx
  → Read token from ?token= query param
  → User enters new password (min 6 chars — SHOULD BE 8)
  → invoke('password-reset', { action: 'reset', token, newPassword })
  → Edge function: validate token (exists, not used, not expired)
  → auth.admin.updateUserById(userId, { password })
  → Mark token as used
  → Client redirects to /login
  → NO SESSION INVALIDATION — old sessions remain valid
```
