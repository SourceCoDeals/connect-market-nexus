

# Profile Completion: Remaining Issues to Fix

## Issues Found

### Issue 1: `company` silently stripped on profile save
In `use-nuclear-auth.ts` line 414, `'company'` is in `PRIVILEGED_FIELDS` and gets deleted from the update payload. If a user's company was empty at signup, they can **never** fill it via the profile page — yet it's a required field for completeness. The field is also rendered as `disabled` with `bg-muted/50` in `ProfileForm.tsx` (line 141-145), so the user can't even type in it.

**Fix**: Remove `'company'` from `PRIVILEGED_FIELDS` in `use-nuclear-auth.ts` AND remove the `disabled` prop + grey styling from the company input in `ProfileForm.tsx` so users can actually edit it. Keep the "contact support" note only for `buyer_type` and `email`.

### Issue 2: `EnhancedCurrencyInput` saves wrong value on blur
Line 111 in `enhanced-currency-input.tsx`: `onChange?.(displayValue)` sends the **pre-formatted display string** (which at that point still contains the old value before formatting). Should be `onChange?.(digits)` to save the clean numeric value.

### Issue 3: Auth context `user` object is stale after save — gates don't update
After saving the profile, `updateUserProfile` in `use-nuclear-auth.ts` re-fetches the profile from DB and calls `setUser()`. However, the `ConnectionButton` and `ListingCard` both read `user` from `useAuth()`. If the user saves their profile on `/profile` and then navigates back to a listing, the `user` object should be fresh. This part actually works — `setUser` updates context. **No fix needed here** as long as the save actually persists the data (which Issues 1 & 2 block).

### Issue 4: Profile banner uses `mergedUser` but `ConnectionButton` uses auth `user`
After the user fills fields on the profile form, the banner says "100% complete" (because it merges `formData`). But if they don't click Save, the auth `user` is still stale — they go back to a listing and see "Complete Your Profile" again. This is expected behavior (they need to save), but could be confusing.

**Fix**: After successful save, the profile page should show a clear success state. Already done via toast — acceptable.

## Plan — 3 Files

### File 1: `src/hooks/use-nuclear-auth.ts`
- Remove `'company'` from the `PRIVILEGED_FIELDS` array (line 414)

### File 2: `src/pages/Profile/ProfileForm.tsx`
- Remove `disabled` and `className="bg-muted/50"` from the company `<Input>` (lines 145-146)
- Remove the "contact support" helper text under company (lines 148-153)
- Add `onChange={onInputChange}` to the company input

### File 3: `src/components/ui/enhanced-currency-input.tsx`
- Line 111: Change `onChange?.(displayValue)` to `onChange?.(digits)` so the raw numeric string is saved to the database, not a comma-formatted display string

Three files, three targeted fixes. After these + the already-committed 90% threshold, the flow will work end-to-end: user sees missing fields → edits them on profile → saves → returns to listing → gate is cleared immediately.

