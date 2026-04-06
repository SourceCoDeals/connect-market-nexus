

# Delay Welcome Email + Add Post-Verification Copy

## What Changes

### 1. Delay the welcome email by 60 seconds
**File:** `src/hooks/use-nuclear-auth.ts` (line 316)
Currently the `user-journey-notifications` edge function with `event_type: 'user_created'` fires immediately on signup -- same moment Supabase sends the verification email. The user receives both emails at once, which is confusing.

**Fix:** Wrap the welcome email call in a `setTimeout` of 60,000ms (1 minute). The call is already fire-and-forget (`.catch()`), so delaying it has no impact on the signup flow. Use `setTimeout` on the client side -- the user remains on the pending-approval page for much longer than 1 minute, so the timer will fire reliably.

### 2. Update the welcome email body copy
**File:** `supabase/functions/user-journey-notifications/index.ts` (lines 27-28 in `buildWelcomeHtml`)

After the existing line:
> "While you wait, verify your email address using the link we just sent you."

Add a new paragraph:
> "If you have already verified your email, a team member will manually review your profile and approve your access shortly, typically within a few hours."

This sets the right expectation so users know what is happening while they wait.

### 3. Update EmailTestCentre preview to match
**File:** `src/pages/admin/EmailTestCentre.tsx` (line 76)
Update the preview HTML for the welcome email to include the same new paragraph so the admin email catalogue stays accurate.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/use-nuclear-auth.ts` | Wrap welcome email invoke in 60-second `setTimeout` |
| `supabase/functions/user-journey-notifications/index.ts` | Add post-verification guidance paragraph to `buildWelcomeHtml` |
| `src/pages/admin/EmailTestCentre.tsx` | Update welcome email preview HTML to match |

## Notes
- The edge function must be redeployed after the copy change.
- The admin notification email (to support@sourcecodeals.com) still fires immediately -- only the buyer-facing welcome email is delayed.

