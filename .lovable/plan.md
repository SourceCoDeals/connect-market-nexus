

# End-to-End Testing Results — Issues Found & Fixes Required

## Test Summary

Tested as buyer user `adambhaile00@gmail.com` across marketplace, listing detail, My Deals, and Profile.

### What Works
- Login flow: credentials accepted, "Welcome back" toast, redirect to marketplace
- Marketplace: 61 listings load, filters render, search works, pagination present
- Listing detail: full page renders with deal info, financial grid, investment fit score, save/share buttons
- My Deals: 3 deals shown correctly (2 rejected, 1 connected), documents section, deal details, activity tabs
- Profile tabs: Profile Information, Documents, Deal Alerts, Team, Notifications, Security — all render
- Security tab: Change Password form, Account & Privacy section visible
- Documents tab: "No signed documents" empty state renders correctly
- Connection request dialog: opens, shows AI draft button, 20-char minimum enforced

### Issues Found

---

## Issue 1: `get_my_agreement_status` RPC — 404 (CRITICAL)

**Evidence**: Console shows repeated 404 errors on every page load:
```
Failed to load resource: 404 - /rest/v1/rpc/get_my_agreement_status
```

**Impact**: The fee agreement gate in `ConnectionButton.tsx` (line 40-51) calls `useMyAgreementStatus()`. When the RPC doesn't exist, the query throws, React Query retries, and `coverage` remains `undefined`. The fee gate check `if (!isAdmin && coverage && !coverage.fee_covered)` evaluates as `false` because `coverage` is falsy. **Result: fee agreement gate is completely bypassed.**

**Root cause**: The `get_my_agreement_status` database function was never created or was dropped. It's defined in the TypeScript types (line 13289 of types.ts) but doesn't exist in the actual database.

**Fix**: This is a database issue. The RPC needs to be created. However, since this is a database function that likely involves complex firm-matching logic (domain matching, PE parent inheritance), we should handle the 404 gracefully in the frontend rather than trying to recreate the entire RPC logic:

- In `use-agreement-status.ts`: catch 404 errors and return a **safe default** (fee_covered: false, nda_covered: false) instead of throwing. This way the fee gate will correctly show "Fee Agreement Required" rather than silently passing.

---

## Issue 2: `get_user_firm_agreement_status` RPC — 400 (CRITICAL)

**Evidence**: Console shows 400 errors:
```
Failed to load resource: 400 - /rest/v1/rpc/get_user_firm_agreement_status
```

**Impact**: `useBuyerNdaStatus()` in `use-pandadoc.ts` calls this RPC. When it returns 400, `ndaStatus` is undefined, so:
- The NDA gate check `ndaStatus && ndaStatus.hasFirm && !ndaStatus.ndaSigned` evaluates false — **NDA gate is bypassed**
- The fee gate fallback `ndaStatus?.firmId` is undefined — **fee gate can't render the PandaDoc embed**

**Fix**: Same approach — handle 400 gracefully in the hook. Return safe defaults so gates activate properly.

---

## Issue 3: Session Heartbeat — 401 on First Call

**Evidence**: Console shows:
```
Heartbeat failed: Edge Function returned a non-2xx status code (401)
```

**Impact**: Minor — heartbeat eventually succeeds after token refresh. But it fires too early before the JWT is fully settled.

**Fix**: In `use-session-heartbeat.ts`, add a short delay or check for valid session before first heartbeat call. Non-blocking issue.

---

## Issue 4: `get_my_agreement_status` called on every navigation

**Evidence**: The 404 error appears 8+ times across different page navigations. React Query retries the failing RPC on every page.

**Fix**: In `use-agreement-status.ts`, set `retry: false` when the error is a 404 (function not found). This prevents wasteful retries.

---

## Recommended Fix Plan

### File 1: `src/hooks/use-agreement-status.ts`
- Catch 404 errors in `queryFn` and return safe defaults (`fee_covered: false`, `nda_covered: false`) instead of throwing
- Add `retry: (count, error) => ...` to skip retries on 404
- This makes the fee gate work correctly even when the RPC is missing

### File 2: `src/hooks/admin/use-pandadoc.ts` (the `useBuyerNdaStatus` hook)
- Catch 400 errors in `queryFn` and return safe defaults (`hasFirm: false`, `ndaSigned: false`, `firmId: null`)
- Add retry guard for 400 errors

### File 3: `src/hooks/use-session-heartbeat.ts`
- Add initial delay or session-ready check before first heartbeat

These are frontend resilience fixes. The underlying database RPCs (`get_my_agreement_status`, `get_user_firm_agreement_status`) should be investigated separately — they either need to be created or their signatures fixed. But the frontend should handle their absence gracefully.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/use-agreement-status.ts` | Handle 404 gracefully, return safe defaults, disable retry on 404 |
| `src/hooks/admin/use-pandadoc.ts` | Handle 400 in `useBuyerNdaStatus`, return safe defaults |
| `src/hooks/use-session-heartbeat.ts` | Add session-ready guard before first heartbeat |

