# CTO Deep Dive: Onboarding, Education, Process Flow & Document Execution Audit

**Date:** 2026-02-23
**Scope:** Full architectural audit of the SourceCo Marketplace onboarding and transaction initiation system
**Classification:** Internal — CTO Advisory

---

## Executive Summary

The SourceCo onboarding system is a **functional but architecturally fragmented pipeline** that moves users from signup through email verification, admin approval, NDA signing, and marketplace activation. It works — but it works through a collection of loosely coupled components, not through a unified workflow engine.

The system has **no formal state machine**, **no workflow orchestrator**, **no event bus**, and **no centralized onboarding status model**. Onboarding state is scattered across `localStorage`, the `profiles` table, the `firm_agreements` table, and implicit UI routing logic in `ProtectedRoute.tsx`. Education is static and disconnected from qualification. Document signing (DocuSeal) is integrated but has asymmetric behavior between NDA and fee agreement flows. Activation after signing relies on cascading database updates with no transactional guarantees.

Despite these structural issues, the system has several **strengths worth preserving**: idempotent webhook processing, firm-level agreement inheritance, dual admin/buyer signing flows, and a clean DocuSeal embed integration. The foundation is solid — what's missing is the orchestration layer that ties it together.

**Critical finding:** The platform has no single source of truth for "where is this user in the onboarding funnel?" This is the root cause of most friction, data integrity, and scalability issues identified in this audit.

---

## 1. System Scope — What Was Audited

| Subsystem | Key Files | Status |
|-----------|-----------|--------|
| User signup flow | `src/pages/Signup/index.tsx`, `useSignupSubmit.ts`, `types.ts` | Audited |
| Email verification | `src/pages/PendingApproval.tsx`, `src/pages/auth/callback.tsx` | Audited |
| Admin approval | `supabase/functions/approve-marketplace-buyer/index.ts` | Audited |
| Onboarding popup | `src/components/onboarding/OnboardingPopup.tsx`, `src/hooks/use-onboarding.ts` | Audited |
| NDA signing gate | `src/components/docuseal/NdaGateModal.tsx`, `DocuSealSigningPanel.tsx` | Audited |
| Fee agreement gate | `src/components/docuseal/FeeAgreementGate.tsx` | Audited |
| DocuSeal webhooks | `supabase/functions/docuseal-webhook-handler/index.ts` | Audited |
| Firm creation | `supabase/functions/auto-create-firm-on-signup/index.ts` | Audited |
| Buyer NDA embed | `supabase/functions/get-buyer-nda-embed/index.ts` | Audited |
| Buyer fee embed | `supabase/functions/get-buyer-fee-embed/index.ts` | Audited |
| Agreement status | `src/hooks/use-agreement-status.ts`, `src/hooks/admin/use-firm-agreements.ts` | Audited |
| Auth context | `src/context/AuthContext.tsx`, `src/hooks/use-nuclear-auth.ts` | Audited |
| Route protection | `src/components/ProtectedRoute.tsx` | Audited |
| Admin agreement management | `src/hooks/admin/use-docuseal.ts`, `SendAgreementDialog.tsx` | Audited |
| Database schema | `supabase/migrations/` (firm_agreements, firm_members, profiles, docuseal_webhook_log) | Audited |

---

## 2. Onboarding Workflow Architecture

### 2.1 Current State: How Users Move Through Onboarding

The actual onboarding funnel is:

```
[Entry] → Signup (5-step form) → Email Verification → Admin Review (manual)
       → Approval → NDA Signing → Marketplace Access → Fee Agreement (on first connection request)
       → Full Platform Activation
```

**Entry sources identified in code:**
- `/signup` — direct form (primary)
- `/welcome` — persona selection page (buyer vs. seller)
- `/sell` — owner inquiry (separate flow, not connected to buyer onboarding)
- Referral links (`/referrals/:shareToken`)
- Chatbot (referenced in docs but no code integration found)

**User type detection:**
- Buyer type is selected at Step 4 of signup (`SignupStepBuyerType.tsx`) with 8 options: Corporate, PE, Family Office, Search Fund, Individual, Independent Sponsor, Advisor, Business Owner
- There is **no seller onboarding flow** in the codebase — sellers enter via `/sell` owner inquiry form, which is a separate system
- Admin vs. buyer role is determined by the `user_roles` table and a database trigger, not by the signup flow

### 2.2 State Management Diagnosis

**Finding: Onboarding state is stored in 5 separate locations with no synchronization guarantee.**

| State | Storage Location | Purpose |
|-------|-----------------|---------|
| Signup form progress | React `useState` (ephemeral) | Track which step user is on |
| Onboarding popup completed | `localStorage` (`onboarding_completed`) | Skip popup on return visits |
| Onboarding popup completed | `profiles.onboarding_completed` (DB) | Persistent record |
| Email verification | `profiles.email_verified` (DB) | Gate to admin review |
| Approval status | `profiles.approval_status` (DB) | Gate to marketplace |
| NDA signed | `firm_agreements.nda_signed` + `profiles.nda_signed` (dual) | Gate to deal details |
| Fee agreement signed | `firm_agreements.fee_agreement_signed` + `profiles.fee_agreement_signed` (dual) | Gate to connection requests |

**Critical issues:**

1. **Signup form progress is not persistent.** If a user closes the browser mid-signup, all data is lost. For a 5-step form collecting 70+ fields, this is a significant conversion killer. (`src/pages/Signup/index.tsx:28` — `useState(INITIAL_FORM_DATA)`)

2. **`localStorage` as source of truth for onboarding popup.** The `use-onboarding.ts` hook explicitly prioritizes `localStorage` over the database: "localStorage is source of truth" (line 60). If a user clears browser data or uses a different device, the popup reappears. Conversely, if `localStorage` says "completed" but the DB says "not completed," the popup is silently skipped with no DB correction.

