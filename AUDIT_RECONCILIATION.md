# Audit Reconciliation: Code-Level Findings vs. Platform Audit

**Date:** 2026-02-20
**Purpose:** Reconcile the existing Platform Audit Report with code-level verification findings. Flag discrepancies, confirm accurate assessments, and surface critical findings missed by the initial audit.

---

## Critical Discrepancy: Security Rating

| Assessment | Existing Audit | Code-Level Finding |
|-----------|----------------|-------------------|
| **Security & Auth** | "SOLID" | **CRITICAL — 3 vulnerabilities require immediate remediation** |
| CORS | "CORS properly configured" | **93 of 108 edge functions use `Access-Control-Allow-Origin: *`** |
| Data isolation | "Anonymous/real separation exists" | **`SELECT *` returns ALL 170 columns (including confidential data) to marketplace buyers** |
| RLS | Not detailed | **RLS policy does NOT enforce `is_internal_deal`, only checks `status` and `deleted_at`** |
| Auth on edge functions | "Admin role checks on all edge functions" | **3 edge functions have NO authentication: `enrich-session-metadata`, `error-logger`, `session-heartbeat`** |

### Evidence

**CORS — 93 wildcard vs 15 using shared module:**
```
# Files with Access-Control-Allow-Origin: *
$ grep -rl "Access-Control-Allow-Origin.*\*" supabase/functions/ | wc -l
93

# Files using the proper shared CORS module (getCorsHeaders)
$ grep -rl "getCorsHeaders\|corsPreflightResponse" supabase/functions/ | wc -l
16  (includes _shared/cors.ts itself)
```

The shared module at `supabase/functions/_shared/cors.ts` implements a proper origin allowlist:
```typescript
// _shared/cors.ts:13-19
const DEFAULT_ALLOWED_ORIGINS = [
  "https://connect-market-nexus.lovable.app",
  "https://app.sourcecoconnect.com",
  "https://sourcecoconnect.com",
  "http://localhost:5173",
  "http://localhost:3000",
];
```

But 93 functions ignore it and hardcode:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Data exposure — SELECT * returns confidential columns:**
```typescript
// src/hooks/marketplace/use-listings.ts:33-35
let query = supabase
  .from('listings')
  .select('*, hero_description', { count: 'exact' });
```

This returns ALL 170 columns to any authenticated marketplace buyer, including:
- `internal_company_name` — the real company name
- `website` — the real company website
- `main_contact_name`, `main_contact_email`, `main_contact_phone` — real contacts
- `internal_notes` — admin-only notes
- `address_street`, `address_city`, `address_state`, `address_zip` — real address
- `internal_salesforce_link`, `internal_deal_memo_link` — internal links

RLS in PostgreSQL is **row-level only** — it cannot filter columns. The frontend displays only anonymous fields, but any buyer who opens browser DevTools (Network tab) sees everything.

**RLS missing `is_internal_deal` check:**
```sql
-- Active RLS policy (from migration 20251006114111):
CREATE POLICY "Approved users can view active listings based on buyer type"
ON public.listings FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
      AND approval_status = 'approved' AND email_verified = true)
    AND status = 'active'
    AND deleted_at IS NULL
    AND (visible_to_buyer_types IS NULL ...)
  )
);
```

Note: NO check for `is_internal_deal = false`. An authenticated buyer can query internal/remarketing deals directly via the Supabase JS client, bypassing the frontend filter.

The `20260220200000_definitive_restore_marketplace.sql` migration correctly removed the overly-permissive `listings_select_policy`, but the remaining policy still doesn't enforce `is_internal_deal`.

**Unauthenticated edge functions:**

`enrich-session-metadata/index.ts` — No auth header check, no user verification, no admin check. Accepts arbitrary `batchSize` and `maxBatches` params. Can modify ALL user sessions.

`error-logger/index.ts` — No auth check. Accepts arbitrary error data with any `user_id`. Can pollute error logs and impersonate users.

`session-heartbeat/index.ts` — Accepts `session_id` without verifying ownership. Client can set `user_id` to any value.

---

## Findings Confirmed as Accurate

The following findings from the existing audit are **verified and accurate** by code-level review:

