

## Fix All Email Notifications via Brevo

### Root Causes Found

1. **JWT gateway rejection**: `send-connection-notification`, `notify-buyer-new-message`, and `notify-admin-new-message` all have `verify_jwt = true` in config.toml, but they use internal auth validation. The Supabase gateway rejects valid JWTs before the function can run its own check. This is the primary reason "email notifications don't work at all."

2. **Resend dependency**: `send-verification-success-email` uses the Resend SDK instead of Brevo. If `RESEND_API_KEY` isn't configured, this silently fails.

3. **Missing admin recipients**: When `send-connection-notification` is called with `type: 'admin_notification'`, the frontend doesn't pass `recipientEmail` or `recipientName`. The edge function sends to... nobody. It should look up all admin emails like `notify-admin-new-message` does.

4. **Auth mismatch**: `user-journey-notifications` calls `enhanced-email-delivery`, which requires admin auth. But journey events fire from non-admin contexts (signup, verification), so they always fail.

### Complete Email Notification Matrix

| Event | Edge Function | Recipient | Status |
|-------|-------------|-----------|--------|
| Connection request submitted | `send-connection-notification` (user_confirmation) | Buyer | BROKEN (verify_jwt) |
| Connection request submitted | `send-connection-notification` (admin_notification) | All admins | BROKEN (no recipientEmail + verify_jwt) |
| New user registered | `user-journey-notifications` -> `enhanced-email-delivery` | Admin | BROKEN (admin auth required) |
| Email verified | `send-verification-success-email` | Buyer | BROKEN (uses Resend) |
| Buyer approved | `send-templated-approval-email` | Buyer | WORKS (admin calls it) |
| Buyer rejected | `notify-buyer-rejection` | Buyer | WORKS (uses sendViaBervo) |
| Admin sends message | `notify-buyer-new-message` | Buyer | BROKEN (verify_jwt) |
| Buyer sends message | `notify-admin-new-message` | All admins | BROKEN (verify_jwt) |
| Admin custom email | `send-approval-email` | Buyer | WORKS |

### Implementation Plan

#### 1. Fix config.toml -- set verify_jwt = false for all notification functions

Change `verify_jwt` to `false` for:
- `send-connection-notification`
- `notify-buyer-new-message`
- `notify-admin-new-message`

These functions already do their own auth checks internally via `requireAuth`.

#### 2. Fix send-connection-notification admin notification

Rewrite the admin notification path to look up all admin emails via `user_roles` table (same pattern as `notify-admin-new-message`), removing the dependency on `recipientEmail` for admin type. Migrate from raw Brevo fetch to `sendViaBervo` shared utility.

#### 3. Convert send-verification-success-email from Resend to Brevo

Replace the Resend SDK with the `sendViaBervo` shared utility. Keep the same HTML template and email delivery logging. Remove Resend import.

#### 4. Fix user-journey-notifications to send directly via Brevo

Remove the call to `enhanced-email-delivery` (which requires admin auth). Instead, build and send emails directly using `sendViaBervo`. Handle each event type (user_created, email_verified, profile_approved, profile_rejected) with appropriate templates.

#### 5. Add missing notification: admin alert when new user registers

Create a new function `notify-admin-new-registration` that sends an email to all admins when a new user signs up. Wire it from the signup flow.

### Files to Change

| File | Change |
|------|--------|
| `supabase/config.toml` | Set `verify_jwt = false` for 3 notification functions |
| `supabase/functions/send-connection-notification/index.ts` | Use `sendViaBervo`, auto-lookup admin emails for admin type |
| `supabase/functions/send-verification-success-email/index.ts` | Replace Resend with `sendViaBervo` |
| `supabase/functions/user-journey-notifications/index.ts` | Send directly via `sendViaBervo` instead of calling `enhanced-email-delivery` |
| `src/hooks/marketplace/use-connections.ts` | Simplify admin notification payload (remove recipientEmail requirement) |

### What Already Works (No Changes Needed)

- `notify-buyer-rejection` -- uses `sendViaBervo` correctly
- `send-templated-approval-email` -- admin-invoked, Brevo direct
- `send-approval-email` -- admin-invoked, Brevo direct
- `notify-buyer-new-message` / `notify-admin-new-message` -- code is correct, just need config.toml fix

### Email Design Consistency

All migrated templates will follow the existing SourceCo brand pattern already used in `notify-buyer-new-message`:
- White background, SOURCECO header in uppercase gray
- Dark navy (#0E101A) CTA buttons
- Gold-tinted (#FCF9F0) quote blocks with gold border (#DEC76B)
- Warm footer divider (#E5DDD0)