3. **Dual storage for agreement status.** NDA/fee agreement signed status lives in both `profiles` (per-user) and `firm_agreements` (per-firm). The webhook handler (`docuseal-webhook-handler/index.ts:293-310`) syncs from firm to profiles, but this is a fire-and-forget operation with no retry on failure.

4. **No unified onboarding state model.** There is no single column, table, or object that represents "this user is at step X of onboarding." The current step is inferred by the UI at render time through a series of conditional checks in `ProtectedRoute.tsx` and `PendingApproval.tsx`.

### 2.3 Workflow Model Assessment

**Verdict: This is a collection of conditional redirects, not a workflow engine.**

The "orchestration" lives in three places:

1. **`ProtectedRoute.tsx`** (lines 57-68): Checks `is_admin`, `approval_status`, and redirects to `/pending-approval` or `/unauthorized`. This is the only gate between signup and marketplace.

2. **`PendingApproval.tsx`** (lines 192-199): A `getUIState()` function returns one of three strings: `'rejected'`, `'approved_pending'`, or `'email_not_verified'`. This is the closest thing to a state machine in the entire system.

3. **`NdaGateModal.tsx` / `FeeAgreementGate.tsx`**: These are inline UI gates that appear when specific conditions are met. They are not part of any orchestrated flow.

**Is onboarding resumable?** Partially. Email verification and approval status persist, but signup form data does not. The NDA signing state persists at the firm level, so it is resumable.

**Is user progress persistent across sessions?** Only after signup is submitted. The signup form itself is ephemeral.

**Are onboarding actions triggering automation?** Yes, but inconsistently:
- Signup triggers `auto-create-firm-on-signup` and `enhanced-admin-notification` (via `Promise.allSettled` — non-blocking, silent failures)
- Admin approval triggers the `approve-marketplace-buyer` edge function
- NDA/fee signing triggers webhook processing and cascading updates
- But there is no event bus connecting these — each is a direct function call

### 2.4 Recommended: Ideal Onboarding State Machine

```
                                    ┌──────────────────┐
                                    │   SIGNUP_STARTED  │
                                    │  (form in progress)│
                                    └────────┬─────────┘
                                             │ submit
                                    ┌────────▼─────────┐
                                    │ EMAIL_UNVERIFIED  │
                                    │  (awaiting click)  │
                                    └────────┬─────────┘
                                             │ verify
                                    ┌────────▼─────────┐
                                    │  PENDING_REVIEW   │
                                    │  (admin queue)     │
                                    └────────┬─────────┘
                                        ┌────┴────┐
                                   approve     reject
                                   ┌────▼──┐ ┌──▼────┐
                                   │APPROVED│ │REJECTED│
                                   └───┬───┘ └───────┘
                                       │
                                  ┌────▼─────────┐
                                  │ NDA_PENDING   │
                                  │ (signing req.) │
                                  └────┬─────────┘
                                       │ sign
                                  ┌────▼─────────┐
                                  │ ONBOARDED     │
                                  │ (marketplace)  │
                                  └────┬─────────┘
                                       │ first connection request
                                  ┌────▼──────────────┐
                                  │ FEE_AGREEMENT_PENDING │
                                  └────┬──────────────┘
                                       │ sign
                                  ┌────▼─────────┐
                                  │ FULLY_ACTIVE  │
                                  │ (deal-ready)   │
                                  └──────────────┘
```

**Required implementation:**
- Add `onboarding_stage` ENUM column to `profiles` table
- Create `onboarding_events` table to log all transitions with timestamps
- Replace conditional UI logic with state-driven rendering
- Add database trigger to advance stage on qualifying events

---

## 3. Educational Content System

### 3.1 Current State

Education is delivered through **two mechanisms only**:

1. **OnboardingPopup** (`src/components/onboarding/OnboardingPopup.tsx`): A 4-step modal shown after first login with static content:
   - Step 1: "Two Types of Deals" (For Sale vs. Off Market)
   - Step 2: "How We Source Deals" (direct-to-owner positioning)
   - Step 3: "You Only Pay if a Deal Closes" (fee structure education)
   - Step 4: "How to Get Selected" (connection request tips)

2. **Inline education cards** in `FeeAgreementGate.tsx` (lines 114-141): Three cards explaining what a fee agreement is, what the buyer is agreeing to, and why it's required before the first request.

3. **NDA education cards** in `PendingApproval.tsx` (lines 367-379): Two cards on the pending approval page explaining NDA requirements.

### 3.2 Assessment

| Criterion | Current State | Gap |
|-----------|--------------|-----|
| Adapts to user type? | No. Same content for PE firms and individual investors | Critical |
| Influences onboarding progression? | No. Popup can be dismissed at any step | Significant |
| Completion tracked? | Only boolean (`onboarding_completed`) | Significant |
| AI-personalized? | No | Major gap for scale |
| Content gating before agreements? | Partial — education cards appear before signing forms | Acceptable |
| Connected to conversion metrics? | No analytics integration found | Critical |
| Dynamic learning paths? | No. 100% static content | Major gap |

### 3.3 Specific Issues

1. **Education is skippable.** The OnboardingPopup's close button (X) calls `handleClose()` which marks onboarding as complete even if the user is on Step 1. There is no minimum engagement requirement. (`OnboardingPopup.tsx:19-91`)

2. **No buyer-type-specific content.** A PE fund manager with $500M AUM sees the same "Two Types of Deals" popup as a first-time individual investor. The educational needs are fundamentally different.

3. **No measurement of understanding.** The system cannot distinguish between a user who read all 4 steps and a user who clicked "Next" 4 times in 3 seconds. There is no quiz, acknowledgment, or engagement tracking.

4. **Education disconnected from qualification.** The educational content does not inform deal scoring, buyer qualification, or connection request approval probability. It's a dead end in the data pipeline.

### 3.4 Recommended: Educational Delivery Architecture

