

# Fix Agreement Status Inconsistency — Root Cause Found

## The Problem

`check_agreement_coverage('ahaile14@gmail.com', 'nda')` returns `not_covered` even though the user IS a marketplace member of the SourceCo firm which has `nda_status = 'signed'`.

**Root cause**: The function has an early return on generic domains (gmail.com) at line 44-48 that exits BEFORE reaching the firm_member fallback lookup at line 143. The firm_member lookup was added later but placed AFTER the generic domain guard, so it never executes for Gmail/Yahoo/etc users.

## Data Verification

```text
profiles:          nda_signed=true, fee_agreement_signed=true (stale booleans)
resolve_user_firm: returns SourceCo (43b0...) — correct
SourceCo firm:     nda_status=signed, fee_agreement_status=signed — correct
firm_members:      user IS a marketplace_user member of SourceCo — correct
check_agreement_coverage: returns NOT COVERED — BUG (generic domain guard blocks)
get_my_agreement_status:  calls check_agreement_coverage → also returns not covered
```

This single bug causes ALL downstream inconsistencies:
- Marketplace cards show "Sign Agreement" instead of unlocked access
- ProfileDocuments (which uses `resolve_user_firm_id`) correctly shows signed
- Notification bell says signed (from old profile booleans or different code path)
- The entire system appears contradictory

## Solution

### Step 1: Fix `check_agreement_coverage` — Move firm_member lookup BEFORE the generic domain early-return

**Migration**: Restructure the function so the resolution order is:

1. Domain lookup (skip for generic domains) — existing
2. PE parent lookup (skip for generic domains) — existing  
3. **Firm member lookup via `profiles.email` join** — move this BEFORE the generic domain guard, OR remove the early return and let all paths execute sequentially

The cleanest fix: instead of returning early for generic domains, just skip the domain-based lookups but still allow the firm_member fallback to run. Change the logic from:

```text
IF generic → RETURN not_covered  (blocks everything)
```

to:

```text
IF NOT generic → try domain lookup
IF NOT generic → try PE parent lookup  
ALWAYS → try firm_member lookup (this is the safety net for Gmail users)
```

### Step 2: Fix `get_my_agreement_status` to also include firm_member resolution

Since `get_my_agreement_status` delegates entirely to `check_agreement_coverage`, fixing Step 1 automatically fixes this. But verify the `firm_id` and timestamps are correctly populated from the firm_member path.

### Step 3: Fix `enhanced_merge_or_create_connection_request` server-side gate

This RPC also calls `check_agreement_coverage`. Once Step 1 is fixed, this gate will also correctly allow Gmail users with signed agreements through.

### Step 4: Suppress stale notifications for already-signed users

Per user preference: keep old `agreement_pending` notifications visible as history but never surface alert popups. The `BuyerNotificationBell` already has this logic (lines 80-87) — it checks `agreementStatus.nda_covered` and auto-marks-read. Once Step 1 is fixed, `nda_covered` will return `true` for this user, and the auto-dismiss will work.

No frontend code changes needed. This is entirely a database function fix.

---

## Files Changed
- New migration: recreate `check_agreement_coverage()` with firm_member lookup running for ALL users (not blocked by generic domain guard)

## What This Fixes
- Gmail/Yahoo/personal-email users who are firm members will correctly show as covered
- Marketplace cards, listing detail, profile documents, connection requests, and notifications will all agree
- The edge function `request-agreement-email` will correctly detect "already signed" for these users
- Server-side connection request gate will allow access for these users
- No frontend changes required — all consumers already use `check_agreement_coverage` or `get_my_agreement_status`

