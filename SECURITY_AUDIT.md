# SourceCo CTO Audit — Series A Due Diligence Review (v2)

**Date:** 2026-02-20
**Scope:** Full codebase security, architecture, performance, and production readiness audit
**Commits:** 2 (initial fixes + re-audit fixes)

---

## SECTION 1: SECURITY AUDIT

### 1.1 — Authentication & Session Security

**Finding 1 — Race condition in `useNuclearAuth` (P1)** — OPEN
`use-nuclear-auth.ts` line 112: On `SIGNED_IN` event, profile fetch is deferred 100ms via `setTimeout`. During that window, `user` is `null` but `authChecked` may already be `true`. Produces UX glitches (brief flash of `/welcome` redirect).

*Remediation*: Set `isLoading = true` before the `setTimeout` fires.

**Finding 2 — No RLS UPDATE policy on `profiles` table (P0)** ✅ FIXED
**THE BIGGEST FINDING IN THIS AUDIT.** Zero RLS UPDATE policies existed for the `profiles` table across 150+ migrations. Any authenticated user could directly call `supabase.from('profiles').update({ is_admin: true })` to escalate privileges, bypassing all client-side protections.

*Remediation applied*: Created migration `20260220_security_audit_rls_profiles_update.sql` that:
- Allows users to update own profile BUT prevents changing `is_admin`, `approval_status`, `email_verified`, `email`
- Allows admins to update any profile (including privileged fields)

**Finding 3 — `updateUserProfile` privilege escalation (P0)** ✅ FIXED (Commit 1)
Client-side deny-list now strips `is_admin`, `approval_status`, `email_verified`, `role`, `id`, `email`.

**Finding 4 — No session invalidation on password change (P1)** — OPEN
`Profile.tsx` calls `supabase.auth.updateUser({ password })` but does NOT call `signOut({ scope: 'global' })` afterward. Other active sessions remain valid.

**Finding 5 — `ProtectedRoute.tsx` has no timeout on loading state (P2)** — OPEN
If `authChecked` never becomes `true`, user sees spinner indefinitely. No error recovery path.

**Finding 6 — `session-security.ts` is non-functional (P2)** — OPEN
All methods call a `session-security` edge function that does not exist. Session validation is effectively disabled.

**Finding 7 — 22+ uses of `getSession()` instead of `getUser()` in client code (P2)** — OPEN
`getSession()` trusts client state; `getUser()` validates with server. Found in:
- `src/pages/auth/callback.tsx`
- `src/hooks/marketplace/use-connections.ts` (3 instances)
- `src/context/AnalyticsContext.tsx`
- `src/components/remarketing/ReMarketingChat.tsx`
- `src/components/remarketing/DealBuyerChat.tsx`
- `src/hooks/use-nuclear-auth.ts` (3 instances)
- 12+ additional locations

---

### 1.2 — Edge Function Security

#### Functions NOW Secured (✅ FIXED in this PR):

| Function | Auth | Admin | Status |
|---|---|---|---|
| `create-lead-user` | ✅ `getUser()` | ✅ `rpc('is_admin')` | OK (pre-existing) |
| `send-deal-alert` | ✅ | ✅ | OK (pre-existing) |
| `chat-remarketing` | ✅ `getUser()` | ✅ `rpc('is_admin')` | OK (pre-existing) |
| `publish-listing` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** (Commit 1) |
| `enrich-buyer` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** (Commit 1) |
| `score-buyer-deal` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** (Commit 1) |
| `convert-to-pipeline-deal` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** (Commit 1) |
| `generate-ma-guide` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** (Commit 2) |
| `bulk-import-remarketing` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** (Commit 2) |
| `sync-captarget-sheet` | ✅ JWT | ✅ `rpc('is_admin')` | **FIXED** (Commit 2) |

#### Functions Still Unprotected (OPEN):

| Function | Issue | Severity |
|---|---|---|
| `send-password-reset-email` | No rate limiting, no auth | P1 |
| `enhanced-admin-notification` | No auth — accepts arbitrary notification data | P1 |
| `send-email-notification` | Deprecated but still active, no auth | P1 |
| `error-logger` | No auth — info disclosure risk | P2 |
| `get-mapbox-token` | Returns API token without restriction | P2 |

