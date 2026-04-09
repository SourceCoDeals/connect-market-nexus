

# Fix Password Reset: Remove Strength Enforcement + Enable Browser Save

## Root Cause

The reset password page calls the `password-security` edge function to validate strength. That function **requires authentication** (`requireAuth`). But users resetting their password are **not logged in** — they arrive via an email link. So the validation always fails with 401, returning `meets_policy: false`, which disables the submit button. Users can never reset their password regardless of what they type.

## Fix (Minimal, Surgical)

### 1. `src/pages/ResetPassword.tsx`
- Remove the `usePasswordSecurity` hook and `PasswordStrengthIndicator` component entirely
- Remove their imports
- Change the submit button's disabled condition: only require `password.length >= 6` and `password === confirm` (Supabase's own minimum is 6)
- Add `autoComplete="new-password"` to both password inputs — this is what triggers Chrome/Safari/Firefox to offer "Save this password?" after submission
- Add a `<form>` `name="reset-password"` attribute for better password manager detection
- Keep the edge function call to `password-reset` for the actual reset — that part works fine

### 2. `supabase/functions/password-reset/index.ts`
- Change `newPassword.length < 8` check on line 156 to `newPassword.length < 6` to match the relaxed policy

### Not Touched
- Signup flow (uses its own password fields — unchanged)
- `password-security` edge function (stays as-is, just no longer called from reset page)
- `PasswordStrengthIndicator` component (stays in codebase, just not used on reset page)
- Login flow, verification links, auth context — all untouched

## How Browser Password Save Works
Adding `autoComplete="new-password"` to the password inputs tells the browser this is a new credential. After the form submits successfully and navigates to `/login`, Chrome/Safari/Firefox will prompt "Save password for this site?" — storing it in the user's Google account (if signed into Chrome) or device keychain.

## Files

| File | Change |
|------|--------|
| `src/pages/ResetPassword.tsx` | Remove password security hook/indicator. Add `autoComplete="new-password"`. Relax min length to 6. |
| `supabase/functions/password-reset/index.ts` | Change min length check from 8 to 6. |

