

## Fix Fee Agreement Signing + Universal Status Sync

### Root Causes Identified

**Problem 1: Edge functions not deployed**
- `get-buyer-fee-embed` has zero logs ever -- it needs to be deployed (or redeployed)
- `confirm-agreement-signed` has zero logs ever -- it also needs deployment
- Both functions exist in the codebase and config.toml but appear to have never been deployed to production

**Problem 2: Admin context panel shows stale status**
- The NDA for `adambhaile00@gmail.com` / teltonika.lt IS signed in the database (`nda_signed: true`, `nda_docuseal_status: completed`)
- But the admin Message Center Buyer Context panel (screenshot) shows "Not Sent" for both
- Root cause: The query key `thread-buyer-firm` used by `ThreadContextPanel` is NOT included in `invalidateAgreementQueries()`, so it never refreshes when signing status changes
- Similarly, `user-activity-timeline` and `user-all-threads` are not invalidated

**Problem 3: Missing realtime sync in admin thread context**
- The `ThreadContextPanel` has no realtime subscription for `firm_agreements` changes
- Even when the DB updates, the admin panel won't reflect it until a full page reload

### Fix Plan

#### 1. Deploy missing edge functions
Deploy both `get-buyer-fee-embed` and `confirm-agreement-signed` so the fee agreement signing flow actually works end-to-end.

#### 2. Add missing query keys to `invalidateAgreementQueries`
**File: `src/hooks/use-agreement-status-sync.ts`**

Add these query keys to the invalidation list:
- `thread-buyer-firm` (admin Message Center context panel)
- `user-activity-timeline` (admin timeline)
- `user-all-threads` (admin cross-deal threads)
- `user-firm` (UserFirmBadge component)
- `check-email-coverage` (admin email coverage checks)

This ensures that when any agreement status changes via realtime subscription, ALL admin and buyer screens update immediately.

#### 3. Add realtime subscription to ThreadContextPanel
**File: `src/pages/admin/message-center/ThreadContextPanel.tsx`**

Import and call `useAgreementStatusSync()` inside the `ThreadContextPanel` component so the admin context panel auto-refreshes when `firm_agreements` rows update.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/use-agreement-status-sync.ts` | Add 5 missing query keys to invalidation list |
| `src/pages/admin/message-center/ThreadContextPanel.tsx` | Add `useAgreementStatusSync()` call |
| Edge functions deployment | Deploy `get-buyer-fee-embed` and `confirm-agreement-signed` |

### What This Fixes
- Fee Agreement "Sign Now" button will actually work (function deployed)
- Signing confirmation with retry polling will work (function deployed)
- Admin Message Center context panel will show real-time agreement status
- All admin and buyer screens will stay in sync after any signing event
- The NDA status for teltonika.lt will correctly show as "Signed" in the admin context panel