#### Prompt Injection Risk (OPEN):
`chat-remarketing` line 62: Raw `query` parameter passed to AI with sensitive buyer context in system prompt. No input sanitization. Attacker could attempt system prompt extraction.

---

### 1.3 — Data Exposure

**Finding 8 — `select('*')` in buyer-facing query** ✅ FIXED (Commit 1)
`use-simple-listings.ts` now uses explicit column list.

**Finding 9 — `select('*')` in 20+ admin/analytics hooks** — OPEN (P2)
Admin hooks still use `select('*')` extensively:
- `use-automated-intelligence.ts` — 6 full table selects
- `use-revenue-optimization.ts` — multiple full selects
- `admin/use-user-connection-requests.ts`
- `admin/requests/use-connection-requests-query.ts`
- `admin/use-admin-stats.ts` — 6 head: true queries

*Remediation*: Scope all admin queries to explicitly needed columns.

**Finding 10 — Profile self-heal** ✅ FIXED (Commit 1)
Now preserves `approval_status` for existing profiles.

---

### 1.4 — Input Validation & XSS

**DOMPurify** ✅ FIXED — `class`/`id` removed from ALLOWED_ATTR (Commit 1).
Only 2 uses of `dangerouslySetInnerHTML` found, both properly sanitized.

---

## SECTION 2: ARCHITECTURE & CODE QUALITY

### 2.1 — State Management

- **7 React Context providers** nested in `App.tsx`. Well-separated but overlapping analytics concerns.
- **Cache key strategy** in `query-keys.ts` is healthy with clear sections.
- Auth has single source of truth (`useNuclearAuth`). No desync risk.
- 2 listing cache paths (`simple-listings` vs `listings`) still cause duplicate requests.

### 2.2 — God Hooks & Components (P2)

| File | Lines | Type |
|---|---|---|
| `useUnifiedAnalytics.ts` | 1,569 | God hook |
| `remarketing/AIResearchSection.tsx` | 1,790 | God component |
| `pages/Signup.tsx` | 1,772 | Monolith |
| `remarketing/DealTranscriptSection.tsx` | 1,403 | God component |
| `pages/Profile.tsx` | 1,284 | Monolith |
| `admin/CreateDealModal.tsx` | 1,033 | Monolith |
| `admin/use-deals.ts` | 887 | Large hook |

### 2.3 — TypeScript Quality (P2)

