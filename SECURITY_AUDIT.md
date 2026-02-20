# SourceCo CTO Audit — Series A Due Diligence Review

**Date:** 2026-02-20
**Scope:** Full codebase security, architecture, and production readiness audit

---

## SECTION 1: SECURITY AUDIT

### 1.1 — Authentication & Session Security

**Finding 1 — Race condition in `useNuclearAuth` (P1)**
`use-nuclear-auth.ts` line 112: On `SIGNED_IN` event, profile fetch is deferred 100ms via `setTimeout`. During that window, `user` is `null` but `authChecked` may already be `true`. `ProtectedRoute.tsx` checks both — but the 100ms gap means a slow network could leave a user in a logged-in-but-unrecognized limbo state, causing brief flashes of the `/welcome` redirect before snapping back. **Not exploitable for privilege escalation**, but produces UX glitches and analytics noise.

*Remediation*: Set `isLoading = true` before the `setTimeout` fires so `ProtectedRoute` holds the loader state.

**Finding 2 — `is_admin` is read from `profiles.is_admin` (P1)** ✅ FIXED in `publish-listing`
`auth-helpers.ts` line 89: `is_admin: Boolean(profile.is_admin === true)`. The comment in `use-nuclear-auth.ts` says it's "auto-synced from user_roles via DB trigger," but **no such trigger is visible in the shared context**. If a user can write any field to `profiles`, they could escalate themselves to admin.

*Remediation applied*: `publish-listing` now uses `rpc('is_admin')` from `user_roles` table. `updateUserProfile` now strips `is_admin` from payloads.

**Finding 3 — `AuthGuards.ts` only guards signup flow, NOT admin routes (P1)**
`src/features/auth/guards/AuthGuards.ts` exclusively guards signup state and rate-limits auth attempts. It has **zero protection for `/admin/*` routes**. Admin route guarding is entirely in `ProtectedRoute.tsx` via the `requireAdmin` prop.

**Finding 4 — `updateUserProfile` passes raw client payload (P0)** ✅ FIXED
`use-nuclear-auth.ts`: `dbPayload` was built from `data: Partial<AppUser>` with no field allowlist.

*Remediation applied*: Added explicit deny-list stripping `is_admin`, `approval_status`, `email_verified`, `role`, `id`, `email` before `.update()`.

---

### 1.2 — Row Level Security Gaps

**Finding 5 — `publish-listing` admin check reads `profiles.is_admin` (P1)** ✅ FIXED
Now uses `supabaseAdmin.rpc('is_admin', { _user_id: user.id })`.

**Finding 6 — `enrich-buyer` has NO auth check (P0)** ✅ FIXED
Any actor with the function's URL could trigger expensive Firecrawl + Gemini AI enrichment.

*Remediation applied*: Added JWT validation + `is_admin` RPC guard.

**Finding 7 — `score-buyer-deal` has NO auth check (P0)** ✅ FIXED
A malicious actor could trigger bulk re-scoring, manipulating composite scores.

*Remediation applied*: Added JWT validation + `is_admin` RPC guard.

**Finding 8 — `convert-to-pipeline-deal` has NO auth check (P0)** ✅ FIXED
Added JWT validation + `is_admin` RPC guard.

---

### 1.3 — Edge Function Security (Summary)

| Function | Auth Check | Admin Check | Status |
|---|---|---|---|
| `create-lead-user` | ✅ | ✅ `rpc('is_admin')` | OK |
| `send-deal-alert` | ✅ | ✅ | OK |
| `chat-remarketing` | ✅ | ✅ | OK |
| `publish-listing` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** |
| `enrich-buyer` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** |
| `score-buyer-deal` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** |
| `convert-to-pipeline-deal` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** |
| `generate-ma-guide` | Unknown | Unknown | Needs audit |
| `bulk-import-remarketing` | Unknown | Unknown | Needs audit |
| `sync-captarget-sheet` | Unknown | Unknown | Needs audit |
| `send-password-reset-email` | ⚠️ No rate limit | — | P1 |

---

### 1.4 — Data Exposure & Leakage

**Finding 9 — `use-simple-listings.ts` uses `select('*')` (P1)** ✅ FIXED
Fetched every column including internal fields (`internal_notes`, `salesforce_link`, etc.) and exposed them to the buyer's browser.

*Remediation applied*: Replaced with explicit buyer-visible column list.