**Phase 1 — Track engagement:**
- Log time spent on each education step
- Track whether user scrolled to bottom of content
- Store education completion metadata (not just boolean)

**Phase 2 — Buyer-type adaptation:**
- Create content variants per buyer type (8 types = 8 content tracks)
- Gate NDA signing behind education completion for new user types
- Add "understanding check" questions before agreement signing

**Phase 3 — AI-driven education:**
- Use buyer profile data to generate personalized onboarding content
- Adapt deal explanation complexity based on buyer sophistication signals
- Create dynamic FAQ based on buyer type and deal criteria

---

## 4. Process Orchestration

### 4.1 Current Architecture: No Orchestration Layer

The platform has **no workflow engine**. Process flow is controlled by:

1. **React Router + ProtectedRoute** — client-side gating
2. **Edge functions** — server-side actions triggered by API calls
3. **Database triggers** — reactive updates (e.g., `auto_link_user_to_firm`)
4. **React Query invalidation** — cache-based state propagation

There is no:
- Workflow definition language or DSL
- Step sequencing engine
- Conditional branching framework
- Retry/recovery mechanism for failed steps
- Timeout monitoring for stalled workflows
- Dashboard showing where users are stuck

### 4.2 Manual Handoffs Identified

| Handoff | From | To | Automation Level |
|---------|------|----|-----------------|
| User signup → admin review | Automated (email notification) | Manual (admin clicks approve) | Partially automated |
| Admin approval → NDA delivery | Automated (`auto-create-firm-on-signup` creates firm) | Semi-automated (NDA embed appears on pending page) | Mixed |
| NDA signed → marketplace access | Automated (webhook updates firm + profile) | Automated (ProtectedRoute redirects) | Fully automated |
| First connection request → fee agreement gate | Automated (FeeAgreementGate intercepts) | Manual (admin must create submission first via `get-buyer-fee-embed`) | **Broken — asymmetric** |
| Fee agreement signed → deal access | Automated (webhook cascades) | Automated (query invalidation) | Fully automated |

### 4.3 Critical Finding: NDA vs. Fee Agreement Asymmetry

**The NDA flow auto-creates DocuSeal submissions. The fee agreement flow does not.**

- `get-buyer-nda-embed/index.ts`: If no submission exists, it **automatically creates one** via the DocuSeal API (`POST https://api.docuseal.com/submissions`)
- `get-buyer-fee-embed/index.ts`: If no submission exists, it returns `{ noSubmission: true }` and the buyer sees an error: "Fee agreement signing form not available. Please contact support."

This means:
- **NDA signing is self-service.** Buyer can sign at any time once they have a firm.
- **Fee agreement signing requires admin intervention.** Admin must manually send the fee agreement via `SendAgreementDialog.tsx` before the buyer can sign.

This asymmetry creates a **hard conversion bottleneck** at the most critical moment — when a buyer is ready to make their first connection request. If the admin hasn't pre-sent the fee agreement, the buyer hits a wall.

### 4.4 Duplicate Workflows

1. **Firm creation happens in two places:**
   - `auto-create-firm-on-signup/index.ts` (at signup time)
   - `PendingApproval.tsx:30-48` (fallback if signup function failed)
   - Both use the same logic, but the PendingApproval fallback is a client-side retry — fragile and timing-dependent

2. **Agreement status is checked in multiple ways:**
   - `useMyAgreementStatus()` — RPC `get_my_agreement_status` (firm-level, domain-aware)
   - `useBuyerNdaStatus()` — Direct query to `firm_members` + `firm_agreements`
   - `profiles.nda_signed` / `profiles.fee_agreement_signed` — Legacy per-user booleans
   - All three can return different answers for the same user

3. **Onboarding completion is written in two places:**
   - `use-onboarding.ts:52-64` — writes to `profiles.onboarding_completed` via setTimeout
   - `OnboardingPopup.tsx:57-60` — writes to `profiles.onboarding_completed` directly
   - Both execute on close, creating a potential race condition

### 4.5 Recommended: Event-Driven Onboarding Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  ONBOARDING EVENT BUS                     │
│  (Supabase Realtime / pg_notify / edge function hooks)    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Events:                                                  │
│  ├── user.signup.completed                                │
│  ├── user.email.verified                                  │
│  ├── user.admin.approved / rejected                       │
│  ├── firm.created                                         │
│  ├── firm.member.linked                                   │
│  ├── document.nda.sent                                    │
│  ├── document.nda.signed / declined / expired             │
│  ├── document.fee_agreement.sent                          │
│  ├── document.fee_agreement.signed / declined / expired   │
│  ├── user.onboarding.education_completed                  │
│  ├── user.onboarding.fully_activated                      │
│  └── user.connection_request.first                        │
│                                                           │
│  Each event triggers:                                     │
│  ├── State machine transition                             │
│  ├── Analytics logging                                    │
│  ├── Notification dispatch                                │
│  └── Automation rules                                     │
└──────────────────────────────────────────────────────────┘
```

---

## 5. DocuSeal & Document Signing System

### 5.1 Document Lifecycle

```
Template (DocuSeal) → Submission Created (edge function) → Embed/Email Sent
    → Buyer Views → Buyer Signs → Webhook Received → firm_agreements Updated
    → profiles Cascaded → Notifications Sent → Permissions Unlocked
