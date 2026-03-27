

# Phase 10: RPC Resilience for Remaining `get_user_firm_agreement_status` Callers

## What's Verified Working (Phases 1-9)
All connection request gates, `on_hold` support, profile deep-linking, password verification, document signing buttons, admin notification routing, and `use-pandadoc.ts` resilience are confirmed implemented and working.

## Remaining Issue: Two More Callers of `get_user_firm_agreement_status` Without Error Handling

The `get_user_firm_agreement_status` RPC returns 400 in production. In Phase 7 we hardened `use-pandadoc.ts` to catch this and return safe defaults. However, two other callers still throw unhandled errors:

### Caller 1: `src/pages/BuyerMessages/useMessagesData.ts` — `useFirmAgreementStatus()`
- Line 166: calls `supabase.rpc('get_user_firm_agreement_status', ...)` with no error catch
- When it throws, `PendingAgreementBanner` receives `undefined` and renders nothing (line 66: `if (!firmStatus) return null`)
- This silently hides the agreement signing banner from the Messages page
- React Query retries the failing call, generating console 400 errors on every page view

### Caller 2: `src/hooks/admin/use-user-firm.ts` — `useUserFirm()`
- Line 24: same unhandled RPC call
- Used by admin components: `DealFirmInfo`, `UserFirmBadge`, `DualNDAToggle`, `DualFeeAgreementToggle`
- When it throws, firm badges and agreement toggles show loading spinners indefinitely

## Fix Plan

### File 1: `src/pages/BuyerMessages/useMessagesData.ts`
- In `useFirmAgreementStatus` queryFn: wrap the RPC call in try/catch
- On 400/404 error, return `null` instead of throwing (matches existing `if (!firmStatus) return null` guard)
- Set `retry: false` to prevent console spam

### File 2: `src/hooks/admin/use-user-firm.ts`
- In `useUserFirm` queryFn: wrap the RPC call in try/catch
- On 400/404 error, return `null` instead of throwing
- Set `retry: false` for RPC errors

Both fixes use the same pattern already established in `use-pandadoc.ts` (Phase 7).

## Files Changed

| File | Change |
|------|--------|
| `src/pages/BuyerMessages/useMessagesData.ts` | Add error handling + retry guard to `useFirmAgreementStatus` |
| `src/hooks/admin/use-user-firm.ts` | Add error handling + retry guard to `useUserFirm` |

