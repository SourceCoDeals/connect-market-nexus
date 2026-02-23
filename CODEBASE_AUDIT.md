# SourceCo Connect — Comprehensive Codebase & Onboarding Audit

**Date:** 2026-02-23
**Scope:** Full-stack architecture audit — frontend, edge functions, database, onboarding workflow, document signing (DocuSeal), and conversion/friction analysis.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Onboarding Workflow Audit](#2-onboarding-workflow-audit)
3. [Document Signing System (DocuSeal)](#3-document-signing-system-docuseal)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Data Architecture](#5-data-architecture)
6. [Edge Functions Inventory](#6-edge-functions-inventory)
7. [Conversion & Friction Analysis](#7-conversion--friction-analysis)
8. [Educational Content System](#8-educational-content-system)
9. [Technical Debt & Risk Assessment](#9-technical-debt--risk-assessment)
10. [Future-State Architecture Recommendations](#10-future-state-architecture-recommendations)

---

## 1. Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, TailwindCSS, shadcn/ui |
| State Management | TanStack React Query (v5) + React Context |
| Routing | React Router v6 (nested routes) |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Storage, RLS) |
| Edge Functions | Deno (Supabase Edge Functions) — ~120+ functions |
| Document Signing | DocuSeal (API + embedded signing + webhooks) |
| Email | Brevo (Sendinblue) via `brevo-sender.ts` shared module |
| Analytics | Custom session tracking, Mapbox geo, Fireflies transcripts |
| AI/ML | OpenAI (enrichment, scoring, transcript extraction) |

### Project Structure

```
src/
├── App.tsx              — Root router (335 lines, ~50 routes)
├── main.tsx             — Entry point with providers
├── pages/               — ~70+ page components
│   ├── Signup/          — 5-step wizard (Account, Personal, Referral, BuyerType, BuyerProfile)
│   ├── PendingApproval  — NDA signing + status tracking
│   ├── Marketplace      — Buyer-facing deal listings
│   ├── ListingDetail    — Deal detail with NDA gate
│   ├── Profile/         — Buyer profile with documents tab
│   └── admin/           — 30+ admin pages (dashboard, deals, buyers, pipeline, etc.)
├── components/          — ~100+ shared components
│   ├── docuseal/        — NdaGateModal, FeeAgreementGate, DocuSealSigningPanel
│   ├── admin/           — Admin UI components
│   ├── auth/            — AuthFlowManager, MFAChallenge, ReferralSourceStep
│   └── layout/          — AuthLayout, MainLayout
├── hooks/               — ~80+ custom hooks
│   ├── use-onboarding   — Post-approval educational onboarding
│   ├── use-nuclear-auth — Core auth state management
│   ├── admin/           — Admin-specific hooks (docuseal, users, deals, etc.)
│   └── security/        — Password security, session monitoring
├── context/             — Auth, Analytics, TabVisibility, NavigationState
├── types/               — TypeScript type definitions
├── integrations/        — Supabase client configuration
├── lib/                 — Utility libraries (auth-helpers, error-handler, url-utils)
└── config/              — App config, role permissions

supabase/
├── functions/           — ~120+ Deno edge functions
│   ├── _shared/         — Shared modules (cors, auth, brevo-sender)
│   ├── auto-create-firm-on-signup/
│   ├── auto-create-firm-on-approval/
│   ├── get-buyer-nda-embed/
│   ├── get-buyer-fee-embed/
│   ├── docuseal-webhook-handler/
│   ├── approve-marketplace-buyer/
│   ├── create-docuseal-submission/
│   ├── send-approval-email/
│   └── ... (enrichment, scoring, AI, notifications, etc.)
└── migrations/          — 630+ SQL migrations
```

### Provider Hierarchy

```
QueryClientProvider
  └─ TabVisibilityProvider
      └─ NavigationStateProvider
          └─ AuthProvider (useNuclearAuth)
              └─ SessionTrackingProvider
                  └─ AnalyticsProvider
                      └─ SimpleToastProvider
                          └─ Routes
```

### Route Architecture

**Public routes:** `/welcome`, `/login`, `/signup`, `/signup-success`, `/pending-approval`, `/forgot-password`, `/reset-password`, `/sell`, `/referrals/:shareToken`, `/dataroom/:accessToken`, `/view/:linkToken`

**Buyer-facing (authenticated + approved):**
- `/` — Marketplace (listings grid)
- `/listing/:id` — Deal detail (NDA-gated)
- `/my-deals` — Connection requests
- `/messages` — Buyer messaging
- `/saved-listings` — Saved deals
- `/profile` — Profile + Documents

**Admin (authenticated + `is_admin`):**
- `/admin` — Dashboard
- `/admin/deals` — All deals (unified view)
- `/admin/buyers` — Buyer management
- `/admin/marketplace/*` — Listings, requests, messages, users
- `/admin/remarketing/*` — Deal sourcing, matching, introductions
- `/admin/ma-intelligence/*` — M&A intelligence (trackers, buyers, deals)
- `/admin/analytics/*` — Analytics dashboards
- `/admin/settings/*` — Team, notifications, webhooks, security
- `/admin/approvals` — Global approvals page

---

## 2. Onboarding Workflow Audit

### Complete Buyer Journey (10 Steps)

```
┌─────────────────────────────────────────────────────────────────┐
│                     BUYER ONBOARDING FUNNEL                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. /welcome ─── Persona Selection (Buy / Sell)                  │
│       │                                                          │
│  2. /signup ─── 5-Step Wizard                                    │
│       ├── Step 0: Account (email, password)                      │
│       ├── Step 1: Personal Details (name, company, LinkedIn)     │
│       ├── Step 2: Referral Source (skippable)                    │
│       ├── Step 3: Buyer Type (8 options)                         │
│       └── Step 4: Buyer Profile (dynamic by buyer type)          │
│       │                                                          │
│  3. /signup-success ─── Check Email Prompt                       │
│       │                                                          │
│  4. Email Verification ─── Click link in email                   │
│       │                                                          │
│  5. /pending-approval ─── Three UI states:                       │
│       ├── email_not_verified: Resend verification email           │
│       ├── approved_pending: Review status + NDA signing panel     │
│       └── rejected: Application denied message                    │
│       │                                                          │
│  6. NDA Signing (on /pending-approval) ─── DocuSeal embed        │
│       │  Auto-creates firm via auto-create-firm-on-signup         │
│       │  Fallback re-invokes if firm missing                      │
│       │                                                          │
│  7. Admin Approval ─── Manual review by admin team               │
│       │  Triggered via admin panel (AdminUsers / GlobalApprovals) │
│       │  Calls approve functions + sends approval email            │
│       │                                                          │
│  8. / (Marketplace) ─── Full deal browsing access                │
│       │                                                          │
│  9. /listing/:id ─── NDA Gate Modal (if NDA unsigned)            │
│       │  Full-screen modal blocking deal detail access             │
│       │  Cannot be dismissed without signing                      │
│       │                                                          │
│  10. Connection Request ─── Fee Agreement Gate                    │
│       │  Intercepts "Request Introduction" if fee unsigned        │
│       │  Sign once → covers all future deals                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Signup Wizard Detail (`src/pages/Signup/`)

**5 steps** defined in `types.ts:STEPS`:

| Step | Component | Fields | Validation |
|------|-----------|--------|------------|
| 0 — Account | `SignupStepAccount` | email, password, confirmPassword | Email format, password strength, match |
| 1 — Personal | `SignupStepPersonal` | firstName, lastName, company, website, linkedinProfile, phoneNumber, jobTitle | Required: first/last name |
| 2 — Referral | `ReferralSourceStep` | referralSource, referralSourceDetail, dealSourcingMethods, targetAcquisitionVolume | **Skippable** (explicit skip button) |
| 3 — Buyer Type | `SignupStepBuyerType` | buyerType (8 options) | Required selection |
| 4 — Buyer Profile | `SignupStepBuyerProfile` | Dynamic fields based on buyer type (deal size, revenue, fund info, etc.) | Buyer-type-specific |

**Buyer Type Options:** corporate, privateEquity, familyOffice, searchFund, individual, independentSponsor, advisor, businessOwner

**Submission flow** (`useSignupSubmit.ts`):
1. Maps form data to `Partial<User>` with URL processing and currency parsing
2. Calls `auth.signup(signupData, password)` which creates Supabase auth user + profile
3. On success, navigates to `/signup-success?email=...`

### PendingApproval Page (`src/pages/PendingApproval.tsx`)

This is the critical holding page between signup and marketplace access. It handles three states:

**State 1: Email Not Verified**
- Shows verification email prompt with resend button
- Progress timeline: Account Created ✓, Email Verification (pending), Admin Approval (greyed)

**State 2: Email Verified, Approval Pending**
- Shows application review status
- Submitted information summary
- Estimated review timeline (1 business day)
- **NDA signing section** (DocuSeal embed inline)
- 30-second auto-poll for approval status changes

**State 3: Rejected**
- Application denied message with next steps

**Key behaviors:**
- Auto-polls `refreshUserProfile()` every 30 seconds
- **Fallback firm creation**: If `auto-create-firm-on-signup` failed at signup time, re-invokes it when `ndaStatus?.hasFirm` is false
- Navigation logic: When approved AND (NDA signed OR no firm/NDA status), redirects to `/`
- If approved but NDA unsigned, **stays on page** for NDA signing

### Firm & NDA Creation Pipeline

```
Signup → auto-create-firm-on-signup (edge function)
  │
  ├── Checks existing firm_members for user
  ├── Looks up firm_agreements by email domain
  ├── Looks up firm_agreements by normalized company name
  ├── Creates new firm_agreements record if none found
  └── Creates firm_members link (user → firm)

PendingApproval page renders → fetches NDA status
  │
  ├── useBuyerNdaStatus(userId)
  │     ├── Queries firm_members for user's firm
  │     └── Queries firm_agreements for NDA signing state
  │
  ├── If hasFirm && !ndaSigned → fetches embed via get-buyer-nda-embed
  │     ├── Authenticates buyer (JWT)
  │     ├── If existing submission → fetches embed_src from DocuSeal API
  │     ├── If no submission → creates new DocuSeal submission
  │     └── Updates firm_agreements with submission ID
  │
  └── Renders DocuSealSigningPanel with embed_src
        └── On completion → sets ndaSigned = true (local state)
```

### Post-Approval Onboarding (`src/hooks/use-onboarding.ts`)

A **lightweight educational overlay** (not a blocking gate) that shows after approval:
- Checks `localStorage` (`onboarding_completed`) and `profiles.onboarding_completed`
- Only shows if: `authChecked && user && email_verified && approval_status === 'approved' && !completed`
- `completeOnboarding()`: Writes localStorage immediately, updates DB in background (fire-and-forget)
- This is the marketplace tutorial/welcome content, NOT the NDA/approval flow

---

## 3. Document Signing System (DocuSeal)

### Architecture

DocuSeal handles two document types:
1. **NDA (Non-Disclosure Agreement)** — Required to view deal details
2. **Fee Agreement** — Required to submit connection requests

### Document Flow

```
┌──────────────────────────────────────────────────────────────┐
│                  DOCUSEAL SIGNING LIFECYCLE                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  CREATION (3 paths):                                          │
│  ├── Buyer self-serve: get-buyer-nda-embed / get-buyer-fee-embed
│  ├── Admin-initiated: create-docuseal-submission              │
│  └── Auto on approval: auto-create-firm-on-approval           │
│                                                               │
│  SIGNING:                                                     │
│  ├── Embedded: DocuSealSigningPanel (iframe in app)           │
│  └── Email: DocuSeal sends signing link via email              │
│                                                               │
│  WEBHOOK PROCESSING (docuseal-webhook-handler):               │
│  ├── form.completed → nda_signed=true, profiles sync           │
│  ├── form.viewed → status tracking                             │
│  ├── form.started → status tracking                            │
│  ├── form.declined → nda_signed=false, admin notification      │
│  ├── form.expired → nda_signed=false, admin notification       │
│  └── submission.created/archived → logged, no status update    │
│                                                               │
│  SELF-HEALING:                                                │
│  └── get-buyer-fee-embed: if DocuSeal says completed but DB   │
│      doesn't reflect it, syncs DB state (missed webhook fix)   │
│                                                               │
│  GATES (frontend):                                             │
│  ├── NdaGateModal — blocks /listing/:id if NDA unsigned       │
│  └── FeeAgreementGate — blocks connection request if unsigned  │
│                                                               │
│  IDEMPOTENCY:                                                 │
│  └── docuseal_webhook_log: unique(submission_id, event_type)   │
│      Prevents duplicate webhook processing                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Key Edge Functions

**`get-buyer-nda-embed`** (`supabase/functions/get-buyer-nda-embed/index.ts`):
- Authenticates buyer via JWT
- Checks firm_members → firm_agreements for NDA status
- If signed, returns `{ ndaSigned: true }`
- If existing submission, fetches embed_src from DocuSeal API (with fallbacks: embed_src → individual fetch → slug URL)
- If no submission, creates new one via DocuSeal API
- Updates firm_agreements and logs to docuseal_webhook_log

**`get-buyer-fee-embed`** (`supabase/functions/get-buyer-fee-embed/index.ts`):
- Same pattern as NDA embed but for fee agreements
- **Self-healing**: If DocuSeal reports completed but DB says unsigned, auto-syncs DB state and profile for all firm members

**`docuseal-webhook-handler`** (`supabase/functions/docuseal-webhook-handler/index.ts`):
- Processes DocuSeal webhook events
- Verifies webhook secret via custom headers (non-HMAC)
- Idempotency via docuseal_webhook_log unique constraint
- Updates firm_agreements with docuseal status AND expanded status fields
- On completion: syncs to profiles for all firm members, creates admin notifications, sends buyer notification with signed doc link, inserts system messages into active connection request threads
- Lifecycle events (submission.created/archived) are logged but skip status updates to prevent race conditions

**`create-docuseal-submission`** (`supabase/functions/create-docuseal-submission/index.ts`):
- Admin-initiated submission creation
- Supports both NDA and fee_agreement types
- Supports email delivery or embedded signing

**`auto-create-firm-on-signup`** (`supabase/functions/auto-create-firm-on-signup/index.ts`):
- Creates firm_agreements + firm_members on buyer signup
- Firm matching: email domain → normalized company name → create new
- Called at signup time and as fallback from PendingApproval page

**`auto-create-firm-on-approval`** (`supabase/functions/auto-create-firm-on-approval/index.ts`):
- Admin-triggered firm creation (when approving a buyer)
- Can optionally prepare NDA submission

### Frontend Gate Components

**`NdaGateModal`** (`src/components/docuseal/NdaGateModal.tsx`):
- Full-screen, non-dismissable overlay on `/listing/:id`
- Calls `get-buyer-nda-embed` to get signing form
- On completion: invalidates query cache, calls `onSigned` callback
- Escape hatch: "Back to listings" button (navigates away, doesn't bypass)

**`FeeAgreementGate`** (`src/components/docuseal/FeeAgreementGate.tsx`):
- Full-screen overlay intercepting connection request flow
- Same pattern as NDA gate but with fee agreement education copy
- Has a "Continue to Request" CTA after signing
- Dismissable via "Back to listings" button

---

## 4. Authentication & Authorization

### Auth Flow

```
Supabase Auth (email/password)
  └─ useNuclearAuth (src/hooks/use-nuclear-auth.ts)
      ├── getSession() → profiles table → createUserObject()
      ├── Self-healing: creates profile if missing (selfHealProfile)
      ├── Team role: get_my_role() RPC for admin users
      └── Session/journey linking (visitor tracking)
  └─ AuthContext (src/context/AuthContext.tsx)
      └── Provides: user, login, logout, signup, isAdmin, isBuyer, teamRole
```

### Route Protection (`src/components/ProtectedRoute.tsx`)

**Protection layers:**
1. **Auth check** with 10-second timeout (prevents infinite loading)
2. **No user** → redirect to `/welcome`
3. **requireAdmin** → checks `user.is_admin === true`
4. **requireRole** → checks `meetsRole(teamRole, requireRole)` (owner > admin > moderator > viewer)
5. **requireApproved** → checks `user.approval_status === 'approved'` (admins bypass)
6. **MFA enforcement** → MFA challenge for admin routes

### Role System

| Role | Source | Description |
|------|--------|-------------|
| `buyer` | profiles.role | Default marketplace user |
| `admin` | profiles.is_admin + profiles.role | Admin panel access |
| `owner` | user_roles table | Highest internal team role |
| `admin` (team) | user_roles table | Standard admin |
| `moderator` | user_roles table | Limited admin |
| `viewer` | user_roles table | Read-only admin |

**RoleGate component** (`src/components/admin/RoleGate.tsx`): Client-side gate for admin sub-routes using `min` role requirement.

---

## 5. Data Architecture

### Core Tables (inferred from code)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (buyer info, approval status, NDA/fee status mirrors) |
| `firm_agreements` | Company-level agreement tracking (NDA, fee agreement, DocuSeal state) |
| `firm_members` | User → Firm relationship (many-to-one) |
| `listings` | Deal/business listings |
| `connection_requests` | Buyer requests for deal introductions |
| `connection_messages` | Thread messages between buyer and admin |
| `marketplace_approval_queue` | Per-deal buyer approval workflow |
| `deal_documents` | Documents attached to deals (teasers, CIMs, etc.) |
| `document_tracked_links` | Tracked link tokens for document access |
| `document_release_log` | Immutable log of document distributions |
| `user_roles` | Internal team role assignments |
| `admin_notifications` | Admin-facing notification records |
| `user_notifications` | Buyer-facing notification records |
| `docuseal_webhook_log` | DocuSeal webhook event log (idempotency) |
| `user_sessions` | Session tracking with geo data |
| `user_journeys` | Visitor journey tracking (pre-auth) |

### Key Relationships

```
profiles (1) ──── (1) firm_members ──── (N) firm_agreements
    │                                           │
    │                                           ├── nda_signed
    │                                           ├── nda_docuseal_submission_id
    │                                           ├── fee_agreement_signed
    │                                           └── fee_docuseal_submission_id
    │
    ├── nda_signed (mirror)
    ├── fee_agreement_signed (mirror)
    ├── approval_status
    └── email_verified
```

**Data duplication pattern**: NDA/fee signing status is stored on BOTH `firm_agreements` (source of truth) AND `profiles` (mirror for quick access). The webhook handler syncs both.

---

## 6. Edge Functions Inventory

### Onboarding & Signing (Critical Path)

| Function | Purpose |
|----------|---------|
| `auto-create-firm-on-signup` | Creates firm + membership at signup |
| `auto-create-firm-on-approval` | Creates firm when admin approves |
| `get-buyer-nda-embed` | Returns DocuSeal NDA embed for buyer |
| `get-buyer-fee-embed` | Returns DocuSeal fee agreement embed |
| `create-docuseal-submission` | Admin-initiated DocuSeal submission |
| `docuseal-webhook-handler` | Processes DocuSeal signing events |
| `docuseal-integration-test` | DocuSeal health check endpoint |
| `approve-marketplace-buyer` | Approves buyer for specific deal |
| `send-approval-email` | Sends approval notification email |
| `send-templated-approval-email` | Template-based approval email |
| `send-verification-email` | Email verification |
| `send-verification-success-email` | Post-verification confirmation |
| `send-nda-email` | NDA signing request via email |
| `send-nda-reminder` | NDA reminder email |
| `send-fee-agreement-email` | Fee agreement signing request |
| `send-fee-agreement-reminder` | Fee agreement reminder |
| `send-marketplace-invitation` | Marketplace invitation email |

### Enrichment & AI

| Function | Purpose |
|----------|---------|
| `enrich-buyer` | Buyer profile enrichment |
| `enrich-deal` | Deal data enrichment |
| `extract-buyer-criteria` | AI-extracted buyer criteria |
| `extract-transcript` | Fireflies transcript extraction |
| `score-buyer-deal` | AI buyer-deal matching |
| `calculate-buyer-quality-score` | Buyer quality scoring |
| `analyze-buyer-notes` | AI analysis of buyer notes |
| `chat-buyer-query` | AI chat for buyer queries |
| `ai-command-center` | AI command center |

### Deal Management

| Function | Purpose |
|----------|---------|
| `data-room-access` | Data room access control |
| `data-room-upload` | Document uploads |
| `data-room-download` | Document downloads |
| `get-document-download` | Signed document downloads |
| `grant-data-room-access` | Grant data room access |
| `publish-listing` | Publish deal listing |
| `convert-to-pipeline-deal` | Convert lead to pipeline deal |

---

## 7. Conversion & Friction Analysis

### Funnel Friction Points

#### Step 1-2: Welcome → Signup (Low Friction)
- Clean persona selection (Buy/Sell split)
- Social proof: testimonial from Brad Daughterty/SFC
- Value props: "Break free from broker gatekeepers"

#### Step 3: Signup Wizard (Moderate Friction)
- **5 steps** is on the higher end for B2B signup
- Step 2 (Referral Source) is **skippable** — good
- Step 3 (Buyer Type) is critical for routing — 8 buyer types with dynamic step 4
- Step 4 (Buyer Profile) is the heaviest — many fields vary by buyer type
- **Risk**: Drop-off at steps 3-4 for buyers who want quick access

#### Step 4: Email Verification (Standard Friction)
- Standard Supabase auth email verification
- Resend button available on PendingApproval page
- No magic link / OTP alternative

#### Step 5: Approval Wait (High Friction — Unavoidable)
- Manual admin review required
- "Usually within one business day" — acceptable for M&A platform
- **Mitigation**: NDA signing available during wait (parallel, not serial)
- 30-second auto-poll keeps page alive

#### Step 6: NDA Signing During Approval Wait (Smart Optimization)
- **Key insight**: Buyers can sign NDA while waiting for approval
- DocuSeal embed renders inline on PendingApproval page
- Messaging: "Buyers who sign before approval get immediate access the moment their account is approved"
- This effectively parallelizes two serial gates

#### Step 7: Marketplace Access (Low Friction Post-Approval)
- Automatic redirect on approval (via 30s polling)
- Lightweight onboarding overlay (educational, not blocking)

#### Step 8: Deal Detail NDA Gate (Conditional Friction)
- Only blocks if NDA somehow unsigned at this point
- Full-screen, non-dismissable — forces signing
- "Sign once, done forever" messaging

#### Step 9: Connection Request Fee Gate (Conversion-Critical)
- Intercepts first "Request Introduction" click
- Excellent education copy explaining the fee agreement
- "Sign once → covers all future deals"
- Dismissable (can go back, come back later)

### Conversion Optimization Opportunities

1. **Signup wizard could be shortened** — Steps 3-4 collect extensive buyer profile data. Consider collecting minimum viable data at signup and enriching later (post-approval profile completion).

2. **No progress saving** — If a user abandons mid-signup, they lose all data. Consider `localStorage` persistence for form state.

3. **No email verification bypass** — Consider allowing limited access (PendingApproval page, NDA signing) without email verification to reduce the verification → signing gap.

4. **Approval polling is passive** — Consider real-time notifications (Supabase Realtime subscription on `profiles.approval_status`) instead of 30-second polling.

5. **Fee agreement gate position** — Currently at connection request time. Consider prompting earlier (e.g., on marketplace entry or profile page) to front-load the friction.

---

## 8. Educational Content System

### Onboarding Education Points

The system uses **contextual education** throughout the flow rather than a standalone learning center:

| Location | Content Type | Purpose |
|----------|-------------|---------|
| Signup step 2 | Referral source questions | Understand buyer acquisition channels |
| PendingApproval (NDA) | "Why we require an NDA" card | Explain confidentiality requirement |
| PendingApproval (NDA) | "What you're agreeing to" card | Summarize NDA terms |
| NdaGateModal | Inline explanation | "Sign once, done forever" |
| FeeAgreementGate | "What is a fee agreement?" | Explain fee structure |
| FeeAgreementGate | "What you're agreeing to" | Modified Lehman scale, success-only |
| FeeAgreementGate | "Why we ask before first request" | Trust and formalization |
| Post-approval onboarding | Educational overlay | Marketplace tutorial |
| AlertSuccessOnboarding | Deal alert setup | Configure deal alerts after first save |

### Content Quality Assessment

**Strengths:**
- NDA education copy is excellent — addresses "why" before "what"
- Fee agreement copy clearly explains success-only model
- Contact information provided at every signing step
- "About 60 seconds" time framing reduces perceived commitment

**Weaknesses:**
- No video or interactive walkthrough
- No FAQ/help center integration
- Education copy is static — not personalized by buyer type
- No "what happens next" after NDA signing (between signing and approval)

---

## 9. Technical Debt & Risk Assessment

### Critical Issues

1. **Data Duplication** — NDA/fee signing status is stored on both `firm_agreements` and `profiles`. Webhook handler syncs both, but any missed sync creates inconsistency. The `get-buyer-fee-embed` self-healing helps but is reactive, not preventive.

2. **Webhook Security** — `docuseal-webhook-handler` has a lenient verification approach: "If no secret header is found, we log a warning but still process." This means webhook verification can be silently bypassed. The payload structure validation provides some protection but isn't sufficient against targeted attacks.

3. **`auto-create-firm-on-signup` accepts userId from body** — When no JWT is available, it accepts `userId` from the request body without additional verification. This could allow impersonation if the endpoint is exposed.

4. **30-second polling** — The PendingApproval page polls `refreshUserProfile()` every 30 seconds. For high-traffic scenarios, this creates unnecessary load. Supabase Realtime subscriptions would be more efficient.

### Moderate Issues

5. **No signup form persistence** — 5-step wizard with extensive fields has no draft saving. Browser refresh loses all data.

6. **Query cache stale times** — Global staleTime is 15 minutes. Some data (approval status, NDA status) should have shorter stale times for better responsiveness.

7. **Error handling in firm creation** — `auto-create-firm-on-signup` firm_members insert error is logged but marked as "Non-fatal." If the member link fails, the user has no firm association and the NDA panel won't render.

8. **Firm matching by email domain** — Could incorrectly group users from different companies sharing the same email provider (e.g., gmail.com, outlook.com). The normalized company name fallback helps but isn't foolproof.

9. **DocuSeal API timeouts** — Hard-coded 15-second timeouts on all DocuSeal API calls. No retry logic if DocuSeal is temporarily slow.

### Low-Priority

10. **Large App.tsx** — 335 lines with 50+ routes. Could benefit from route splitting by domain (admin, buyer, public).

11. **Mixed context patterns** — Both `src/context/` and `src/contexts/` directories exist. Should be consolidated.

12. **630+ migrations** — Normal for a mature project but makes fresh schema setup slow. Consider squashing old migrations.

---

## 10. Future-State Architecture Recommendations

### Short-Term Improvements

1. **Realtime approval notifications**: Replace 30-second polling with Supabase Realtime subscription on `profiles.approval_status` changes. Instant feedback, zero wasted API calls.

2. **Signup form persistence**: Add `localStorage`-backed form state in the signup wizard. Serialize form data on change, restore on mount, clear on successful submission.

3. **Strengthen webhook verification**: Either enforce the secret header check (reject if missing) or implement HMAC-based verification if DocuSeal supports it.

4. **Firm matching guard for generic email domains**: Maintain a denylist of generic email domains (gmail.com, outlook.com, yahoo.com, etc.) and skip email-domain-based firm matching for these.

### Medium-Term Improvements

5. **Route code splitting**: Break `App.tsx` into domain-specific route files:
   - `routes/public.tsx`
   - `routes/buyer.tsx`
   - `routes/admin.tsx`
   - `routes/remarketing.tsx`
   - `routes/ma-intelligence.tsx`

6. **Unified agreement status view**: Create a single `useAgreementStatus` hook that consolidates NDA + fee agreement status from `firm_agreements`, replacing the scattered `useBuyerNdaStatus` + per-component fee checks.

7. **Progressive signup**: Collect minimal data at signup (email, password, name, buyer type) and defer detailed profile fields to a post-approval "complete your profile" flow. Reduces signup friction while maintaining data quality.

8. **Webhook self-healing service**: Scheduled function that reconciles `firm_agreements` status with DocuSeal API state for all pending/sent submissions. Catches any missed webhooks proactively rather than reactively.

### Long-Term Architecture

9. **Event-driven architecture**: Move from direct DB writes to an event bus pattern. Signing events, approval events, and notification events should flow through a central event system, making it easier to add new side effects without modifying existing functions.

10. **Buyer experience personalization**: Use buyer_type and profile data to customize the entire onboarding and marketplace experience — different education content, deal recommendations, and communication cadence by buyer type.

---

*End of audit report.*