| # | Finding | Verified | Notes |
|---|---------|----------|-------|
| F01 | AllDeals reads wrong table | **YES** | `AllDeals.tsx:48-64` defines `DealRow` with `company_website`, `geography`, `revenue`, `ebitda_amount` — fields on `listings`, not `deals` |
| F02 | Duplicate pages everywhere | **YES** | MA Intelligence routes still exist at `App.tsx:260-270`. Deal routes redirect (`App.tsx:268-269`) but buyer/tracker pages are live and separate |
| F03 | Enrich All bulk timeout | **YES** | `process-enrichment-queue/index.ts:19` — `MAX_FUNCTION_RUNTIME_MS = 140000`. Self-continuation exists but has no max invocation limit |
| F04 | Website not required | **YES** | `listings.website` is `string | null` in types. Index only covers non-null values |
| F05 | No cross-source domain dedup | **YES** | `sync-captarget-sheet` dedupes within CapTarget only. No cross-source check |
| F06 | Scoring references dead fields | **YES** | `score-buyer-deal/index.ts:1548` — `revenue_sweet_spot`, `ebitda_sweet_spot` still in fallback. `key_quotes` at line 1429 in data completeness but DROPPED per `20260221000000` migration |
| F07 | Two buyer systems not linked | **YES** | `profiles` (marketplace) and `remarketing_buyers` (outbound) — no FK relationship |
| F08 | 21 email functions, no templates | **YES** | 24 total send/notify functions. Each builds own HTML. Only `enhanced-admin-notification` has retry logic |
| F10 | No enrichment failure dashboard | **YES** | `enrichment_events` table populated but no admin UI reads it |
| F11 | AI scoring non-determinism | **YES** | 3 Gemini calls per score (service, owner_goals, thesis). No temperature=0 or seed parameter |
| F15 | Duplicate notification functions | **YES** | `admin-notification` proxies to `enhanced-admin-notification`. `send-email-notification` and `send-notification-email` both deprecated wrappers |
| F16 | Potentially dead tables | **YES** | `TestingSuite.tsx` orphaned (no route). `send-verification-email` returns 410. Several analytics tables types-only |

---

## New Findings NOT in Existing Audit

These were discovered during code-level analysis and are absent from the existing audit:

| # | SEV | Finding | Location | Business Impact |
|---|-----|---------|----------|-----------------|
| **N01** | **CRITICAL** | 93 edge functions use wildcard CORS (`*`) | All `supabase/functions/*/index.ts` except 15 | Any website can make authenticated API calls on behalf of logged-in users. Enables CSRF, data exfiltration. |
| **N02** | **CRITICAL** | `SELECT *` exposes all 170 columns to marketplace buyers | `src/hooks/marketplace/use-listings.ts:34` | Buyer with DevTools sees real company name, website, contacts, internal notes. Undermines anonymous marketplace model. |
| **N03** | **CRITICAL** | RLS missing `is_internal_deal = false` | `20251006114111` migration | Authenticated buyer can query internal/remarketing deals directly via Supabase client. |
| **N04** | **HIGH** | 3 unauthenticated edge functions | `enrich-session-metadata`, `error-logger`, `session-heartbeat` | Session data corruption, log poisoning, analytics manipulation. |
| **N05** | **HIGH** | Bulk delete: 27 sequential DB calls per deal | `ReMarketingDeals.tsx:749-771` | Deleting 10 deals = 270 DB round trips. Multi-minute blocking operation. |
| **N06** | **HIGH** | Enrichment queue infinite continuation | `process-enrichment-queue/index.ts:482-517` | No max invocation limit. Failing items cause infinite loop, accumulating costs. |
| **N07** | **HIGH** | 22 of 24 email functions have no retry logic | All `send-*` except `enhanced-admin-notification` | Transient Brevo failure = permanent email loss (NDAs, deal alerts, approvals). |
| **N08** | **HIGH** | Hardcoded email recipients | `send-owner-inquiry-notification:134`, `enhanced-admin-notification:84,127` | `ahaile14@gmail.com` and `admin@yourdomain.com` hardcoded in production. |
| **N09** | **MEDIUM** | Missing code splitting for Tiptap (250KB) and Mapbox (500KB+) | `package.json`, `vite.config.ts:25-29` | Only Recharts is code-split. 750KB+ loaded for all users regardless of feature usage. |
| **N10** | **MEDIUM** | Client-side-only pagination on ReMarketingDeals | `ReMarketingDeals.tsx:164-398` | Fetches ALL deals in 1000-row batches, then paginates client-side at 50/page. Scales linearly. |
| **N11** | **MEDIUM** | `esbuild.drop` strips ALL console output in production | `vite.config.ts:34` | `drop: ['console', 'debugger']` removes `console.error` and `console.warn`, eliminating client-side error reporting. |
| **N12** | **MEDIUM** | Rate limiting fails open on DB error | `_shared/security.ts:76-77` | If `user_activity` table query fails, rate limiting bypassed (`allowed: true`). Under DB pressure, all AI cost protection removed. |
| **N13** | **LOW** | Localhost in production CORS allowlist | `_shared/cors.ts:17-18` | `http://localhost:5173` and `http://localhost:3000` in the production origin list. |

---

