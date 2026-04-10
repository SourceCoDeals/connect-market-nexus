

# Investigation Results + Fix Plan

## Root Cause Analysis

### Bug 1: Email never sent (CRITICAL)
In `useConnectionRequestActions.ts` line 123:
```typescript
if (buyerEmail && listingId) {
```
The request you tested is a **General Inquiry** (listing_id = sentinel UUID `00000000-0000-0000-0000-000000000001`). The `listing` prop passed to this component is `null` for General Inquiries, so `listing?.id` is `undefined`, making `listingId` falsy. The entire email-sending block is **skipped silently**.

**Fix**: Change the guard to `if (buyerEmail)` and handle missing `listingId` gracefully. The edge function already works fine without a real listing ID -- it just needs `listingTitle`.

### Bug 2: Status didn't change (CRITICAL)
The status update (`updateStatus.mutateAsync`) on line 88 runs before the email block. If it succeeds, the status should change. However, looking at the RLS on `connection_requests`, the update uses the **anon key** client, and the admin's ability to update depends on RLS policies. If the update silently fails or the optimistic update rolls back without a visible error, the UI would appear unchanged.

More likely: the `updateStatus.mutateAsync` call throws (possibly RLS), the catch block shows a destructive toast ("Action failed"), and both status update and email are skipped. Need to check if you saw an error toast.

However, if the `listing` being null also causes issues earlier in the flow (e.g., the `sendMessage.mutateAsync` on line 111 might fail if the connection request's thread resolution fails for a General Inquiry), that error would be caught and the whole operation would abort after the status update but the toast would still say "Request approved."

Actually wait -- line 88 runs first and succeeds (status updates), then line 111 sends a message, then line 123 sends email. If the message send fails, the catch block runs and shows an error toast, but the status was already updated. Let me re-read... Actually `mutateAsync` on line 88 would commit the status. So if line 111 throws, status IS updated but the error toast shows.

But the user says status didn't change. So either:
1. The `updateStatus.mutateAsync` itself failed (RLS issue)
2. Or the optimistic update showed "approved" briefly then rolled back

Let me check if there's an RLS issue by checking the mutation code -- it uses `supabase.from('connection_requests').update()` with the client-side anon key. This would require an RLS policy allowing admin updates.

### Bug 3: Admin comment never saved
In `handleEmailDialogConfirm` (line 74), the `_comment` parameter (admin's note from the dialog) is prefixed with underscore and **never passed** to `handleAccept` or `handleReject`. The note is discarded.

**Fix**: Pass the comment to `handleAccept`/`handleReject` and include it in `updateStatus.mutateAsync({ requestId, status, notes: comment })`.

### Bug 4: Rejection copy still says "introductions"
Line 88 of the dialog: `"We limit introductions to a small number of buyers"` -- should be "We limit access to a small number of buyers" per user's instructions.

## Changes

### 1. `useConnectionRequestActions.ts`
- Remove `listingId` guard from email sending -- send email even when listing is null/General Inquiry
- Accept `adminComment` parameter in `handleAccept` and `handleReject`, pass to `updateStatus.mutateAsync` as `notes`
- Use `listingTitle` fallback ("General Inquiry" or "this deal") when listing is missing

### 2. `connection-request-actions/index.tsx`
- Pass the admin comment from `handleEmailDialogConfirm` to `handleAccept`/`handleReject` instead of discarding it

### 3. `ConnectionRequestEmailDialog.tsx`
- Fix rejection copy: "introductions" → "access"

### 4. `send-connection-notification/index.ts`
- Make `listingId` optional in the interface (it already handles missing listing gracefully in the URL, just need the type to allow it)

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/connection-request-actions/useConnectionRequestActions.ts` | Remove listingId guard, accept+pass adminComment |
| `src/components/admin/connection-request-actions/index.tsx` | Forward admin comment to handlers |
| `src/components/admin/ConnectionRequestEmailDialog.tsx` | Fix "introductions" → "access" in rejection copy |
| `supabase/functions/send-connection-notification/index.ts` | Make listingId optional |

Edge function redeploy required.

