

## Problem

Phone numbers show in the contact drawer but not in the list view table. 

**Root cause**: Two different lookup strategies are used:
- **List view** (table): Uses `contact_id` FK join → `member.contact?.phone`. But `contact_id` is often `null` (especially for deal-sourced members), so the join returns nothing.
- **Drawer**: Queries `contacts` table **by email** → always finds the phone.

For example, Russell Bradway has `contact_id = null` and `contact_phone = null` in `contact_list_members`, but the `contacts` table has his phone `(508) 842-0060` linked by email.

## Fix

### 1. Backfill `contact_id` on existing list members

**File: `src/hooks/admin/use-contact-lists.ts`** — in the `useContactList` query function

After fetching members, for any member where `contact_id` is null, do a batch lookup against the `contacts` table by email to get the phone (and populate the missing join data). This is a read-side enrichment that fills the gap without requiring a migration.

Add a post-fetch step:
1. Collect members where `contact_id` is null (no FK join data)
2. Batch-query `contacts` table by those emails
3. Merge the `phone` (and other fields) into each member's `contact` object so the existing render logic picks it up

### 2. Update the list view render to use the enriched data

**File: `src/pages/admin/ContactListDetailPage.tsx`** — line 474

The current render: `member.contact?.phone || member.contact_phone || '--'` will automatically work once step 1 populates `member.contact` for members without `contact_id`. No render change needed.

### Summary

| File | Change |
|------|--------|
| `src/hooks/admin/use-contact-lists.ts` | After fetching members, enrich those with null `contact_id` by looking up `contacts` by email and attaching phone/name data to the `contact` field |

This is a single-file fix. The enrichment runs at query time so it works for all existing and future lists without requiring a data migration.

