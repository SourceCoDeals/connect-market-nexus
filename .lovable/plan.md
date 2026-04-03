
# Fix: Dismiss Still Fails Because the DB Constraint Was Never Updated

## Root Cause

The latest screenshot gives the real error:

```text
new row for relation "document_requests" violates check constraint "document_requests_status_check"
```

I verified the actual table definition. `document_requests.status` still only allows:

- `requested`
- `email_sent`
- `signed`
- `cancelled`

So the UI is trying to write:

```ts
status: 'dismissed'
```

but the database rejects it before RLS even matters.

## What is already correct

These parts are already in place:

- The dismiss button exists in `DocumentTrackingPage.tsx`
- The pending queue already excludes dismissed-like rows by filtering only `requested` and `email_sent`
- The main table history UI already knows how to display `dismissed`
- The newer RLS policies now look correct for update access

So the missing piece is the schema constraint, not the front end.

## Implementation Plan

### 1. Add `dismissed` to the status check constraint
Create one new migration that drops and recreates the `document_requests_status_check` constraint so `status` allows:

- `requested`
- `email_sent`
- `signed`
- `cancelled`
- `dismissed`

This is the actual fix for the current error.

### 2. Verify all code paths stay aligned
Review `DocumentTrackingPage.tsx` and related admin hooks so every place that reads or writes document request status is consistent with the new allowed value.

Specifically verify:
- dismiss action writes `dismissed`
- pending queue still filters only `requested` and `email_sent`
- history badges render `dismissed`
- no code assumes the old 4-status set

### 3. Tighten error handling for admin actions
Keep the improved toast/error reporting so future failures show the exact database message instead of a generic failure.

## Files to change

- New migration in `supabase/migrations/` to update `document_requests_status_check`
- Possibly `src/pages/admin/DocumentTrackingPage.tsx` only if a small consistency cleanup is needed after review

## Technical details

Current constraint found in the database:

```sql
CHECK ((status = ANY (ARRAY[
  'requested'::text,
  'email_sent'::text,
  'signed'::text,
  'cancelled'::text
])))
```

Required replacement:

```sql
CHECK ((status = ANY (ARRAY[
  'requested'::text,
  'email_sent'::text,
  'signed'::text,
  'cancelled'::text,
  'dismissed'::text
])))
```

## Expected result after fix

- Clicking dismiss will succeed
- The request will disappear from the pending queue
- The row will remain in `document_requests` for audit/history
- The main firm table will still show that the request happened and was dismissed