```

### 5.2 Architecture Assessment

**Strengths:**

1. **Idempotent webhook processing.** The `docuseal_webhook_log` table has a `UNIQUE(submission_id, event_type)` constraint, and the handler checks for existing logs before processing. Concurrent duplicate webhooks are handled gracefully via PostgreSQL's `23505` error code. (`docuseal-webhook-handler/index.ts:110-138`)

2. **Firm-level agreement inheritance.** The `get_my_agreement_status` RPC resolves domain matching and PE firm parent inheritance. A buyer whose firm already has a signed NDA gets automatic coverage. This is architecturally sound.

3. **Multi-channel signing.** Admin can send agreements via: email link, shareable URL, or in-app embedded signing (`SendAgreementDialog.tsx:158-198`). This is good flexibility.

4. **Webhook event coverage.** The handler processes: `form.completed`, `form.viewed`, `form.started`, `form.declined`, `form.expired` — covering the full DocuSeal lifecycle.

**Issues:**

### 5.3 Risk: Webhook Secret Verification is Permissive

The webhook handler logs a warning but **continues processing** when the secret header is missing:

```typescript
// docuseal-webhook-handler/index.ts:74-79
if (!valid) {
  console.warn("⚠️ No matching secret header found — processing with payload validation");
}
```

This means any POST request to the webhook endpoint with a valid-looking payload structure will be processed. The payload validation (`isValidDocuSealPayload`) only checks for the presence of `event_type` and `submission_id` — trivially spoofable. An attacker could forge a `form.completed` webhook to mark any firm's NDA as signed.

**Severity: HIGH**
**Recommendation:** Require webhook secret validation or implement HMAC signature verification. If DocuSeal's header-based auth is unreliable, add IP allowlisting for DocuSeal's webhook origin IPs.

### 5.4 Risk: No Retry Mechanism for Profile Cascades

When a document is signed, the webhook handler updates `firm_agreements` first, then iterates through `firm_members` to update individual `profiles`:

```typescript
// docuseal-webhook-handler/index.ts:295-310
for (const member of members) {
  await supabase
    .from("profiles")
    .update({ ...profileUpdates, updated_at: now })
    .eq("id", member.user_id);
}
```

If any individual profile update fails, the error is caught and logged (`⚠️ Profile sync error`) but not retried. This can leave the system in an inconsistent state where:
- `firm_agreements.nda_signed = true`
- `profiles.nda_signed = false` for some members

The user would then be blocked from accessing deal details despite their firm having a valid NDA.

**Severity: MEDIUM-HIGH**
**Recommendation:** Move profile cascading to a database trigger on `firm_agreements` updates, or implement a retry queue for failed cascades.

### 5.5 Risk: Document URL Validation is Too Trusting

The `isValidDocumentUrl` function accepts URLs from: `docuseal.com`, `docuseal.co`, `amazonaws.com`, `storage.googleapis.com`, `supabase.co`. The `amazonaws.com` and `storage.googleapis.com` wildcards are extremely broad — any S3 bucket or GCS bucket URL would pass validation.

**Severity: LOW-MEDIUM**
**Recommendation:** Restrict to specific S3 bucket paths or DocuSeal-specific subdomains.

### 5.6 Risk: Submission ID Lookup is Multi-Step with Fallback

The webhook handler tries three strategies to find the matching firm:
1. Match `nda_docuseal_submission_id`
2. Match `fee_docuseal_submission_id`
3. Fallback to `external_id`

If all three fail, the webhook is silently accepted with `{ success: true, note: "No matching firm" }`. This means legitimate webhooks can be silently dropped if the submission ID was never stored (e.g., due to a race condition during submission creation).

**Severity: MEDIUM**
**Recommendation:** Log unmatched webhooks to a dead letter queue for manual review.

### 5.7 Recommended: Ideal DocuSeal Orchestration Model

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  GENERATE    │────>│    SEND      │────>│    SIGN      │
│  (template   │     │  (embed or   │     │  (DocuSeal   │
│   + data)    │     │   email)     │     │   widget)    │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                          ┌──────▼───────┐
                                          │   VERIFY     │
                                          │  (webhook +  │
                                          │   HMAC)      │
                                          └──────┬───────┘
                                                 │
                                          ┌──────▼───────┐
                                          │  ACTIVATE    │
                                          │  (atomic DB  │
                                          │   txn)       │
                                          └──────────────┘
```

**Key changes:**
- VERIFY step must include cryptographic webhook verification
- ACTIVATE step must be an atomic database transaction (firm + all profiles + audit log)
- Dead letter queue for failed activations
- Monitoring dashboard for signing funnel drop-off

---

## 6. User Activation After Signing

### 6.1 Current Activation Logic

Activation is **implicit, not explicit**. There is no "activate user" function. Instead, the UI checks multiple conditions at render time:

**Marketplace access** (`ProtectedRoute.tsx:67`):
```typescript
if (requireApproved && user.approval_status !== 'approved' && user.is_admin !== true) {
  return <Navigate to="/pending-approval" replace />;
}
```

**Deal detail access** (`NdaGateModal` is shown inline when `!nda_covered`):
- Checked via `useMyAgreementStatus()` hook
- No server-side enforcement — the gate is **client-side only**

**Connection request access** (`FeeAgreementGate` intercepts when `!fee_covered`):
- Checked before connection request submission
- Again, client-side only

### 6.2 Critical Finding: No Server-Side Permission Enforcement for NDA/Fee Agreement

The NDA and fee agreement gates are **React components**, not API-level guards. The Supabase RLS policies on `listings` and `connection_requests` do not check `nda_signed` or `fee_agreement_signed`.

This means:
- A technically savvy user could bypass the NDA gate by calling the Supabase API directly
- Connection requests could be submitted without a fee agreement if the client-side check is bypassed

**Severity: HIGH**
**Recommendation:** Add RLS policies or edge function guards that enforce agreement status at the database/API level, not just in the UI.

### 6.3 Partial Activation States

Users can be in inconsistent activation states:

| Scenario | `profiles.nda_signed` | `firm_agreements.nda_signed` | Actual Access |
|----------|----------------------|-------------------------------|---------------|
| Firm signed, cascade succeeded | true | true | Correct |
| Firm signed, cascade failed | false | true | **Blocked** (profile check fails) |
| Profile manually set, firm not updated | true | false | **Incorrect access** |
| User switches firms | true (from old firm) | false (new firm) | **Ambiguous** |

