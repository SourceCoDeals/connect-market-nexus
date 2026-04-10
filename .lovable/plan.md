

# Redesign Connection Request Email Modal + Fix Email Copy + Fix Critical Bug

## Critical Bug Found

`AdminRequests.tsx` (table-level approve) sends `type: 'buyer_approval'` to the edge function, but the function only handles `'approval_notification'`. It also sends `buyerEmail` instead of `recipientEmail`. This means **approval emails from the main table buttons silently fail** -- the request falls into the admin-notification branch and sends to support@ instead of the buyer.

## Changes

### 1. Fix AdminRequests.tsx edge function call (critical)

Change the `send-connection-notification` invocation:
- `type: 'buyer_approval'` to `type: 'approval_notification'`
- `buyerEmail` to `recipientEmail`
- `buyerName` to `recipientName` + `requesterName` + `requesterEmail`
- Add `listingId` (currently missing)

### 2. Redesign ConnectionRequestEmailDialog -- wider, Apple/Stripe-level

- Widen to `max-w-2xl` (from `max-w-lg`)
- Clean, minimal layout with more whitespace
- Refined typography and spacing
- Email preview styled as a proper email card with subtle shadow

### 3. Update email copy (approval)

Old: "Your introduction to X has been approved. We are making a direct introduction..."
New: "Your request for X has been approved. You now have access to additional deal materials, detailed company information -- including the real company name -- and supporting documents. [Selected admin name] will be in touch shortly with next steps."

- Keep "What to expect" but update bullets to match new framing (access to materials, not "introduction")
- Keep "This is an exclusive opportunity..." but remove "Please do not reply to this email" (they can reply now)
- Add "You can also reply directly to this email" to the messaging bullet

### 4. Update edge function default body to match

Update `send-connection-notification/index.ts` approval_notification default body to use the same new copy so the preview matches what actually sends.

### 5. Update dialog preview to match new copy

The inline preview JSX in the dialog must mirror the new edge function body exactly.

### 6. Update defaultBody text (used for edit mode)

The `defaultBody` useMemo string must also match so edit-mode starts with the correct text.

### 7. Update subject line

Change from "Introduction approved: X" to "Request approved: X" -- both in dialog and edge function.

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/ConnectionRequestEmailDialog.tsx` | Wider modal, redesigned layout, updated copy, remove "do not reply" |
| `src/pages/admin/AdminRequests.tsx` | Fix edge function `type` and field names |
| `supabase/functions/send-connection-notification/index.ts` | Update default approval body copy + subject |

## Edge Function Deployment

`send-connection-notification` must be redeployed after the copy update.

