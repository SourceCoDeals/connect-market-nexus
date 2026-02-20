# CTO-Level Deep Dive Audit & Test Prompt — SourceCo Marketplace

> **Purpose**: Paste this entire prompt into Lovable (or any AI coding assistant) to get a comprehensive, executive-grade audit of the SourceCo Marketplace codebase. This covers security, architecture, performance, data integrity, testing, and production readiness.

---

## PROMPT START

You are acting as a **CTO performing a deep technical audit** of this codebase before a Series A due diligence review. Be brutally honest. No sugarcoating. I need findings organized by severity (P0 Critical → P3 Low) with specific file paths, line numbers, and concrete remediation steps.

This is a **React 18 + Vite + Supabase** SPA marketplace for M&A deal sourcing. It has three subsystems: (1) Buyer Marketplace, (2) Remarketing/Outbound, (3) M&A Intelligence. There are 109 Supabase edge functions, 150+ DB migrations, and 1,077 TypeScript files.

---

### SECTION 1: SECURITY AUDIT (Priority: Highest)

Audit every layer for vulnerabilities. Specifically:

#### 1.1 — Authentication & Session Security
- Review `src/context/AuthContext.tsx` and `src/hooks/use-nuclear-auth.ts` — is there any race condition between `onAuthStateChange` and profile fetch? Can a user access protected routes during the gap?
- Review `src/components/ProtectedRoute.tsx` — what happens if `isLoading` is true indefinitely? Is there a timeout? Can this be exploited?
- Review `src/features/auth/guards/AuthGuards.ts` — are all admin routes properly gated? Can a non-admin user craft a direct URL to `/admin/*` and bypass guards?
- Review `src/lib/session-security.ts` and `src/lib/auth-helpers.ts` — are sessions invalidated on password change? Are refresh tokens properly rotated?
- Check: Is there any client-side `is_admin` check that can be spoofed by modifying localStorage or React state? Does the backend (RLS/edge functions) independently verify admin status?

#### 1.2 — Row Level Security (RLS) Gaps
- Audit **every table** referenced in `src/integrations/supabase/types/` against actual RLS policies in `supabase/migrations/`.
- Specifically check these tables for missing or permissive RLS:
  - `connection_requests` — Can User A read User B's connection requests?
  - `saved_listings` — Can User A see User B's saved deals?
  - `profiles` — Can a non-admin user query another user's full profile (email, phone, investment criteria)?
  - `deals` (CRM pipeline) — Is this locked to admins only at the DB level?
  - `remarketing_buyers`, `remarketing_deals` — Admin-only access verified at DB level?
  - `enrichment_queue`, `buyer_enrichment_queue` — Can non-admins trigger enrichment?
  - `outreach_records` — Can non-admins see outreach history?
  - `valuation_leads` — Is PII protected?
- For each table, confirm: SELECT, INSERT, UPDATE, DELETE policies exist with proper `auth.uid()` checks.

#### 1.3 — Edge Function Security
- Review the `supabase/functions/` directory. For **each edge function**:
  - Does it validate the JWT from the `Authorization` header?
  - Does it use `supabase.auth.getUser()` (secure) vs `supabase.auth.getSession()` (client-trusting)?
  - Are admin-only functions checking `is_admin` from the **database** (not from the JWT claims or client)?
  - Is there input validation on all request body fields?
- Specifically audit these high-risk functions:
  - `enrich-buyer` / `enrich-deal` — Can a regular user trigger enrichment for arbitrary buyers?
  - `publish-listing` — Can a non-admin publish/unpublish deals?
  - `create-lead-user` — Is this open to abuse for creating fake accounts?
  - `send-email-notification` / `send-deal-alert` — Can these be weaponized for email spam?
  - `chat-remarketing` — Is the Claude API key exposed? Is there prompt injection risk?
  - `score-buyer-deal` — Can scoring be manipulated?
  - `password-reset` / `send-password-reset-email` — Rate limited? Enumeration-safe?