## Revised Severity Assessment

Combining both audits, here is the corrected platform health scorecard:

| System | Existing Rating | Revised Rating | Reason for Change |
|--------|----------------|----------------|-------------------|
| Deal Intake & Enrichment | NEEDS WORK | NEEDS WORK | Confirmed. N06 adds infinite continuation risk. |
| Buyer-Deal Scoring | STRONG | STRONG | Confirmed. Dead field refs (F06) are the only issue. |
| Marketplace (Buyer-Facing) | SOLID | **CRITICAL** | N02 (SELECT *) and N03 (RLS gap) expose confidential data to buyers. |
| Pipeline & Deal Management | BROKEN | BROKEN | Confirmed. |
| Buyer CRM & Agreements | NEEDS WORK | NEEDS WORK | Confirmed. |
| Transcript Intelligence | STRONG | STRONG | Confirmed. |
| Email & Notifications | FRAGMENTED | FRAGMENTED | Confirmed. N07 adds retry gap, N08 adds hardcoded recipients. |
| **Security & Auth** | **SOLID** | **CRITICAL** | N01 (wildcard CORS on 93 functions), N02 (data exposure), N03 (RLS gap), N04 (unauthed functions). |
| Data Schema & Integrity | NEEDS WORK | NEEDS WORK | Confirmed. |
| Navigation & UX | BROKEN | BROKEN | Confirmed. |
| **Performance** | *(not assessed)* | **NEEDS WORK** | N05 (bulk delete N+1), N09 (bundle size), N10 (client pagination), N11 (console stripping). |

---

## Revised Implementation Roadmap

The existing 8-week roadmap is well-structured but needs security fixes prepended as **Phase 0**:

| Phase | When | What | Findings Fixed | Effort |
|-------|------|------|----------------|--------|
| **0 (IMMEDIATE)** | **Day 1-2** | **Security hotfixes**: (1) Replace `SELECT *` with explicit safe columns in marketplace queries. (2) Add `is_internal_deal = false` to RLS policy. (3) Migrate 93 edge functions to shared CORS. (4) Add auth to `enrich-session-metadata`, `error-logger`, `session-heartbeat`. | **N01, N02, N03, N04** | **2-3 days** |
| **0.5 (Week 1)** | **Day 3-5** | **Performance hotfixes**: (1) Create `delete_listing_cascade()` stored procedure. (2) Add max continuation limit to enrichment queue. (3) Add email retry wrapper. | **N05, N06, N07** | **2-3 days** |
| 1 (Wk 1-2) | Week 1-2 | Unified Deals: Website required, domain dedup, All Deals reads from listings | F01, F04, F05 | As planned |
| 2 (Wk 2-3) | Week 2-3 | Unified Buyers: Merge buyer pages, remove dead fields, update scoring | F06, F07 | As planned |
| 3 (Wk 3-4) | Week 3-4 | Navigation cleanup: New nav, remove duplicates, redirects | F02 | As planned |
| 4 (Wk 4-5) | Week 4-5 | Enrichment reliability: Fix Enrich All, failure dashboard, email templates | F03, F08, F10, F15 | As planned |
| 5 (Wk 5-7) | Week 5-7 | Buyer experience: Onboarding, e-signature, data room | F09, F14, F17 | As planned |
| 6 (Wk 7-8) | Week 7-8 | Polish: Schema cleanup, scoring optimization, dead tables, bundle size, server-side pagination | F11, F13, F16, N09, N10, N11, N13 | Expanded |

**Key change:** Phase 0 must happen before ANY other work. The marketplace data exposure (N02) and wildcard CORS (N01) are exploitable today. These are mechanical fixes (explicit column list, one-line migration, find/replace CORS) that can be shipped in 2-3 days.

---

## Conclusion

The existing audit's business-level analysis is accurate and thorough. The scoring engine assessment (STRONG), transcript intelligence (STRONG), and the split-identity problem documentation (F01) are all well-characterized.

However, the Security rating of "SOLID" is incorrect. Code-level verification reveals 3 CRITICAL and 1 HIGH security vulnerability that were not surfaced. The most urgent is N02 (SELECT * data exposure) — this is exploitable by any approved marketplace buyer with basic browser knowledge and directly undermines SourceCo's value proposition as an anonymous deal intermediary.

The existing 8-week roadmap is the right plan. It just needs a Phase 0 security sprint prepended before structural work begins. The security fixes are low-effort (2-3 days) but high-impact — they should not wait for the Unified Deals work.

---

*Reconciliation report prepared from code-level audit of commit `839ef86` on branch `claude/sourceco-platform-audit-da4o4`*
*Session: https://claude.ai/code/session_01E1coCFYWcb9ycnSUvDvJxT*
