# Bugs Found & Fixed (Platform Audit Sprint)

**Date:** February 25, 2026
**Scope:** Comprehensive platform audit

---

## Critical Issues

### Issue 1: Missing Authorization in find-buyer-contacts Edge Function

- **Severity:** CRITICAL
- **File:** `supabase/functions/find-buyer-contacts/index.ts` line 6
- **Problem:** The `find-buyer-contacts` edge function had NO authorization check. Anyone with the function URL and a valid buyerId could trigger AI-powered contact discovery using Firecrawl and Gemini APIs, potentially exposing buyer data and consuming API credits.
- **Fix:** Added `requireAdmin()` authorization check at function entry. Non-admin users now receive 401/403 responses. Imported `requireAdmin` from shared auth module and created admin Supabase client for role verification.
- **Status:** FIXED

---

## High Priority Issues

### Issue 1: Missing Tools in Router System Prompt

- **Severity:** HIGH
- **File:** `supabase/functions/ai-command-center/router.ts` line 869
- **Problem:** Three enrichment tools (`enrich_linkedin_contact`, `find_and_enrich_person`, `find_contact_linkedin`) were used in bypass rules but missing from the Available tools list in ROUTER_SYSTEM_PROMPT. This caused the LLM fallback classifier to be unaware of these tools, potentially misrouting 5-15% of enrichment queries that didn't match bypass rules.
- **Fix:** Added the 3 missing tools to the Available tools list in the system prompt. Tool count went from 79 to 82.
- **Status:** FIXED

---

## Medium Priority Issues

### Issue 1: use-simple-pagination Tests Missing Router Wrapper

- **Severity:** MEDIUM
- **File:** `src/hooks/use-simple-pagination.test.ts`
- **Problem:** All 6 tests failed with `useLocation() may be used only in the context of a <Router> component`. The hook uses `useSearchParams` from react-router-dom but `renderHook` was called without providing a Router context wrapper.
- **Fix:** Added a `MemoryRouter` wrapper to all `renderHook` calls using `React.createElement(MemoryRouter, null, children)` pattern (required since file is `.ts` not `.tsx`).
- **Status:** FIXED

### Issue 2: DocuSealSigningPanel Test Expected Wrong Messages

- **Severity:** MEDIUM
- **File:** `src/components/docuseal/DocuSealSigningPanel.test.tsx` line 74
- **Problem:** The "shows signed state after form completion" test expected NDA-specific messages ("NDA signed -- you're in.", "Full access unlocked") but the component's default props use generic messages ("Document signed successfully.", "Your access has been updated.").
- **Fix:** Updated test assertions to match the component's actual default prop values.
- **Status:** FIXED

### Issue 3: ListingCardTitle Test Fails Due to Dual-Package Module Issue

- **Severity:** MEDIUM
- **File:** `src/components/listing/ListingCardTitle.test.tsx` line 17
- **Problem:** The "shows pending status when connection is pending" test failed with `Cannot destructure property 'basename' of 'React__namespace.useContext(...)' as it is null` because react-router-dom's `Link` component (loaded as UMD) uses a different React context instance than the `MemoryRouter` wrapper (loaded as ESM).
- **Fix:** Mocked react-router-dom's `Link` component as a plain `<a>` element in the test file, since the test only verifies text content rendering, not navigation behavior.
- **Status:** FIXED

### Issue 4: Test Utils Using BrowserRouter Instead of MemoryRouter

- **Severity:** MEDIUM
- **File:** `src/test/test-utils.tsx` line 5
- **Problem:** Test wrapper used `BrowserRouter` which depends on browser-specific history APIs not fully available in jsdom test environment. `MemoryRouter` is the recommended approach for testing per React Router documentation.
- **Fix:** Changed `BrowserRouter` import and usage to `MemoryRouter` in the test utility wrapper.
- **Status:** FIXED

---

## Low Priority Issues

None found.

---

## Summary

| Severity  | Found | Fixed |
| --------- | ----- | ----- |
| Critical  | 1     | 1     |
| High      | 1     | 1     |
| Medium    | 4     | 4     |
| Low       | 0     | 0     |
| **Total** | **6** | **6** |

All discovered issues have been fixed and verified. Test suite passes at 100% (876/876 tests).
