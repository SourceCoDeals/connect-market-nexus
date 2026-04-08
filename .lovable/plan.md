

## Investigation: Profile Data Integrity and Admin Display

### Findings

**1. Double-dollar formatting bug in admin user profile (CONFIRMED)**

In `UserDetails.tsx` lines 177-190, `revenue_range_min` and `revenue_range_max` are rendered as:
```ts
const numValue = fieldValue as number;
return <div>...: {numValue ? `$${numValue.toLocaleString()}` : '—'}</div>
```

But these fields are stored in the DB as **text strings** like `"$10M - $25M"` (from the `REVENUE_RANGES` select options). The `as number` cast doesn't convert anything — the string is truthy, so it renders `$` + `"$10M - $25M"` = `"$$10M - $25M"`.

**Fix:** Remove the `$` prefix for these fields since the stored values already contain `$`. Use the `formatFieldValue` default path instead, or render the string value directly.

**2. Profile data pipeline is intact (NO ISSUE)**

- Signup stores data correctly to `profiles` table via `updateUser` metadata then `selfHealProfile`.
- Profile form (`ProfileForm.tsx` + `ProfileSettings.tsx`) covers ALL buyer-type-specific fields for every persona.
- `updateUserProfile` in `use-nuclear-auth.ts` does a generic `.update(dbPayload)` and strips only privileged fields — all other fields pass through correctly.
- Admin query uses `select('*')` and `createUserObject` maps every relevant field.
- All profiles use camelCase buyer types, matching the conditional rendering in the profile form.

**3. No missing fields in the admin display (NO ISSUE)**

The `getFieldCategories` function in `buyer-type-fields.ts` defines complete field sets for each buyer type across 4 categories: Contact Information, Business Profile, Financial Information, Sourcing & Discovery. All fields from the profile form are represented.

### Plan

**Single file change: `src/components/admin/users-table/UserDetails.tsx`**

Fix lines 177-190: Instead of treating `revenue_range_min`/`revenue_range_max` as numeric values and prepending `$`, render the stored string value directly (it already contains currency formatting like `"$10M - $25M"`). For actual numeric values (e.g., from old data), keep the `$` prefix logic. For `target_deal_size_min`/`target_deal_size_max` (which ARE numeric in the DB schema), keep the existing numeric formatting.

```
// Before:
const numValue = fieldValue as number;
return <div>...: {numValue ? `$${numValue.toLocaleString()}` : '—'}</div>

// After: Split handling — revenue ranges are text, deal sizes are numeric
if (fieldKey === 'revenue_range_min' || fieldKey === 'revenue_range_max') {
  return <div>...: {fieldValue ? String(fieldValue) : '—'}</div>
}
if (fieldKey === 'target_deal_size_min' || fieldKey === 'target_deal_size_max') {
  const numValue = Number(fieldValue);
  return <div>...: {numValue ? `$${numValue.toLocaleString()}` : '—'}</div>
}
```

This is a single, small fix. Everything else in the save/load pipeline is working correctly.

