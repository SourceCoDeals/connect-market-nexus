
Root cause is now clear and it’s a two-part failure:

1) Database regression: `check_agreement_coverage()` still references `public.generic_email_domains`, but that table was dropped by migration `20260503000000_drop_unused_tables.sql`.  
- This causes `42P01 relation "public.generic_email_domains" does not exist` during agreement checks.
- That breaks the agreement pipeline used by connection requests.

2) UX/gating gap: Marketplace card flow does not NDA-gate before opening request dialog, so users can still submit and hit backend failure.  
- Listing card actions currently gate buyer type/profile/fee only (no NDA gate).
- Error toast often shows generic “Failed to request connection” instead of actionable reason.

Implementation plan

1) Restore and harden agreement domain dependency (new migration)
- File: `supabase/migrations/<new>_restore_generic_email_domains_and_harden_coverage.sql`
- Recreate `public.generic_email_domains` (if missing), restore RLS/policies/grants, reseed common domains.
- Recreate `public.check_agreement_coverage()` with defensive logic:
  - If `generic_email_domains` exists, use table lookup.
  - If missing, fallback to built-in generic-domain array (prevents future hard outage).
- Keep `search_path = public` and current return schema unchanged.

2) Ensure NDA signing gate actually appears for unsigned buyers on listing detail
- File: `src/pages/ListingDetail.tsx`
- Update `showNdaGate` condition to not require `agreementStatus.firm_id` (gate should trigger on unsigned NDA regardless of source).
- This allows Gmail/generic-domain users to reach signing flow via `NdaGateModal`.

3) Make NdaGateModal independent from pre-resolved firm_id in UI
- File: `src/components/pandadoc/NdaGateModal.tsx`
- Make `firmId` prop optional (or remove from gate condition usage), since edge function already resolves canonical firm server-side (`resolve_user_firm_id` + self-heal).
- Keep current query invalidations after signing.

4) Add NDA gate to marketplace card request flow (prevent submit-then-fail path)
- Files:
  - `src/components/ListingCard.tsx`
  - `src/components/listing/ListingCardActions.tsx`
- Pass NDA coverage/loading state into card actions.
- Block opening `ConnectionRequestDialog` when NDA is not covered.
- Show clear inline CTA/state like “Sign NDA to Request Access” and route user to listing detail for signing flow.

5) Improve surfaced error messages from request mutation
- File: `src/hooks/marketplace/use-connections.ts`
- Replace `error instanceof Error ? ... : 'Failed...'` with robust extractor for PostgREST error objects (`message`, `details`, etc.).
- Users should see specific server reason (e.g., NDA required) when backend blocks request.

Verification plan (end-to-end)
1) Re-test with `adambhaile00@gmail.com`:
- Marketplace card should not open request dialog before NDA.
- Listing detail should show NDA gate modal directly.
- After signing NDA, gate clears and request proceeds (or moves to fee gate if needed).

2) Confirm DB health:
- `check_agreement_coverage('adambhaile00@gmail.com','nda')` executes without 42P01.
- `enhanced_merge_or_create_connection_request` no longer fails due missing table.

3) Regression checks:
- Admin bypass still works.
- Corporate-domain users with signed coverage can request normally.
- Unsigned users see actionable guidance, not generic failure toast.
