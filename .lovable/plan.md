

# Fix: Firm Association & Agreement Tracking Data Integrity

## Problem Summary

Two critical issues confirmed through database investigation:

1. **Corrupted firm associations**: The `teltonika.lt` firm has **45 members** from completely unrelated companies (Pond Street Capital, Vista Advisory Partners, Nostra Group, your test account, etc.). This happened because an old trigger was blindly assigning users to the first matching firm. Your test account (`adambhaile00@gmail.com`, company "dfdf") is a member of both the correct "dfdf" firm AND the wrong "teltonika.lt" firm.

2. **Wrong firm resolver**: `resolve_user_firm_id()` checks `connection_requests.firm_id` first (Priority 1), but the `sync_connection_request_firm` trigger calls `resolve_user_firm_id()` to SET the firm_id -- creating a **circular dependency**. Once a user gets the wrong firm on one connection request, every future request inherits the same wrong firm.

3. **Stale agreement statuses**: Because the user is linked to the wrong firm, the admin sees "NDA Signed" and "Fee Agreement Sent" (from teltonika.lt's actual agreements), while the buyer sees "not started" (their correct "dfdf" firm has no agreements).

## Root Cause

The `sync_connection_request_firm` trigger on INSERT calls `resolve_user_firm_id()`, which returns the firm from the most recent connection request. But that firm was itself set by the same trigger on a previous request -- it's self-referencing. The initial bad assignment (likely from early January before proper generic domain handling) propagated to every subsequent request.

## Plan (3 Parts)

### Part 1: Data Cleanup (SQL migration)

**Fix the corrupted teltonika.lt firm** and any other firms with obviously wrong members:

1. **Write a cleanup migration** that:
   - Identifies firm_members where the user's email domain doesn't match the firm's email_domain AND the user's normalized company name doesn't match the firm's normalized_company_name
   - For each mismatched member: check if a correct firm exists for their company/domain, create one if needed, and move them
   - Update connection_requests.firm_id to point to the correct firm for each affected user
   - Log all changes to agreement_audit_log for traceability

2. **Specifically for teltonika.lt**: Remove all 44 non-teltonika members, reassign them to their correct firms (creating new firm_agreements where needed)

### Part 2: Fix the resolver to prevent future corruption

1. **Rewrite `resolve_user_firm_id()`** to use a deterministic, non-circular approach:
   - Priority 1: `firm_members` where user's profile email domain matches `firm_agreements.email_domain`
   - Priority 2: `firm_members` where user's profile company matches `firm_agreements.normalized_company_name`
   - Priority 3: Most recent `firm_members` entry (fallback)
   - **Never** use connection_requests.firm_id as input (breaks circular dependency)

2. **Fix `sync_connection_request_firm` trigger** to use the corrected resolver

3. **Fix `auto-create-firm-on-signup`** edge function to be more careful about firm matching -- already handles generic domains but needs to verify the match is reasonable

### Part 3: Admin-controlled agreement status changes with full audit trail

1. **Enhance the Document Tracking page** (`DocumentTrackingPage.tsx`):
   - Add a "Members" expandable row showing all firm members with their email/company
   - Add ability to **remove** a member from a firm (reassign to correct firm)
   - Show audit log inline per firm (who changed what, when)
   - Add "Reassign Member" action to move a user to the correct firm

2. **Ensure all status changes go through `useUpdateAgreementStatus`** which already:
   - Calls the `update_firm_agreement_status` RPC
   - Records in `agreement_audit_log` with admin name and timestamp
   - Invalidates all relevant query keys

3. **Add admin name tracking**: The `update_firm_agreement_status` RPC should record `changed_by_name` (admin's display name) in the audit log, not just the user ID

### Files to Edit

**SQL Migration (new file)**:
- `supabase/migrations/[timestamp]_fix_firm_associations.sql` -- cleanup corrupted data, rewrite `resolve_user_firm_id()`

**Frontend**:
- `src/pages/admin/DocumentTrackingPage.tsx` -- add member management, audit log display, reassign actions
- `supabase/functions/auto-create-firm-on-signup/index.ts` -- tighten matching logic
- `src/hooks/admin/use-firm-agreement-mutations.ts` -- add reassign member mutation

### Execution Order

Given the scope, this should be done in **2 implementation rounds**:

**Round 1**: SQL migration to fix corrupted data + fix resolver (Parts 1 & 2). This is the critical fix.

**Round 2**: UI enhancements for admin member management and audit visibility (Part 3).

### Technical Detail

The corrupted teltonika.lt firm currently shows NDA=signed, Fee=sent. After cleanup:
- teltonika.lt will have only its 1 legitimate member (laurynas.navakauskas@teltonika.lt) and keep its agreement statuses
- 44 other users will be moved to their correct firms (most with not_started status)
- Your test account will only be in the "dfdf" firm with not_started for both agreements
- All connection_requests for affected users will be updated to point to their correct firms