### 6.4 Recommended: Zero-Manual-Intervention Activation Model

```sql
-- Database function: activate_user_after_signing()
-- Triggered by: firm_agreements UPDATE where nda_signed changes to true

CREATE OR REPLACE FUNCTION activate_user_after_signing()
RETURNS TRIGGER AS $$
BEGIN
  -- Atomically update ALL members of this firm
  UPDATE profiles
  SET nda_signed = NEW.nda_signed,
      nda_signed_at = NEW.nda_signed_at,
      onboarding_stage = 'onboarded',
      updated_at = NOW()
  WHERE id IN (
    SELECT user_id FROM firm_members WHERE firm_id = NEW.id AND user_id IS NOT NULL
  );

  -- Log activation event
  INSERT INTO onboarding_events (user_id, event_type, metadata, created_at)
  SELECT user_id, 'nda_signed', jsonb_build_object('firm_id', NEW.id), NOW()
  FROM firm_members WHERE firm_id = NEW.id AND user_id IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 7. Data Architecture Review

### 7.1 Where Onboarding Data Lives

| Data | Table/Location | Issue |
|------|---------------|-------|
| Signup form fields (70+) | `auth.users.raw_user_meta_data` → copied to `profiles` | Metadata blob, not validated at DB level |
| Email verification | `profiles.email_verified` | Synced from Supabase Auth |
| Approval status | `profiles.approval_status` | Enum: pending/approved/rejected |
| Onboarding popup | `profiles.onboarding_completed` + `localStorage` | Dual storage, no sync guarantee |
| Firm membership | `firm_members` | Links user → firm |
| NDA status | `firm_agreements.nda_signed` + `profiles.nda_signed` | Dual storage, cascade sync |
| Fee agreement status | `firm_agreements.fee_agreement_signed` + `profiles.fee_agreement_signed` | Dual storage, cascade sync |
| DocuSeal submissions | `firm_agreements.nda_docuseal_submission_id` | Stored on firm, not user |
| Webhook events | `docuseal_webhook_log` | Immutable audit log |
| Agreement audit | `agreement_audit_log` | Status change history |

### 7.2 Schema Consistency Issues

1. **Legacy boolean + expanded status columns.** The `firm_agreements` table has both `nda_signed` (boolean) and `nda_status` (enum: not_started/sent/redlined/under_review/signed/expired/declined). Both must be kept in sync. The webhook handler updates both, but manual admin updates via `useUpdateFirmNDA` only update the boolean.

2. **Company normalization is too aggressive.** The `normalize_company_name()` function removes ALL non-alphanumeric characters and common suffixes (LLC, Inc, Corp, Ltd). This means:
   - "A&B Solutions LLC" → "ab solutions"
   - "A/B Solutions Inc" → "ab solutions"
   - These are different companies that would be incorrectly merged.

3. **No versioning of agreements.** If a template changes in DocuSeal, there is no record of which template version a specific submission used. The `firm_agreements` table stores `nda_signed_at` but not `nda_template_version`.

4. **Profile table is a mega-table.** The `profiles` table has 100+ columns (all buyer-type-specific fields are in the same table). This creates:
   - Sparse data (PE-specific fields are NULL for individual investors)
   - Schema bloat (adding a new buyer type requires new columns)
   - Performance risk at scale (wide row reads for simple operations)

### 7.3 Missing Audit Trails

| Event | Audit Trail? | Gap |
|-------|-------------|-----|
| User signup | Supabase Auth logs | No structured onboarding event |
| Email verification | Supabase Auth callback | No timestamp stored |
| Admin approval | `marketplace_approval_queue.reviewed_at` | Adequate |
| NDA signing | `docuseal_webhook_log` + `agreement_audit_log` | Adequate |
| Fee agreement signing | `docuseal_webhook_log` + `agreement_audit_log` | Adequate |
| Onboarding popup viewed | **None** | No engagement tracking |
| Education content read | **None** | No analytics |
| User drops off signup | **None** | Critical gap for funnel analysis |

### 7.4 Recommended: Onboarding Data Model

```sql
-- Unified onboarding state
ALTER TABLE profiles ADD COLUMN onboarding_stage TEXT DEFAULT 'signup_started'
  CHECK (onboarding_stage IN (
    'signup_started', 'email_unverified', 'pending_review',
    'approved', 'nda_pending', 'onboarded',
    'fee_pending', 'fully_active', 'rejected'
  ));

-- Event sourcing for onboarding
CREATE TABLE onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  event_type TEXT NOT NULL,
  previous_stage TEXT,
  new_stage TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onboarding_events_user ON onboarding_events(user_id, created_at DESC);

-- Education engagement tracking
CREATE TABLE education_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'onboarding_step', 'nda_education', 'fee_education'
  time_spent_seconds INTEGER,
  scrolled_to_bottom BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Conversion & Friction Analysis

### 8.1 Top Conversion Killers (Ranked by Severity)

#### 1. Signup Form Data Loss (CRITICAL)
**Impact:** Unknown — no dropout analytics exist
**Problem:** 5-step signup form with 70+ fields stores all data in React state. Browser close, back button, page refresh = complete data loss. For buyer types with extensive fields (PE: ~15 fields, Independent Sponsor: ~12 fields), this is 5-10 minutes of lost work.
**Fix:** Persist form state to `sessionStorage` or a `signup_drafts` table. Auto-save on every field change.

#### 2. Fee Agreement Admin Dependency (HIGH)
**Impact:** Blocks every first connection request until admin acts
**Problem:** The NDA auto-creates DocuSeal submissions, but the fee agreement requires admin to manually send it first. A buyer motivated to make a connection request hits "Fee agreement signing form not available. Please contact support." This is the highest-intent moment in the funnel — and the system kills it.
**Fix:** Auto-create fee agreement submissions the same way NDAs are auto-created. Mirror the `get-buyer-nda-embed` pattern in `get-buyer-fee-embed`.

