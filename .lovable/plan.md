
## Investigation result

No, this is not actually solved yet. Based on the code and the auth history, the current behavior strongly suggests the verification is succeeding in Supabase Auth, but the app is failing to persist that status into `profiles.email_verified`, which is the field your UI and admin dashboard rely on.

## What is happening now

### 1. The email link is likely verifying the auth user
Your auth logs already show the expected verification event pattern:
- `/verify` returns `303`
- then a `login` event happens immediately after

That means the email link is not simply broken. Supabase is accepting the verification flow and creating a session.

### 2. The app screen depends on `profiles.email_verified`, not just Auth
`PendingApproval.tsx` decides what to show like this:

```ts
if (user?.approval_status === 'rejected') return 'rejected';
else if (user?.email_verified) return 'approved_pending';
else return 'email_not_verified';
```

So if `user.email_verified` stays `false`, the user will keep seeing:
- “Verify your email”
- resend button
- wrong next-step state

### 3. The admin dashboard also reads from the profile record
So if `profiles.email_verified` never flips to `true`, admin also sees the user as not verified.

## Root cause I found

There is a likely database-level blocker now:

### A profile-protection trigger is undoing the frontend update
In `supabase/migrations/20260617000000_client_portal_tables.sql`:

```sql
CREATE OR REPLACE FUNCTION protect_sensitive_profile_fields()
...
  NEW.email_verified := OLD.email_verified;
...
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_sensitive_profile_fields();
```

That means when a normal signed-in user hits this code in `src/pages/auth/callback.tsx`:

```ts
await supabase
  .from('profiles')
  .update({ email_verified: true })
  .eq('id', authUser.id)
  .eq('email_verified', false);
```

the trigger can silently rewrite `NEW.email_verified` back to the old value.

So the callback may run, but the database update never truly sticks.

## Why the old fix didn’t hold

The earlier fix only handled the frontend callback path.

But your project already has a better long-term mechanism in SQL:
- `sync_user_verification_status()`
- trigger on `auth.users`
- updates `public.profiles.email_verified` when `email_confirmed_at` changes

That is the correct source-of-truth sync because it runs from the auth table side, not from the client.

However, since you are still seeing this issue, one of these is true:
1. the auth-trigger sync is missing in the live DB
2. it exists but is not firing reliably
3. it fires, but another later process resets the profile field
4. the frontend is loading stale profile data right after redirect and not refreshing correctly

Based on the code review, the highest-confidence issue is #3 plus a fragile frontend fallback.

## Most likely failure chain

```text
User clicks verification link
  -> Supabase verifies auth user
  -> session is created
  -> /auth/callback runs
  -> callback tries to update profiles.email_verified = true
  -> BEFORE UPDATE trigger restores old value
  -> profile remains false
  -> PendingApproval reads false
  -> shows "Verify your email"
  -> admin dashboard also shows unverified
```

## What I would implement

### 1. Stop relying on the client to write `email_verified`
Remove the frontend responsibility for flipping `profiles.email_verified` in `src/pages/auth/callback.tsx`.

Instead, rely on database sync from `auth.users.email_confirmed_at`.

### 2. Harden the DB sync path
Audit and fix the auth-to-profile synchronization so that when Supabase verifies an email:
- `auth.users.email_confirmed_at` changes
- trigger updates `profiles.email_verified = true`
- this bypasses user-edit protections safely

If needed, re-create the `AFTER UPDATE OF email_confirmed_at ON auth.users` trigger and function in a migration.

### 3. Update the profile-protection trigger so it doesn’t block system verification sync
Keep the protection for normal user edits, but allow server-side/system-origin verification updates.

Practical approach:
- do not let client self-edits set `email_verified`
- but allow the auth sync trigger / privileged flow to set it

### 4. Make the callback refresh after auth is established
After session resolution in `auth/callback.tsx`, explicitly re-fetch the profile after navigation-critical sync points, instead of navigating using a stale pre-update profile snapshot.

Right now it fetches `profile` first, then updates `email_verified`, then navigates based on older data.

### 5. Add a fallback reconciliation on pending approval
When `/pending-approval` loads and:
- Auth session exists
- `auth.user.email_confirmed_at` is true
- but profile still says false

then trigger a one-time reconciliation path to refresh or repair the profile state before deciding which screen to render.

This makes the UI resilient even if callback timing is imperfect.

## Files to change

### `src/pages/auth/callback.tsx`
- stop treating client-side profile update as the primary verification mechanism
- re-fetch profile after session establishment
- navigate based on fresh profile/auth state, not stale pre-update state

### `src/pages/PendingApproval.tsx`
- add defensive reconciliation so verified auth users don’t get stuck on the verify-email screen
- optionally show a short “finalizing your verification” state instead of the wrong screen

### `supabase/migrations/...`
Create a migration to:
- verify/recreate `sync_user_verification_status()`
- verify/recreate the `auth.users` update trigger
- adjust `protect_sensitive_profile_fields()` so it doesn’t block legitimate system verification sync

## What this will fix

After the fix:
- clicking the verification link will truly mark the profile verified
- pending approval will show the correct “Application received / what happens next / docs” state
- admin dashboard will reflect verified status correctly
- fresh signups will work without manual SQL patches

## Technical details

```text
Current fragile source:
AuthCallback client update -> profiles.email_verified

Correct durable source:
auth.users.email_confirmed_at
  -> DB trigger sync_user_verification_status()
  -> profiles.email_verified = true
  -> UI/admin read same truth
```

### Why this is the right architecture
- verification originates in Supabase Auth
- profile is a projection of auth state
- projecting auth state should happen in the database, not only in the browser
- browser callback should help UX, not be the sole source of truth

## Confidence assessment

High confidence:
- the app is still reading `profiles.email_verified = false`
- pending approval UI is profile-driven
- admin is profile-driven
- the profile protection trigger is capable of undoing the callback update

Medium confidence:
- the auth-side DB trigger may also need repair or reattachment in production

## Implementation plan

1. Inspect the existing auth verification sync migration chain and make the auth-trigger path authoritative.
2. Patch the profile-protection trigger so system verification sync is allowed while user self-edits remain blocked.
3. Refactor `auth/callback.tsx` to re-read profile state after session setup and avoid navigating from stale data.
4. Add a defensive reconciliation/finalization check in `PendingApproval.tsx`.
5. Verify end-to-end for a fresh signup: signup -> email link -> callback -> pending approval correct state -> admin verified state.