#### 1.4 — Data Exposure & Leakage
- Check all Supabase `.select('*')` calls across the hooks directory (`src/hooks/`). Are we over-fetching sensitive columns (emails, phone numbers, financial data) and exposing them to the client?
- Review `src/hooks/use-simple-listings.ts` and `src/hooks/use-marketplace.ts` — do marketplace queries expose internal fields like `internal_notes`, `salesforce_link`, `enrichment_data` to regular buyers?
- Check `ListingDetail.tsx` — is there any admin-only data that leaks into the buyer view?
- Review `Profile.tsx` — when a user updates their profile, can they overwrite `is_admin`, `approval_status`, or other privileged fields?

#### 1.5 — Input Validation & XSS
- The TipTap rich text editor stores HTML/JSON in listing descriptions. Review:
  - Is `DOMPurify` applied consistently before rendering? Check every place `description` is rendered.
  - Is there server-side sanitization in edge functions that accept HTML content?
  - Can a malicious admin inject XSS through listing descriptions that affects buyer views?
- Review all forms: `Signup.tsx`, `Profile.tsx`, `OwnerInquiry.tsx`, admin listing editor — is Zod validation applied on both client AND server?
- Check for SQL injection vectors in any raw Supabase `.rpc()` calls or `.filter()` with user input.

#### 1.6 — Secrets & Credential Management
- Scan the entire repo (including git history) for exposed secrets: API keys, service role keys, JWT secrets, third-party tokens.
- Review `.env` — are Supabase keys committed to the repo? Is `.env` in `.gitignore`?
- Check `index.html` — are analytics IDs (GA4, Heap, Hotjar) exposing internal tracking configurations?
- Review edge functions for hardcoded secrets vs environment variable usage.

---

### SECTION 2: ARCHITECTURE & CODE QUALITY AUDIT

#### 2.1 — State Management Coherence
- Map all state management patterns in the app: React Context, React Query, localStorage, sessionStorage, URL params.
- Are there conflicting sources of truth? Specifically:
  - Auth state: `AuthContext` vs `useAuth` hook vs `use-nuclear-auth` — how many layers exist and can they desync?
  - Analytics state: `AnalyticsContext` vs `AnalyticsFiltersContext` vs `SearchSessionContext` vs `SessionContext` — is there duplication?
  - Listing data: Is the same listing fetched by multiple hooks with different cache keys?
- Review React Query cache key strategy in `src/lib/query-keys.ts` — are there cache key collisions or stale data issues?

#### 2.2 — Hook Architecture
- There are 125+ custom hooks. Audit for:
  - **Circular dependencies**: Do any hooks import each other?
  - **God hooks**: `useUnifiedAnalytics.ts` is 69KB and `useEnhancedRealTimeAnalytics.ts` is 27.5KB. What is their dependency graph? Can they cause infinite re-renders?
  - **Unused hooks**: Are there hooks that are imported nowhere?
  - **Side effects**: Which hooks trigger side effects (API calls, localStorage writes) on mount? Could these cause issues during SSR or testing?

#### 2.3 — Component Architecture
- Review the largest page components by file size:
  - `Profile.tsx` (62KB) — should this be split into sub-components?
  - `Signup.tsx` (73KB) — is the multi-step form maintainable?
  - `AdminListings.tsx` + subcomponents (183KB total) — is the admin listing CRUD properly decomposed?
- Check for prop drilling depth — are there components passing props through 4+ levels?
- Review error boundaries: Is `ErrorBoundary.tsx` catching all unhandled errors? Are there per-route error boundaries?

#### 2.4 — TypeScript Quality
- The `tsconfig.json` has `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`. Identify the top 20 places where enabling strict mode would catch actual bugs (null dereferences, implicit any usage, unchecked optional access).
- Review `src/types/index.ts` — the `User` type has 50+ optional fields. Are there proper type guards or is the code littered with `user?.field?.subfield` chains?
- Check for `any` type usage across the codebase. How many instances exist? Which are in critical paths?

#### 2.5 — Error Handling
- Review `src/lib/error-handler.ts` — is the circuit breaker pattern actually preventing cascading failures or just silently swallowing errors?
- Check all `try/catch` blocks in hooks and edge functions — are errors being swallowed with empty catches?
- Review toast notifications: Is every user-facing error properly communicated? Are there silent failures?
- Check Supabase query error handling: After every `.from().select()`, is the `error` object checked?

