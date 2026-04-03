

# Email System — Current State & Remaining Work

## What's Already Done

1. **Unified sender**: All edge functions use `sendEmail()` from `_shared/email-sender.ts`. Zero legacy `sendViaBervo` or `brevo-sender.ts` references remain.
2. **Correct API key**: `BREVO_API_KEY` rotated and confirmed working.
3. **Locked sender identity**: `adam.haile@sourcecodeals.com` everywhere.
4. **Tracking**: Every send logs to `outbound_emails` + `email_events`.
5. **Webhook connected**: `brevo-webhook` updates `outbound_emails` status on delivery/bounce/open/click events AND populates `suppressed_emails`.
6. **Bounce suppression**: `suppressed_emails` table exists. `sendEmail()` checks it before every send. Webhook auto-populates it on hard bounce, spam complaint, and unsubscribe.
7. **Email Dashboard**: `/admin/emails` page exists with stats, filters, and log table. Linked in admin sidebar.
8. **Template wrapper created**: `_shared/email-template-wrapper.ts` with `wrapEmailHtml()` exists but is NOT yet used by any edge function (except `send-memo-email` which has its own inline version).

## What Still Needs Work

### 1. Consolidate Duplicate/Unused Edge Functions
Three functions have no frontend callers and should be deleted:
- **`enhanced-email-delivery`** — generic wrapper, zero value over `sendEmail()` directly
- **`send-password-reset-email`** — zero frontend callers (Supabase Auth handles password reset natively)

Two functions overlap:
- **`send-approval-email`** — called from `use-admin-email.ts` (line 323)
- **`send-templated-approval-email`** — called from `EmailTestCentre.tsx` and is the canonical approval email

One of these should be consolidated. `send-templated-approval-email` appears to be the real one; `send-approval-email` should be migrated to call the same logic or be replaced.

Additionally, `enhanced-admin-notification` is called from `use-nuclear-auth.ts` (line 331) for new user signup notifications. It's a thin wrapper — could be replaced with a direct `sendEmail()` call from a simpler function, but it has an active caller so it can't just be deleted without a migration.

**Work**: Delete 2 unused functions, consolidate 2 approval functions into 1, evaluate `enhanced-admin-notification`.

### 2. Adopt Shared Email Template Wrapper
`wrapEmailHtml()` exists in `_shared/email-template-wrapper.ts` but zero edge functions import it. Every function still builds its own raw HTML. The highest-traffic email templates should be migrated to use the wrapper for consistent branding:

Priority templates to migrate:
- `request-agreement-email` (NDA/Fee Agreement sends)
- `send-templated-approval-email` (buyer approval)
- `send-connection-notification` (connection request updates)
- `send-user-notification` (general notifications)
- `user-journey-notifications` (onboarding emails)
- `send-deal-alert` (deal alerts)

**Work**: Update ~6-8 edge functions to import and use `wrapEmailHtml()` instead of inline HTML construction.

### 3. Update plan.md to Reflect Reality
The `.lovable/plan.md` file is outdated — it still lists items 1, 2, 4, 5 as "needs work" when they're already done.

**Work**: Rewrite `plan.md` to reflect current state.

### 4. Email Test Centre Accuracy
`EmailTestCentre.tsx` references specific function names and payloads. After consolidation, it needs to be updated to match the surviving functions.

**Work**: Update test centre entries after consolidation.

## Recommended Execution

### Phase 1: Delete unused functions + consolidate approval emails
- Delete `enhanced-email-delivery` and `send-password-reset-email`
- Merge `send-approval-email` into `send-templated-approval-email` (update `use-admin-email.ts` to call `send-templated-approval-email`)
- Evaluate `enhanced-admin-notification` — replace with simpler inline call or keep

### Phase 2: Migrate top templates to use shared wrapper
- Update 6-8 edge functions to use `wrapEmailHtml()` from `_shared/email-template-wrapper.ts`
- Redeploy all changed functions

### Phase 3: Cleanup
- Update `plan.md`
- Update `EmailTestCentre.tsx` references
- Final verification pass

## Summary

The core email infrastructure is solid and working. What remains is cleanup work: removing dead code (2 unused functions), consolidating duplicates (2 approval functions → 1), and adopting the shared HTML wrapper across the most important templates for consistent branding. None of this blocks email delivery — it's maintenance and polish.

