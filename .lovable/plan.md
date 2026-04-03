

# Fix Email Links — Messages Screen + Full Audit

## Issues Found

### 1. `notify-buyer-new-message` (line 69) — WRONG
- **Current**: `https://marketplace.sourcecodeals.com/my-deals`
- **Should be**: `https://marketplace.sourcecodeals.com/messages`
- This is the email buyers get when an admin replies. The "View Message" button must take them to their messages screen, not My Deals.

### 2. `send-connection-notification` approval (line 123) — CORRECT
- Links to `/my-deals` for connection approval notifications — correct, the deal appears there.

### 3. `notify-agreement-confirmed` (line 60) — WRONG DOMAIN
- **Current**: `https://app.sourcecodeals.com/marketplace`
- **Should be**: `https://marketplace.sourcecodeals.com/marketplace`
- The `app.sourcecodeals.com` domain is stale/wrong. All buyer-facing links should use `marketplace.sourcecodeals.com`.

### 4. `email-template-wrapper.ts` unsubscribe (line 44) — WRONG DOMAIN
- **Current**: `https://app.sourcecodeals.com/unsubscribe?email=...`
- **Should be**: `https://marketplace.sourcecodeals.com/unsubscribe?email=...`

### 5. `email-sender.ts` unsubscribe header (line 162) — WRONG DOMAIN
- **Current**: `https://app.sourcecodeals.com` fallback
- **Should be**: `https://marketplace.sourcecodeals.com`

### 6. `send-marketplace-invitation` (line 44) — WRONG DOMAIN
- **Current**: `https://app.sourcecodeals.com/welcome`
- **Should be**: `https://marketplace.sourcecodeals.com/welcome`

### 7. Other links verified as CORRECT
- `send-verification-success-email` → `/login` ✓
- `send-data-recovery-email` → `/profile` ✓
- `send-connection-notification` login/listing/admin URLs → all correct ✓
- `send-task-notification-email` → admin pipeline URL ✓
- `send-feedback-notification` → `/admin` ✓
- `send-onboarding-day2` → uses `SITE_URL` env var with correct fallback ✓
- `send-deal-alert` → uses `SITE_URL` env var ✓

## Changes

### Files to update:

1. **`supabase/functions/notify-buyer-new-message/index.ts`** — Change line 69 loginUrl from `/my-deals` to `/messages`

2. **`supabase/functions/notify-agreement-confirmed/index.ts`** — Change line 60 appUrl from `https://app.sourcecodeals.com` to `https://marketplace.sourcecodeals.com`

3. **`supabase/functions/_shared/email-template-wrapper.ts`** — Change line 44 unsubscribe URL domain from `app.sourcecodeals.com` to `marketplace.sourcecodeals.com`

4. **`supabase/functions/_shared/email-sender.ts`** — Change line 162 fallback from `app.sourcecodeals.com` to `marketplace.sourcecodeals.com`

5. **`supabase/functions/send-marketplace-invitation/index.ts`** — Change line 44 fallback from `app.sourcecodeals.com` to `marketplace.sourcecodeals.com`

### Deploy all updated edge functions after changes.