- `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- **686 instances of `: any`** across codebase
- **477 `as any` type assertion bypasses**
- User type has 100+ optional fields

### 2.4 — Error Handling

- Error handler is comprehensive with circuit breaker pattern ✅
- Zero empty catch blocks found ✅
- 11 error boundary files with good coverage ✅
- 4 TODO/FIXME comments remain (low risk)

---

## SECTION 3: PERFORMANCE

### 3.1 — Third-Party Scripts (P2)
`index.html` loads **9 synchronous tracking scripts** in `<head>`: GTM, GA4, Heap, Hotjar, LinkedIn, Brevo, Vector. GTM and Heap execute synchronously and may block initial render.

### 3.2 — Query Caching
- `staleTime: 0` in `MyRequests.tsx` ✅ FIXED (Commit 2) — set to 30 seconds
- `staleTime: 0` in `ReMarketingUniverseDetail.tsx` — OPEN (admin-only, lower priority)
- Global default of 5 minutes is reasonable

### 3.3 — Lazy Loading
- **Pages**: Properly lazy-loaded via `lazyWithRetry` ✅
- **Heavy libraries**: Recharts (30+ imports), TipTap (3 imports), Mapbox GL — NOT lazy-loaded ❌
- `MapboxGlobeMap.tsx` has 2 `setTimeout` calls without cleanup (memory leak risk)

### 3.4 — Supabase Subscriptions
All 31+ real-time subscription hooks properly clean up with `supabase.removeChannel()` ✅

---

## SECTION 4: TESTING

- **1 test file**: `deal-scoring-v5.test.ts` (45 test cases, excellent quality)
- **0 tests** for auth, RLS, edge functions, connections, profiles
- **No CI/CD** pipeline found
- **Missing testing deps**: `@testing-library/react`, `msw`, coverage tools
- Testing documentation scattered across 5+ markdown files

---

## SECTION 5: PRODUCTION READINESS CHECKLIST

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | RLS covers all tables | ⚠️ Improved | Profiles UPDATE policy added; other tables need audit |
| 2 | Edge functions validate auth | ⚠️ Improved | 10/15 high-risk functions now secured; 5 remain |
| 3 | No secrets in client code | ✅ Ready | Only publishable keys in `.env` |
| 4 | Input validation client+server | ⚠️ Needs Work | Client Zod exists; server-side sparse |
| 5 | XSS prevention | ✅ Ready | DOMPurify applied consistently |
| 6 | Error boundaries | ✅ Ready | 11 error boundary files with good coverage |
| 7 | `lazyWithRetry` chunk recovery | ✅ Ready | |
| 8 | Supabase connection failures | ⚠️ Needs Work | Some unhandled paths |
| 9 | Edge function failures don't break UI | ✅ Ready | Non-blocking calls |
| 10 | Initial load < 3s on 3G | ⚠️ Needs Work | 9 sync scripts in head; heavy libs not lazy-loaded |
| 11 | Marketplace renders 100+ listings | ✅ Ready | Pagination + explicit columns |
| 12 | Admin queries < 2s | ⚠️ Needs Work | Full-table `select('*')` analytics queries |
| 13 | All migrations reversible | ❌ Not Ready | No documented rollback strategy |
| 14 | GDPR data deletion | ⚠️ Needs Work | Cascade deletes exist; completeness unverified |
| 15 | Backup/recovery documented | ❌ Not Ready | No runbook found |
| 16 | Error tracking | ⚠️ Needs Work | `error-logger` exists but no auth on it |
| 17 | Web Vitals tracked | ⚠️ Needs Work | GA4/Heap present; Core Web Vitals unclear |
| 18 | Uptime monitoring | ❌ Not Ready | Not visible |
| 19 | Auth flows have tests | ❌ Not Ready | None |
| 20 | RLS has automated tests | ❌ Not Ready | None |
| 21 | CI/CD runs tests | ❌ Not Ready | No CI config found |
| 22 | Staging mirrors production | ❌ Not Ready | One Supabase project |
| 23 | Edge function API contracts | ❌ Not Ready | No OpenAPI/docs |
| 24 | Database ERD documented | ❌ Not Ready | 150+ migrations, no diagram |
| 25 | Production runbook | ❌ Not Ready | None found |

---

## SECTION 6: ALL CHANGES MADE IN THIS PR

### Commit 1 (Initial Fixes)

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

### Commit 2 (Re-Audit Fixes)

| # | Finding | Severity | File | Change |
|---|---|---|---|---|
| 10 | **No RLS UPDATE policy on profiles** | **P0** | `supabase/migrations/20260220_security_audit_rls_profiles_update.sql` | Created UPDATE policies protecting privileged fields |
| 11 | `generate-ma-guide` no auth | P0 | `supabase/functions/generate-ma-guide/index.ts` | Added JWT + `is_admin` RPC guard |
| 12 | `bulk-import-remarketing` no auth (can delete all data) | P0 | `supabase/functions/bulk-import-remarketing/index.ts` | Added JWT + `is_admin` RPC guard |
| 13 | `sync-captarget-sheet` no auth | P0 | `supabase/functions/sync-captarget-sheet/index.ts` | Added JWT + `is_admin` RPC guard |
| 14 | `staleTime: 0` in MyRequests.tsx | P2 | `src/pages/MyRequests.tsx` | Set to 30 seconds |

---

## SECTION 7: EXECUTIVE SUMMARY

### 7.1 — Risk Matrix (Remaining Open Items)

| Finding | Severity | Impact | Likelihood | Effort |
|---|---|---|---|---|
| No session invalidation on password change | P1 | High | Med | 1h |
| `send-password-reset-email` no rate limit | P1 | Med | High | 2h |
| `enhanced-admin-notification` no auth | P1 | Med | Med | 1h |
| `send-email-notification` no auth (deprecated) | P1 | Med | Low | 1h |
| 22+ `getSession()` instead of `getUser()` | P2 | Med | Low | 1 day |
| `session-security.ts` non-functional | P2 | Med | Low | Remove or implement |
| 20+ `select('*')` in admin hooks | P2 | Low | Med | 1 day |
| `useUnifiedAnalytics` god hook (1,569 lines) | P2 | Low | Low | 1 week |
| 686 `any` types / strict mode disabled | P2 | Med | Med | 2 weeks |
| 9 sync scripts in index.html | P2 | Med | High | 1 day |
| Heavy libs not lazy-loaded | P2 | Med | High | 1 day |
| No CI/CD | P2 | High | High | 3 days |
| No staging environment | P2 | High | High | 1 week |
| 1 test file for 1,077 TS files | P1 | High | High | 2 weeks |

### 7.2 — Top 5 Fix Before Launch

1. **Add session invalidation on password change** (`Profile.tsx`): Call `await supabase.auth.signOut({ scope: 'global' })` after successful password update. **1 hour.**

2. **Add rate limiting to `send-password-reset-email`**: Implement per-email cooldown (e.g., 1 request per 60 seconds). **2 hours.**

3. **Add auth to `enhanced-admin-notification`** and **`send-email-notification`**: JWT + admin guard. **2 hours.**

4. **Deploy the profiles RLS UPDATE migration**: The migration `20260220_security_audit_rls_profiles_update.sql` must be applied to production. **30 minutes.**

5. **Replace `getSession()` with `getUser()` in security-critical paths**: At minimum in `use-connections.ts` and `auth/callback.tsx`. **4 hours.**

### 7.3 — Top 5 Fix Within 30 Days

1. **Write Phase 1 tests**: Auth flow, RLS enforcement, connection request flow. Use Vitest + `@testing-library/react`.

2. **Set up CI/CD**: GitHub Actions running tests, lint, and build on PRs.

3. **Defer third-party scripts**: Move GTM/Heap/Hotjar initialization to after page interactive.

4. **Lazy-load heavy libraries**: Recharts, TipTap, Mapbox GL should use `React.lazy()`.

5. **Scope admin `select('*')` queries**: Replace with explicit column lists in analytics and admin hooks.

### 7.4 — Technical Debt Score

| Dimension | Score | Rationale |
|---|---|---|
| **Security** | **4/10** | RLS UPDATE policy was missing; 5 edge functions still unprotected; `getSession()` overuse |
| **Architecture** | **4/10** | Clean auth layering; but god hooks (1,569 lines), monolith components (1,790 lines) |
| **Testing** | **9/10** | 1 test file for 1,077 TypeScript files. Near total absence. |
| **Performance** | **5/10** | Pagination exists; 9 sync scripts; heavy libs not lazy-loaded; admin `select('*')` |
| **Documentation** | **8/10** | No ERD, no runbook, no API contracts, no rollback docs |
| **Overall** | **6.0/10** | Improved from 6.4 — security sprint closing critical gaps |

### 7.5 — Strengths

1. **Clean auth architecture**: `useNuclearAuth` → `AuthContext` → `useAuth` single source of truth
2. **Comprehensive error boundaries**: 11 error boundary files covering auth, admin, and production
3. **DOMPurify applied consistently**: All HTML rendering through centralized sanitizer
4. **CORS allowlist (not wildcard)**: `_shared/cors.ts` uses origin allowlisting
5. **Queue-based processing**: Enrichment, scoring, guide generation all use DB-backed queues with idempotency

### 7.6 — Recommendation

**The codebase is significantly closer to Series-A readiness after this audit.** The single most critical finding was the missing RLS UPDATE policy on `profiles` — now fixed. 10 of 15 high-risk edge functions are now secured with JWT + admin RPC guards. The remaining gap is a cluster of email-sending functions without auth and the systemic use of `getSession()` over `getUser()` in client code. The **90-day priority should be threefold**: (1) complete the remaining security items (5 functions, session invalidation, rate limiting), (2) build a CI/CD pipeline with at least 20 critical-path tests, and (3) address the performance debt from synchronous scripts and unbounded admin queries. The architecture is sound — the team made mature decisions on auth layering, CORS, and queue processing. The codebase needs hardening, not rewriting.