#### 2.6 — Code Duplication & Dead Code
- Identify duplicated business logic between:
  - Client-side `deal-scoring-v5.ts` and the `score-buyer-deal` edge function
  - Multiple CSV import files in `src/lib/deal-csv-import/`
  - `outreach_records` vs `remarketing_outreach` tracking systems
  - Analytics hooks that overlap in functionality
- Find dead code: unused components, unreachable routes, commented-out blocks, TODO/FIXME items.
- Check `src/pages/Dashboard.tsx` (749 bytes) — is this legacy/unused?

---

### SECTION 3: DATABASE & DATA INTEGRITY AUDIT

#### 3.1 — Schema Review
- Review the latest migration files in `supabase/migrations/`. Check for:
  - Missing foreign key constraints between related tables
  - Missing indexes on frequently queried columns (especially `user_id`, `listing_id`, `status`, `created_at`)
  - Nullable columns that should be NOT NULL
  - Missing `ON DELETE CASCADE` or `ON DELETE SET NULL` for dependent records
  - Orphaned tables with no references

#### 3.2 — Migration Health
- Are migrations idempotent? Can they be re-run safely?
- Are there any destructive migrations (DROP TABLE, DROP COLUMN) without data backup steps?
- Check the latest migrations (Feb 2026) for the buyer enrichment queue fixes — are these stable?
- Is there a rollback strategy documented for each migration?

#### 3.3 — Data Consistency
- Check: When a listing is deleted, are related `connection_requests`, `saved_listings`, `deal_scores`, and `outreach_records` properly cleaned up?
- Check: When a user is deleted, is their PII removed from all tables (GDPR right to erasure)?
- Review the `profile-self-heal.ts` logic — under what conditions does it create profiles? Can it create duplicate or corrupt profiles?
- Check: Are there listings with `status = 'active'` but missing required fields?

#### 3.4 — Query Performance
- Identify the most expensive queries (full table scans, missing indexes, large JOINs).
- Check: Are marketplace listing queries paginated or do they load all active listings?
- Review admin dashboard queries — do analytics queries scan entire tables?
- Check React Query `staleTime` and `gcTime` settings — are there queries that should be more/less aggressive with caching?

---

### SECTION 4: PERFORMANCE AUDIT

#### 4.1 — Bundle Size & Code Splitting
- Analyze the Vite build output. What is the total bundle size?
- Are the three subsystems (Marketplace, Remarketing, M&A Intelligence) properly code-split?
- Review `lazyWithRetry` — does the chunk retry logic mask deployment issues?
- Check: Are heavy libraries (Recharts, TipTap, Mapbox GL, DnD-kit) tree-shaken and lazy-loaded?
- Review `index.html` — how many third-party scripts are loaded synchronously? (GA4, GTM, Heap, Hotjar, LinkedIn, Brevo) What is the performance impact?

#### 4.2 — Runtime Performance
- Check for unnecessary re-renders:
  - Are Context providers wrapping too many children?
  - Are there memoization opportunities in list renders (`ListingCard` in marketplace grid)?
  - Is `Profile.tsx` re-rendering the entire 62KB form on each field change?
- Check for memory leaks:
  - Are Supabase real-time subscriptions properly cleaned up in `useEffect` return functions?
  - Are `setInterval`/`setTimeout` cleaned up?
  - Are event listeners removed on unmount?

#### 4.3 — Network Performance
- Count the number of Supabase queries fired on initial page load for: Welcome, Marketplace, ListingDetail, AdminDashboard.
- Are there waterfall request patterns (sequential queries that could be parallelized)?
- Is there optimistic UI for mutations (connection requests, saves, profile updates)?
- Check: Are images optimized? Is there lazy loading for listing images?

---

### SECTION 5: TESTING AUDIT

#### 5.1 — Current State
- There is currently **one test file**: `src/lib/deal-scoring-v5.test.ts`. Run it and report results.
- Review `SMOKE_TESTS.md` — is the manual test checklist comprehensive?