#### 3. Admin Approval Bottleneck (HIGH)
**Impact:** All buyers blocked until human reviews
**Problem:** Every signup requires manual admin approval. The system polls every 30 seconds (`PendingApproval.tsx:84`), but the actual review happens "within one business day." For a platform targeting thousands of buyers, this creates a 24-hour minimum activation delay.
**Fix:** Implement auto-approval rules based on buyer type, company domain, LinkedIn verification, and enrichment data. Reserve manual review for edge cases.

#### 4. Education Popup is Dismissible Without Engagement (MEDIUM)
**Impact:** Users skip critical context about platform mechanics
**Problem:** Clicking the X button on Step 1 marks onboarding as complete. Users who skip the education may not understand the deal types, fee structure, or connection request process — leading to low-quality requests and poor conversion.
**Fix:** Require completion of all 4 steps before marking as complete. Track engagement time per step.

#### 5. No Progress Indicators During Waiting States (MEDIUM)
**Impact:** User anxiety and support requests
**Problem:** After signup, the user is on the PendingApproval page with no real-time progress. The "Check Approval Status" button does a full profile refresh but shows "Your account status has been refreshed" even when nothing changed.
**Fix:** Implement Supabase Realtime subscription for approval status changes. Show estimated wait time based on historical approval velocity.

#### 6. Signup Step 3 is Skippable (LOW-MEDIUM)
**Impact:** Missing referral attribution data
**Problem:** Step 3 ("How did you hear about us?") has an explicit "Skip this step" button. Referral source data is critical for acquisition analytics but is treated as optional.
**Fix:** Make referral source required. Remove skip button. The other sub-questions (deal sourcing methods, acquisition volume) can remain optional.

### 8.2 Cognitive Overload Points

1. **Step 5 (Buyer Profile):** Dynamic fields based on buyer type. Some buyer types require 12-15 fields with domain-specific terminology (e.g., "Committed Equity Band," "AUM," "EBITDA flexibility"). No contextual help or tooltips found in the code.

2. **NDA + Fee Agreement double-signing:** Buyers must sign two separate documents at different points in the funnel. The NDA is presented during the waiting state (pending approval), while the fee agreement appears at first connection request. The separation is confusing — many buyers likely expect to sign everything once.

3. **Pending Approval page information density:** The page shows: submitted info summary, application progress timeline, NDA education cards, NDA signing form, estimated review time, check status button, and logout button. For a single-purpose "wait" page, this is excessive.

---

## 9. Technical Debt Assessment

### Ranked by Severity

| # | Issue | Severity | Impact | Location |
|---|-------|----------|--------|----------|
| 1 | **No server-side NDA/fee enforcement** — client-side gates only | CRITICAL | Security: unsigned users can access deal data via API | `NdaGateModal.tsx`, RLS policies |
| 2 | **Webhook secret verification is permissive** — accepts unverified payloads | HIGH | Security: spoofed webhooks can mark agreements as signed | `docuseal-webhook-handler/index.ts:74-79` |
| 3 | **Fee agreement requires admin manual intervention** — asymmetric with NDA flow | HIGH | Conversion: blocks highest-intent users at critical moment | `get-buyer-fee-embed/index.ts` |
| 4 | **No signup form persistence** — 70+ fields lost on page close | HIGH | Conversion: unknown dropout rate at signup | `Signup/index.tsx:28` |
| 5 | **Dual storage for agreement status** — profiles vs firm_agreements | MEDIUM-HIGH | Data integrity: inconsistent states possible after cascade failures | `docuseal-webhook-handler/index.ts:293-310` |
| 6 | **localStorage as source of truth for onboarding** — device-bound, clearable | MEDIUM | UX: popup reappears on new devices; completion not reliably tracked | `use-onboarding.ts:21-33` |
| 7 | **Company normalization too aggressive** — unrelated companies merged | MEDIUM | Data integrity: wrong firm memberships, inherited agreements | `normalize_company_name()` SQL function |
| 8 | **No onboarding funnel analytics** — zero dropout tracking | MEDIUM | Business: cannot measure or optimize conversion | No instrumentation found |
| 9 | **Profile table is a mega-table** — 100+ columns, sparse data | MEDIUM | Performance/maintenance: wide rows, schema complexity | `profiles` table |
| 10 | **Two onboarding completion write paths** — race condition possible | LOW-MEDIUM | Data integrity: minor, but architecturally messy | `use-onboarding.ts` vs `OnboardingPopup.tsx` |
| 11 | **No agreement template versioning** — signed docs not linked to template versions | LOW-MEDIUM | Compliance: can't prove which version was signed | `firm_agreements` schema |
| 12 | **Firm creation in two places** — signup edge function + PendingApproval fallback | LOW | Maintenance: duplicated logic, divergence risk | Two separate code paths |

---

## 10. Future-State Design

### 10.1 Target Architecture: AI-Native Onboarding Engine

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI ONBOARDING ORCHESTRATOR                    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ State Machine │  │ Event Bus    │  │ AI Qualification     │   │
│  │ Engine        │  │ (pg_notify/  │  │ Engine               │   │
│  │               │  │  Realtime)   │  │                      │   │
│  │ States:       │  │              │  │ - Auto-approve rules │   │
│  │ - signup      │  │ Events:      │  │ - Buyer scoring      │   │
│  │ - verify      │  │ - user.*     │  │ - Risk assessment    │   │
│  │ - review      │  │ - doc.*      │  │ - Education adapt.   │   │
│  │ - nda         │  │ - firm.*     │  │ - Deal matching      │   │
│  │ - active      │  │ - onboard.*  │  │                      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                  │                      │               │
│  ┌──────▼──────────────────▼──────────────────────▼───────────┐  │
│  │                 UNIFIED DATA LAYER                          │  │
│  │  profiles.onboarding_stage (single source of truth)         │  │
│  │  onboarding_events (event log)                              │  │
│  │  education_engagement (learning analytics)                  │  │
│  │  firm_agreements (document lifecycle)                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 DOCUMENT ORCHESTRATOR                      │    │
│  │  DocuSeal Integration Layer                                │    │
│  │  - Auto-create submissions for BOTH NDA + fee agreement    │    │
│  │  - HMAC webhook verification                               │    │
│  │  - Atomic activation (DB trigger, not cascade loop)        │    │
│  │  - Template version tracking                               │    │
│  │  - Dead letter queue for failed webhooks                   │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Required Core Services

