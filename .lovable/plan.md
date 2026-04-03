

# Dismiss Pending Requests + Show Email Status in Main Table

## What We're Building

1. **Dismiss button on pending requests**: Add a "Dismiss" action to each pending request row. This sets the `document_requests` status to `dismissed` (a new status value) so it stops appearing in the pending queue. The record stays in the database untouched otherwise.

2. **Email delivery status in the main firm table**: Surface email open/delivery status for document requests directly in the main firm agreements table rows, so you always know who requested, when, and whether they opened the email.

## Implementation

### Step 1: Add `dismissed` status support (Migration)

Add a simple migration comment: no schema change needed. The `status` column is already a plain `text` field (not an enum), so we can write `dismissed` directly. No migration required.

### Step 2: Dismiss button on PendingRequestRow

In `DocumentTrackingPage.tsx`, add a dismiss button (X icon) next to "Mark Signed" on each pending request row. On click:
- Update `document_requests` row: set `status = 'dismissed'`
- Invalidate the pending queue queries
- Toast confirmation
- The row disappears from the pending queue but remains in the database with full history

### Step 3: Update pending queue query to exclude dismissed

The query at line 273 already filters `IN ('requested', 'email_sent')`, so dismissed items are automatically excluded. No change needed.

### Step 4: Update sidebar badge count to exclude dismissed

`use-pending-document-requests.ts` already filters `.in('status', ['requested', 'email_sent'])`, so dismissed items won't inflate the badge. No change needed.

### Step 5: Show request history + email status in the main firm table

In each firm's row in the main table, add a subtle indicator showing:
- Whether there are document requests for this firm (and how many)
- The latest email delivery status (Delivered, Opened, Bounced, etc.)
- When the last request was made

This requires joining/correlating `document_requests` data with the firm rows. The firm data query will be extended to fetch associated `document_requests` for each firm, and the row component will render small status badges showing request history and email open status.

### Files Changed

- `src/pages/admin/DocumentTrackingPage.tsx`:
  - Add dismiss handler + X button to `PendingRequestRow`
  - Add request history / email status indicators to the main firm table rows

