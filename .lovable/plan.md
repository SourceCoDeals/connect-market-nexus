
Goal

Do a true reset of the email system: preserve all current email functionality, but stop using the mixed legacy architecture entirely.

Why a full wipe/rebuild is justified

The codebase is still running multiple generations of email architecture at once:
- agreement emails have both the new `request-agreement-email` path and legacy NDA/Fee email paths still present
- some UI surfaces call the shared helper, others still invoke edge functions directly
- `enhanced-admin-notification` still contains old multi-provider logic
- sender identity is still inconsistent across functions (`SENDER_EMAIL`, `ADMIN_EMAIL`, `NOREPLY_EMAIL`, hardcoded values)
- delivery tracking is not a clean source of truth: “sent to provider” is app acceptance, while webhook delivery uses a different identifier model
- admin/test UI still references old sender assumptions and legacy behavior

That means patching one function at a time will keep missing hidden old paths. A real fix needs a clean replacement architecture and then a hard cutover.

Phase count

This should be done in 7 phases.

```text
Current:
UI -> many edge functions -> mixed sender rules -> mixed logs -> webhook -> confusing UI states

Target:
UI/helpers -> one email domain service layer -> one provider adapter -> one message model -> one event model -> clear admin status UI
```

Phase 1 — Full inventory + freeze legacy usage
What happens:
- map every email-sending edge function, every UI trigger, every admin trigger, and every auth/system trigger
- classify each flow by business purpose: agreements, approvals, connection requests, onboarding, feedback, task notifications, admin notifications, auth emails
- identify every legacy path to be removed from live usage

What gets flagged immediately:
- legacy agreement flows (`send-nda-email`, `send-fee-agreement-email`)
- old mixed-provider admin notification flow (`enhanced-admin-notification`)
- all direct UI invocations that bypass the canonical helper layer
- outdated test center docs and hardcoded sender copy

Output:
- one approved deletion/cutover list
- one keep/replace list for every email flow

Phase 2 — Build a brand-new email data model
What happens:
- stop treating old `email_delivery_logs` semantics as the foundation
- introduce a clean new model with:
  - one outbound message record per logical email
  - one append-only event stream for accepted/delivered/opened/bounced/blocked/spam/failed
  - a dedicated provider message id as the canonical external id
  - a separate internal request id for app correlation

Why this matters:
- no more mixing “accepted by API” and “delivered to inbox” in the same ambiguous field
- admin UI can finally show true states instead of “sent to provider”

Output:
- new source of truth for email observability
- old logs become legacy history only, not runtime truth

Phase 3 — Rebuild the sending core from scratch
What happens:
- create one new shared sending layer for the whole app
- one provider only
- one sender identity policy
- one reply-to policy
- one idempotency rule
- one error format
- one logging path
- one attachment policy

Rules of the new core:
- every outbound email must go through the same provider adapter
- no edge function may call the provider directly anymore
- no function may choose its own sender fallback anymore
- every send must return both internal message id and provider message id

Output:
- a single trusted delivery engine
- no more direct Brevo/Resend calls scattered across the codebase

Phase 4 — Rebuild agreements as the first clean domain
What happens:
- replace the current agreement send model with one fresh agreement-specific flow built on the new core
- remove legacy NDA/Fee functions from live usage
- route admin documents, buyer modals, resend actions, and admin user tables into the same new agreement service
- rebuild attachment handling and request tracking on the new message model

Why first:
- this is the path you are actively testing
- this is also where the old/new system overlap is most dangerous today

Output:
- one agreement sender
- one agreement status model
- one agreement inbox/delivery view

Phase 5 — Rebuild every other email family onto the new core
Families to migrate:
- account approval/rejection
- connection request confirmation/admin notification/approval
- auth-adjacent emails
- onboarding emails
- feedback/contact emails
- task notifications
- admin notifications
- deal alerts/referrals/message notifications

Rule:
- no family keeps its old edge function internals
- domain-specific functions may remain only as thin wrappers if needed, but all delivery must go through the new core

Output:
- all business functionality preserved
- old email behavior replaced, not patched

Phase 6 — Rebuild observability, admin UI, and test tooling
What happens:
- replace “sent to provider” wording with explicit lifecycle states:
  - queued / accepted by provider / delivered / opened / bounced / blocked / spam / failed
- update admin documents to read only the new message/event model
- update testing hub/email test center so it documents only the new system
- remove stale hardcoded sender strings from UI copy

Why this matters:
- today the UI can say something that sounds successful even when it only means “provider accepted request”
- after rebuild, the UI must describe reality

Output:
- trustworthy admin diagnostics
- trustworthy operator language
- no leftover old sender references

Phase 7 — Hard cutover and deletion
What happens:
- switch all UI call sites to the new architecture
- remove legacy helper paths
- delete old email edge functions that are replaced
- delete legacy test definitions/copy that refer to old senders or old flows
- remove dead code around old sender env names and mixed fallback logic

Important:
I would not delete first and rebuild second. I would build the new system, cut traffic over, verify, then delete the old code completely. That is the safest way to truly wipe old architecture without breaking live functionality.

Technical details

Current evidence from the codebase that this must be a full rebuild:
- admin documents currently use `request-agreement-email`, but legacy NDA/Fee hooks still exist elsewhere
- `enhanced-admin-notification` still contains old Resend/Brevo retry logic and does not use the shared sender layer
- `send-approval-email` still has old sender fallback logic
- multiple UI files still invoke email functions directly instead of going through a single domain helper
- `email_delivery_logs` is being used for both app send attempts and webhook provider events, which keeps observability muddy
- UI still contains old sender text like `support@sourcecodeals.com` in multiple places

Scope expectation

This is not a one-function fix. It is a system replacement covering:
- email edge functions
- shared sender utilities
- agreement flows
- admin notification flows
- auth-related send flows
- admin/test dashboards
- message tracking schema
- UI helper layer
- legacy code deletion

Success criteria

I would consider the rebuild complete only when all of these are true:
1. every email path uses the new core
2. no live UI path invokes legacy email functions
3. there is one canonical provider message id model
4. admin UI no longer uses legacy correlation logic
5. old sender env/fallback patterns are gone
6. old agreement email functions are deleted or fully detached
7. all user-facing copy reflects the actual sender/reply behavior
8. the old email architecture is no longer referenced anywhere in live code

Recommended execution order

- Phase 1-3: foundation
- Phase 4: agreements first
- Phase 5: remaining email families
- Phase 6-7: UI/test rebuild + hard deletion

So the answer is: 7 phases for a proper wipe-and-rebuild, with agreements handled first but the entire platform migrated onto one brand-new email architecture before legacy code is deleted.