1. **Onboarding State Service** — Single source of truth for user stage, powered by `profiles.onboarding_stage` column and `onboarding_events` table
2. **Document Lifecycle Service** — Unified DocuSeal orchestration for both NDA and fee agreements, with symmetric auto-create behavior
3. **AI Qualification Engine** — Auto-approval rules based on buyer profile enrichment, company verification, and risk scoring
4. **Education Personalization Service** — Dynamic content delivery based on buyer type, engagement history, and platform behavior
5. **Event Bus** — Postgres-native (`pg_notify` + Supabase Realtime) event propagation for cross-cutting concerns

### 10.3 AI Onboarding Agent Design

```
AI Onboarding Agent:
├── Input: Buyer signup data + enrichment data + platform behavior
├── Decision Engine:
│   ├── Auto-approve if: verified company domain + LinkedIn + known PE firm
│   ├── Fast-track if: referral from existing buyer + complete profile
│   ├── Manual review if: personal email + no company + no LinkedIn
│   └── Reject if: known spam patterns + disposable email + blocklisted domain
├── Education Engine:
│   ├── PE/Corp: "Advanced deal evaluation framework"
│   ├── Individual: "M&A basics + how to write compelling connection requests"
│   ├── Search Fund: "Working with SourceCo as your deal flow partner"
│   └── Advisor: "Representing clients on the platform"
├── Document Engine:
│   ├── Pre-populate NDA + fee agreement with buyer/firm data
│   ├── Auto-send both documents in parallel after approval
│   └── Follow up if unsigned after 48h / 7d / 14d
└── Output: Fully activated buyer with personalized deal recommendations
```

---

## 11. Implementation Roadmap

### Phase 1 — Stabilize Onboarding (0-60 days)

**Priority: Fix conversion killers and security gaps**

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1.1 | Add RLS policies enforcing NDA/fee agreement status on listings and connection_requests | 2-3 days | Security: closes client-side-only gate bypass |
| 1.2 | Make fee agreement auto-create match NDA pattern in `get-buyer-fee-embed` | 1-2 days | Conversion: removes admin bottleneck at highest-intent moment |
| 1.3 | Persist signup form data to sessionStorage | 1 day | Conversion: prevents data loss on page close |
| 1.4 | Require webhook secret verification (fail closed, not open) | 1 day | Security: prevents webhook spoofing |
| 1.5 | Add `onboarding_stage` column to profiles table | 1 day | Foundation: single source of truth for user state |
| 1.6 | Remove localStorage as source of truth for onboarding popup | 0.5 days | Data integrity: database is sole authority |
| 1.7 | Add basic funnel analytics (signup started, step completed, dropped off) | 2-3 days | Business: enables conversion measurement |
| 1.8 | Move profile cascade to database trigger (atomic) | 2-3 days | Data integrity: eliminates inconsistent agreement states |

**Total Phase 1 estimate:** 10-15 days of engineering effort

### Phase 2 — Automation (60-180 days)

**Priority: Remove human dependencies and add orchestration**

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 2.1 | Build auto-approval engine (rules-based: domain, LinkedIn, buyer type) | 1-2 weeks | Conversion: removes 24h+ approval delay for qualified buyers |
| 2.2 | Create onboarding event bus (`onboarding_events` table + pg_notify triggers) | 1 week | Architecture: enables event-driven automation |
| 2.3 | Build education engagement tracking | 3-5 days | Analytics: measures content effectiveness |
| 2.4 | Create buyer-type-specific education content tracks | 1-2 weeks | Conversion: relevant content increases completion |
| 2.5 | Implement dead letter queue for failed webhooks/cascades | 3-5 days | Reliability: no more silently dropped events |
| 2.6 | Add agreement template versioning | 2-3 days | Compliance: audit trail for signed template versions |
| 2.7 | Build admin onboarding dashboard (funnel visualization, drop-off points) | 1-2 weeks | Business: real-time visibility into onboarding health |
| 2.8 | Consolidate dual-storage pattern (profiles vs firm_agreements) | 1 week | Maintenance: single source of truth for agreement status |

**Total Phase 2 estimate:** 6-10 weeks of engineering effort

### Phase 3 — AI-Native Onboarding (6-12 months)

**Priority: Self-driving onboarding that scales to thousands**

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 3.1 | AI qualification engine — auto-approve, fast-track, or flag | 3-4 weeks | Scale: removes human bottleneck entirely for 80%+ of signups |
| 3.2 | AI-personalized education content per buyer type and profile | 2-3 weeks | Conversion: tailored onboarding increases activation rate |
| 3.3 | Predictive drop-off intervention (email/SMS at risk moments) | 2-3 weeks | Conversion: proactive recovery of abandoning users |
| 3.4 | Document signing follow-up automation (48h, 7d, 14d cadence) | 1-2 weeks | Conversion: reduces unsigned agreement backlog |
| 3.5 | Continuous qualification engine (post-onboarding scoring updates) | 3-4 weeks | Platform: onboarding becomes ongoing, not one-time |
| 3.6 | Normalize profiles table into buyer-type-specific JSONB or sub-tables | 2-3 weeks | Performance: eliminates 100+ column mega-table |
| 3.7 | Full state machine with visual workflow builder for admins | 4-6 weeks | Operations: non-engineers can modify onboarding flow |

