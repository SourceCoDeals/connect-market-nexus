

# End-to-End Verification: Sign NDA Flow

## Complete Flow Trace

### Step 1: Buyer clicks "Sign NDA Now" (My Deals)
- **Component**: `AgreementSigningModal` opens, calls `supabase.functions.invoke('get-buyer-nda-embed')`
- **Status**: Working. Logs confirm: `Resolved firm ab961d3a... for user b0d649d7...`

### Step 2: Edge function resolves firm (with self-healing)
- **Function**: `get-buyer-nda-embed/index.ts`
- **Flow**:
  1. `resolve_user_firm_id(p_user_id)` RPC called
  2. If null: loads profile, calls `selfHealFirm()` (email domain match → company name match → create new firm + firm_members)
  3. If still null: returns `hasFirm: false` error
- **Status**: Deployed and working. Self-heal logic is in place.

### Step 3: PandaDoc document creation or session resume
- If `nda_pandadoc_document_id` exists on firm: creates fresh PandaDoc session, returns embed URL
- If no document: creates from template, sends silently, creates session, updates `firm_agreements` with `nda_status: 'sent'`, `nda_pandadoc_document_id`, logs to `pandadoc_webhook_log`
- **Status**: Correct. Updates only `firm_agreements` (no profile writes).

### Step 4: Admin notification on signing request
- `notifyAdminsSigningRequested()` inserts into `admin_notifications` for all admin/owner role users
- Metadata includes firm_id, buyer name/email, document type
- `action_url: '/admin/documents'`
- **Status**: In place for both new doc creation and existing doc resume.

### Step 5: Buyer signs in embedded iframe
- **Component**: `PandaDocSigningPanel` listens for `session_view.document.completed` postMessage
- On completion: calls `handleSigned()` which runs `invalidateAgreementQueries()` to refresh all related query keys (18 keys total)
- Auto-closes modal after 2s

### Step 6: Frontend confirmation call
- `PandaDocSigningPanel.onCompleted` triggers `AgreementSigningModal.handleSigned`
- **Gap identified**: `handleSigned` only invalidates queries and shows a toast. It does NOT call `confirm-agreement-signed`. The confirmation must come from somewhere else.
- Checking where `confirm-agreement-signed` is actually called...

Let me verify this.

### Step 7: Backend confirmation (`confirm-agreement-signed`)
- Called by the frontend after PandaDoc signing completes
- Polls PandaDoc API (0s, 1.5s, 3s delays) for `document.completed` status
- On confirmed:
  - Updates `firm_agreements`: `nda_signed=true`, `nda_status='signed'`, `nda_pandadoc_status='completed'`, `nda_signed_at`, `nda_signed_by_name`
  - Logs to `pandadoc_webhook_log`
  - Does NOT write to profiles (correct)
  - Sends buyer notification via `user_notifications` + system message in `connection_messages`
  - Sends confirmation emails (buyer + all admins) via Brevo
  - Creates admin notification: `document_completed`
- **Status**: Logic is correct, self-heal included.

### Step 8: Webhook backup (`pandadoc-webhook-handler`)
- PandaDoc sends webhook for `document.completed` / `document.viewed` / `document.declined` etc.
- Handler verifies HMAC-SHA256 signature
- Matches document to firm via `nda_pandadoc_document_id` or `fee_pandadoc_document_id`
- Updates `firm_agreements` with correct status fields
- Prevents backward state transitions (won't overwrite `completed` with `viewed`)
- Idempotency via `pandadoc_webhook_log` dedup
- Creates admin notifications for completed/declined/expired/voided
- Sends buyer notifications for completed
- **Status**: Correct and robust.

### Step 9: Realtime sync across screens
- `useAgreementStatusSync` subscribes to `postgres_changes` on `firm_agreements` table
- On any UPDATE: invalidates 18 query keys covering buyer, admin, and messaging screens
- `/admin/documents` (DocumentTrackingPage) has its own realtime subscription on `firm_agreements` changes
- **Status**: In place.

### Step 10: Admin visibility
- `/admin/documents` queries all `firm_agreements` rows, shows NDA/Fee status side-by-side
- Admin notification bell receives:
  - `document_signing_requested` when buyer opens signing form
  - `document_completed` when confirmed signed (from both `confirm-agreement-signed` and webhook)
- Admin emails sent on signing confirmation
- **Status**: Correct.

---

## Issue Found: `confirm-agreement-signed` is never called

Looking at `AgreementSigningModal.handleSigned()` (line 110-122), it only:
1. Shows a toast
2. Invalidates queries
3. Auto-closes modal

It does NOT invoke `confirm-agreement-signed`. This means:
- The `firm_agreements` row only gets updated if the **PandaDoc webhook** fires (async, could be delayed)
- OR if the buyer re-opens the embed and the `get-buyer-nda-embed` function's self-heal check catches `document.completed` status
- Buyer confirmation email is never sent from the frontend path
- Admin notification for signing completion relies entirely on the webhook

This is a real gap. If the webhook is delayed or fails, the buyer sees "Signed!" but the DB doesn't reflect it until something else triggers the update.

---

## Recommended Fix

Add a call to `confirm-agreement-signed` in the `handleSigned` callback of `AgreementSigningModal`. This ensures the DB is updated immediately when the buyer completes signing, rather than waiting for the webhook.

| File | Change |
|------|--------|
| `src/components/pandadoc/AgreementSigningModal.tsx` | In `handleSigned()`, add `supabase.functions.invoke('confirm-agreement-signed', { body: { documentType } })` before invalidating queries |

This is a one-line addition that closes the gap between the buyer seeing "Signed!" and the DB actually reflecting it.

Everything else in the flow is correctly wired:
- Self-healing is deployed and working
- `firm_agreements` is the single source of truth (no profile writes anywhere)
- Admin notifications fire at both request and completion stages
- Realtime sync propagates changes to all screens
- Webhook provides backup confirmation with idempotency
- Query invalidation covers all 18 relevant cache keys