**Finding 10 — Profile self-heal upserts with no column restriction (P2)** ✅ FIXED
`profile-self-heal.ts`: `approval_status` being hardcoded to `'pending'` meant every self-heal event resets a manually-approved user to pending.

*Remediation applied*: Self-heal now checks for existing profile and preserves `approval_status` if already set.

**Finding 11 — `updateUserProfile` does not strip `is_admin` / `approval_status` (P0)** ✅ FIXED
See Finding 4.

---

### 1.5 — Input Validation & XSS

**Finding 12 — DOMPurify is applied correctly (✅)**
`rich-text-display.tsx`: DOMPurify with a strict allowlist. Correct pattern.

**Finding 13 — `class` attribute allowed in DOMPurify config (P2)** ✅ FIXED
`class` and `id` removed from `ALLOWED_ATTR` to prevent UI spoofing via CSS class injection.

---

### 1.6 — Secrets & Credential Management

**Finding 14 — `.env` contains publishable keys only (✅)**
Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key), and `VITE_SUPABASE_PROJECT_ID`. No service role key or private secret exposed.

---

## SECTION 2: ARCHITECTURE & CODE QUALITY

### 2.1 — State Management

- Auth has 3 layers but properly composed (P3): `AuthContext` → `useAuth` → `useNuclearAuth`. Single source of truth.
- `use-simple-listings` cache key is `['simple-listings', ...]` while `use-listings` key is `['listings', ...]` — duplicate network requests (P2).
- `staleTime: 0` on `useSimpleListings` caused aggressive refetch. ✅ FIXED — set to 30 seconds.

### 2.2 — TypeScript Quality

- `tsconfig.json` has `strict: false`, `noImplicitAny: false`, `strictNullChecks: false` (P2)
- `score-buyer-deal` at 2,126 lines is untestable as a unit (P2)

---

## SECTION 3: PERFORMANCE

- `staleTime: 0` caused aggressive refetch on every navigation. ✅ FIXED
- `select('*')` in buyer-facing queries exposed unnecessary data. ✅ FIXED

---

## SECTION 4: TESTING

**One test file exists** (`src/lib/deal-scoring-v5.test.ts`). Zero tests for auth, RLS, edge functions, connection flow, or admin operations. (P1)

---

## SECTION 5: REMAINING ITEMS (NOT YET FIXED)

1. **P1**: Race condition in `useNuclearAuth` — set `isLoading = true` before `setTimeout`
2. **P1**: `send-password-reset-email` has no rate limiting
3. **P2**: `useUnifiedAnalytics` (69KB) god hook needs decomposition
4. **P2**: Enable `strict: true` in `tsconfig.json`
5. **P2**: Decompose `score-buyer-deal` (2,126 lines)
6. **P2**: No staging environment
7. **P2**: No CI/CD pipeline
8. **P1**: Write auth/RLS tests (Phase 1 testing)
9. Audit remaining edge functions: `generate-ma-guide`, `bulk-import-remarketing`, `sync-captarget-sheet`

---

## SECTION 6: CHANGES MADE IN THIS PR

| # | Finding | Severity | File | Change |
|---|---|---|---|---|
| 1 | `updateUserProfile` privilege escalation | P0 | `src/hooks/use-nuclear-auth.ts` | Added deny-list stripping privileged fields |
| 2 | `enrich-buyer` no auth | P0 | `supabase/functions/enrich-buyer/index.ts` | Added JWT + `is_admin` RPC guard |
| 3 | `score-buyer-deal` no auth | P0 | `supabase/functions/score-buyer-deal/index.ts` | Added JWT + `is_admin` RPC guard |
| 4 | `convert-to-pipeline-deal` no auth | P0 | `supabase/functions/convert-to-pipeline-deal/index.ts` | Added JWT + `is_admin` RPC guard |
| 5 | `publish-listing` uses `profiles.is_admin` | P1 | `supabase/functions/publish-listing/index.ts` | Switched to `rpc('is_admin')` |
| 6 | `profile-self-heal` resets approval_status | P1 | `src/lib/profile-self-heal.ts` | Preserves existing `approval_status` |
| 7 | `select('*')` exposes internal fields | P1 | `src/hooks/use-simple-listings.ts` | Explicit buyer-safe column list |
| 8 | `staleTime: 0` aggressive refetch | P2 | `src/hooks/use-simple-listings.ts` | Set to 30 seconds |
| 9 | DOMPurify allows `class`/`id` | P2 | `src/components/ui/rich-text-display.tsx` | Removed from ALLOWED_ATTR |