**Total Phase 3 estimate:** 4-6 months of engineering effort

---

## Appendix A: File Reference Index

| File | Purpose | Key Findings |
|------|---------|-------------|
| `src/pages/Signup/index.tsx` | 5-step signup form controller | No state persistence; step 3 skippable |
| `src/pages/Signup/types.ts` | Form data types + step definitions | 70+ fields; 8 buyer types |
| `src/pages/Signup/useSignupSubmit.ts` | Signup submission handler | Fires admin notification + firm creation in parallel |
| `src/pages/PendingApproval.tsx` | Post-signup waiting room | NDA signing embedded; 30s poll for approval |
| `src/hooks/use-onboarding.ts` | Onboarding popup state | localStorage as source of truth |
| `src/components/onboarding/OnboardingPopup.tsx` | 4-step education popup | Dismissible at any step; static content |
| `src/components/docuseal/DocuSealSigningPanel.tsx` | Reusable DocuSeal embed wrapper | Clean component; loading/error/success states |
| `src/components/docuseal/NdaGateModal.tsx` | NDA signing gate for deal details | Client-side only; auto-creates submission |
| `src/components/docuseal/FeeAgreementGate.tsx` | Fee agreement gate for connection requests | Requires admin pre-send; no auto-create |
| `src/components/docuseal/SendAgreementDialog.tsx` | Admin agreement sending dialog | 3 delivery modes: email, link, embedded |
| `src/components/ProtectedRoute.tsx` | Route-level access control | Checks approval_status; MFA for admin |
| `src/hooks/use-agreement-status.ts` | Buyer agreement status (firm-level) | Uses RPC with domain/PE inheritance |
| `src/hooks/admin/use-docuseal.ts` | Admin DocuSeal management hooks | Parameter mismatch in useAutoCreateFirmOnApproval |
| `src/hooks/admin/use-firm-agreements.ts` | Admin firm management hooks | Comprehensive; audit log support |
| `src/context/AuthContext.tsx` | Auth provider wrapper | Delegates to useNuclearAuth |
| `src/hooks/use-nuclear-auth.ts` | Core auth state management | Self-healing profiles; journey linking |
| `supabase/functions/docuseal-webhook-handler/index.ts` | DocuSeal webhook processor | Idempotent; permissive secret verification |
| `supabase/functions/get-buyer-nda-embed/index.ts` | Buyer NDA embed endpoint | Auto-creates submissions |
| `supabase/functions/get-buyer-fee-embed/index.ts` | Buyer fee agreement embed endpoint | Does NOT auto-create; requires admin |
| `supabase/functions/auto-create-firm-on-signup/index.ts` | Firm creation at signup | Domain/name matching; idempotent |
| `supabase/functions/approve-marketplace-buyer/index.ts` | Admin buyer approval | Atomic claim; tracked link creation |

---

## Appendix B: Onboarding Data Flow Diagram

```
SIGNUP                    VERIFICATION              APPROVAL
─────────────────────     ─────────────────────     ─────────────────────
│ Signup Form (5 steps)│   │ Email Link Clicked  │   │ Admin Reviews      │
│ ↓                    │   │ ↓                   │   │ ↓                  │
│ Supabase Auth signUp │   │ /auth/callback      │   │ approve-marketplace│
│ ↓                    │   │ ↓                   │   │ -buyer edge fn     │
│ Profile created      │   │ email_verified=true  │   │ ↓                  │
│ (DB trigger)         │   │ ↓                   │   │ approval_status=   │
│ ↓                    │   │ Redirect to         │   │ 'approved'         │
│ auto-create-firm-on- │   │ /pending-approval   │   │ ↓                  │
│ signup (edge fn)     │   │                     │   │ Tracked link email │
│ ↓                    │   │                     │   │ sent to buyer      │
│ Redirect to          │   │                     │   │                    │
│ /signup-success      │   │                     │   │                    │
└──────────────────────┘   └─────────────────────┘   └────────────────────┘
                                     │
                                     ▼
NDA SIGNING                          FEE AGREEMENT              FULL ACTIVATION
─────────────────────────            ─────────────────────────   ──────────────────
│ PendingApproval page   │           │ First connection request│  │ Both docs signed│
│ OR NdaGateModal        │           │ ↓                       │  │ ↓               │
│ ↓                      │           │ FeeAgreementGate shown  │  │ Browse deals    │
│ get-buyer-nda-embed    │           │ ↓                       │  │ View details    │
│ (auto-creates sub)     │           │ get-buyer-fee-embed     │  │ Send requests   │
│ ↓                      │           │ (NO auto-create ⚠️)     │  │ Full messaging  │
│ DocuSeal embed shown   │           │ ↓                       │  │ Data room access│
│ ↓                      │           │ DocuSeal embed shown    │  │                 │
│ Buyer signs            │           │ ↓                       │  │                 │
│ ↓                      │           │ Buyer signs             │  │                 │
│ Webhook → firm_        │           │ ↓                       │  │                 │
│ agreements updated     │           │ Webhook → firm_         │  │                 │
│ ↓                      │           │ agreements updated      │  │                 │
│ Profile cascade        │           │ ↓                       │  │                 │
│ (loop, not atomic ⚠️)  │           │ Profile cascade         │  │                 │
│ ↓                      │           │ (loop, not atomic ⚠️)    │  │                 │
│ Marketplace access     │           │ Connection request      │  │                 │
│ unlocked               │           │ unlocked                │  │                 │
└────────────────────────┘           └─────────────────────────┘  └─────────────────┘
```

---

*This audit was conducted through static analysis of the SourceCo Marketplace codebase including all frontend components, backend edge functions, database migrations, and integration code. Findings reflect the state of the codebase as of 2026-02-23.*