#### 5.2 — Critical Test Gaps
For each gap, write a specific test case description (don't implement, just describe):
- **Auth flow**: Signup → email verification → pending approval → admin approves → marketplace access
- **Auth edge cases**: Expired JWT, revoked session, concurrent logins, password reset mid-session
- **RLS enforcement**: Non-admin user attempts to access admin-only data via direct Supabase queries
- **Marketplace**: Filter combinations, empty state, pagination, stale data recovery
- **Connection request flow**: Request → admin review → approve/reject → email notification
- **Deal scoring**: Edge cases in `deal-scoring-v5.ts` (missing fields, boundary values, negative scores)
- **Profile update**: Concurrent saves, field validation, privileged field protection
- **Edge functions**: Auth validation, input sanitization, error responses, rate limiting
- **Real-time subscriptions**: Connection drops, reconnection, stale state

#### 5.3 — Recommended Test Strategy
Propose a phased testing plan:
- **Phase 1** (Critical path): Auth, RLS, connection requests, profile security
- **Phase 2** (Core features): Marketplace, deal detail, filters, search
- **Phase 3** (Admin): Listing CRUD, user management, pipeline
- **Phase 4** (Subsystems): Remarketing, M&A Intelligence, enrichment
- Include tool recommendations (Vitest, Playwright, MSW for API mocking).

---

### SECTION 6: PRODUCTION READINESS CHECKLIST

Rate each item as ✅ Ready, ⚠️ Needs Work, or ❌ Not Ready:

1. **Security**: RLS policies cover all tables
2. **Security**: Edge functions validate auth on every request
3. **Security**: No secrets in client-side code or git history
4. **Security**: Input validation on all user-facing forms (client + server)
5. **Security**: XSS prevention on all rendered HTML content
6. **Reliability**: Error boundaries prevent white screens
7. **Reliability**: Failed chunk loads recovered via `lazyWithRetry`
8. **Reliability**: Supabase connection failures handled gracefully
9. **Reliability**: Edge function failures don't break the UI
10. **Performance**: Initial load under 3 seconds on 3G
11. **Performance**: Marketplace renders 100+ listings without jank
12. **Performance**: Admin dashboard queries return in under 2 seconds
13. **Data**: All migrations are reversible
14. **Data**: GDPR data deletion capability exists
15. **Data**: Backup and recovery strategy documented
16. **Monitoring**: Error tracking captures all unhandled exceptions
17. **Monitoring**: Performance metrics (Web Vitals) are tracked
18. **Monitoring**: Uptime monitoring on critical paths
19. **Testing**: Critical auth flows have automated tests
20. **Testing**: RLS policies have automated tests
21. **DevOps**: CI/CD pipeline runs tests before deploy
22. **DevOps**: Staging environment mirrors production
23. **Documentation**: API contracts documented for edge functions
24. **Documentation**: Database schema documented with ERD
25. **Documentation**: Runbook for common production issues

---

### SECTION 7: EXECUTIVE SUMMARY (Required Output Format)

After completing all sections above, provide:

#### 7.1 — Risk Matrix
| Finding | Severity | Impact | Likelihood | Effort to Fix |
|---------|----------|--------|------------|---------------|
| [Finding] | P0/P1/P2/P3 | High/Med/Low | High/Med/Low | Hours/Days/Weeks |

#### 7.2 — Top 5 "Fix Before Launch" Items
Numbered list with specific remediation steps and file paths.

#### 7.3 — Top 5 "Fix Within 30 Days" Items
Numbered list with specific remediation steps.

#### 7.4 — Technical Debt Score
Rate the overall technical debt on a scale of 1-10 (1 = pristine, 10 = rewrite needed). Break down by:
- Security debt: X/10
- Architecture debt: X/10
- Testing debt: X/10
- Performance debt: X/10
- Documentation debt: X/10

#### 7.5 — Strengths
List the top 5 things the codebase does well.

#### 7.6 — Recommendation
One paragraph: Is this codebase ready for production scale? What is the single most important investment to make in the next 90 days?

---

## PROMPT END
