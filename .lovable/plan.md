

# Audit: All Planned Fixes — Verified & Remaining Issues

## Confirmed Implemented

| Fix | Status | Evidence |
|-----|--------|----------|
| `useMemo` → `useEffect` for page reset | Done | Line 93: `useEffect` with proper deps |
| `React.memo` on `BuyerTierBadge` | Done | Line 24: `React.memo(function BuyerTierBadge` |
| `React.memo` on `BuyerTierBadgeFull` | Done | Line 59 |
| `React.memo` on `BuyerScoreBadge` | Done | Line 79 |
| `React.memo` on `UserFirmBadge` | Done | Line 14 |
| `React.memo` on `DualFeeAgreementToggle` | Done | Line 18 |
| `React.memo` on `DualNDAToggle` | Done | Line 18 |
| Inline closures removed | Done | Lines 252/260 now use `setSelectedUserForEmail` directly |
| Stable query key | Done | Line 27 of `use-bulk-user-firms.ts` |
| Map-based role lookup | Done | Lines 70-80 of `UsersTable.tsx` |
| `firmDataMap ?? new Map()` default | Done | Line 499 of `AdminUsers.tsx` |
| `undefined` in UserFirmBadge | Done | Line 16 |
| Removed `useEnhancedUserExport` | Done | Not in imports |
| Removed `usePermissions` | Done | Not in imports |

## Remaining Issue: `useRoleManagement()` fetches audit log unnecessarily

`useRoleManagement()` (line 68 of `UsersTable.tsx`) always fetches **100 audit log rows** via `get_permission_audit_log` RPC. UsersTable never uses `auditLog` or `isLoadingAudit` — it only needs `allUserRoles` and `isLoadingRoles`. This is a wasted query on every table mount.

### Fix

Split the hook: create a lightweight `useAllUserRoles()` that only fetches roles, and use it in `UsersTable` instead of `useRoleManagement()`. Keep `useRoleManagement` intact for the permissions management page where the audit log is actually needed.

### File 1: `src/hooks/permissions/useAllUserRoles.ts` (NEW)

Extract the `allUserRoles` query into its own hook:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UserRoleEntry } from './useRoleManagement';

export function useAllUserRoles() {
  const { data: allUserRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_user_roles');
      if (error) throw error;
      return data as UserRoleEntry[];
    },
    staleTime: 1000 * 60 * 5,
  });
  return { allUserRoles, isLoadingRoles };
}
```

### File 2: `src/components/admin/UsersTable.tsx`

Replace `useRoleManagement` import with `useAllUserRoles`:

```ts
// Before
import { useRoleManagement } from '@/hooks/permissions/useRoleManagement';
const { allUserRoles, isLoadingRoles } = useRoleManagement();

// After
import { useAllUserRoles } from '@/hooks/permissions/useAllUserRoles';
const { allUserRoles, isLoadingRoles } = useAllUserRoles();
```

## Summary

All 14 planned optimizations from the previous rounds are verified implemented. The one remaining issue is the unnecessary audit log fetch — a small but clean fix that eliminates 1 RPC call returning 100 rows on every table mount.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/permissions/useAllUserRoles.ts` | NEW — lightweight roles-only hook |
| `src/components/admin/UsersTable.tsx` | Switch from `useRoleManagement` to `useAllUserRoles` |

