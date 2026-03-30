

# Phase 93-99: Connection Request Lifecycle — Remaining Gaps

## What Phase 86-92 Already Fixed
- Realtime toast filtering by user_id (Phase 86)
- Persistent user_notifications on approve/reject (Phase 87)
- Landing page auth bypass for admin emails (Phase 88)
- Approval email CTA pointing to /my-deals (Phase 90)

## New Findings

### Phase 93: Bulk approve/reject skips emails, notifications, and system messages (HIGH)
`useConnectionRequestsFilters.handleBulkAction` only calls `updateStatus.mutateAsync` — it does NOT:
- Send approval/rejection emails to buyers
- Insert `user_notifications` rows
- Send system messages in the deal thread

Compare with `useConnectionRequestActions.handleAccept` which does all three. Bulk actions silently change status without any buyer communication.

**Fix**: After each `updateStatus.mutateAsync` in the bulk loop, replicate the email invocation, notification insert, and system message send from `handleAccept`/`handleReject`. This requires fetching the buyer user data and listing data for each request in the batch.

### Phase 94: "Undo" (reset to pending) has no safeguards or reversal logic (MEDIUM)
`handleResetToPending` just calls `updateStatus.mutate({ requestId, status: 'pending' })`. After an admin approves a request:
- Buyer receives approval email + notification + system message
- Admin clicks "Undo" — status resets to pending
- But the approval email is already sent, the notification stays, and the system message remains

There's no "reversal" notification or message. The buyer sees "Approved" in their bell and email but the deal is actually back to pending. At minimum, a system message should be sent saying "Status reverted to pending for further review."

**Fix**: Add a system message on undo, and optionally insert a clarifying user_notification.

### Phase 95: No admin UI to set a request to `on_hold` from the expanded detail view (MEDIUM)
The expanded `ConnectionRequestActions` panel (used in `ConnectionRequestsTable`) has Accept, Decline, and Flag buttons — but no "Put On Hold" button. The only way to set `on_hold` is via the `RequestsGridView` toggle switches (an alternative admin view). Admins using the primary table view cannot set on_hold without switching views.

**Fix**: Add an "On Hold" button to `ApprovalSection` when status is `pending`, alongside Accept and Decline.

### Phase 96: `notify-buyer-rejection` edge function has no `config.toml` — defaults to `verify_jwt = true` (LOW-MEDIUM)
The rejection email edge function has no `config.toml`, so it defaults to requiring JWT auth. The client calls it with the buyer's auth context (via `supabase.functions.invoke`), which works because the admin is authenticated. However, if the function is ever called from a service context (e.g., bulk actions or cron), it would fail with 401.

**Fix**: Add `verify_jwt = false` to the function's config since it uses service_role internally anyway, matching the pattern of other notification functions.

### Phase 97: `on_hold` status has no "Put On Hold" button in the main admin actions panel (LOW)
Related to Phase 95 — once a request IS on_hold, the admin can only "Undo" back to pending. There's no way to move from on_hold directly to approved or rejected without first going through pending. This is a minor UX friction.

**Fix**: Add Accept/Decline buttons to the on_hold banner alongside the Undo button.

### Phase 98: Re-request after rejection — RPC behavior verification (LOW)
When a rejected buyer clicks "Request Again", `useRequestConnection` calls `enhanced_merge_or_create_connection_request`. The RPC accepts `p_listing_id` and `p_user_message`. Need to verify the RPC updates the existing row (resetting status to pending with new message) rather than creating a duplicate. The `onSuccess` handler checks `is_duplicate` and shows appropriate toast — this path appears correct.

**Status**: Code-level audit shows the flow is properly handled. The RPC returns `duplicate_type: 'same_user_same_listing'` and the toast says "Request Updated." No code change needed.

### Phase 99: Rejection email says "Owner selected another buyer" but admin may reject for other reasons (LOW)
The `ConnectionButton` rejection UI shows: "Owner selected another buyer" — but rejections can happen for many reasons (incomplete profile, bad fit, etc.). The rejection email from `notify-buyer-rejection` says "The seller has elected to move forward with another buyer" which is also misleading.

**Fix**: Use more neutral language: "This opportunity is no longer available for your profile at this time" or similar.

## Implementation Plan

| Phase | Fix | Priority | Files |
|-------|-----|----------|-------|
| 93 | Add emails + notifications + system messages to bulk actions | High | `useConnectionRequestsFilters.ts` |
| 94 | Add system message on "Undo" status reset | Medium | `useConnectionRequestActions.ts` |
| 95 | Add "On Hold" button to ApprovalSection pending state | Medium | `ApprovalSection.tsx` |
| 96 | Add config.toml for notify-buyer-rejection | Low | `notify-buyer-rejection/config.toml` |
| 97 | Add Accept/Decline to on_hold banner | Low | `ApprovalSection.tsx` |
| 98 | Re-request after rejection — verified working, no change | None | — |
| 99 | Soften rejection copy in ConnectionButton + rejection email | Low | `ConnectionButton.tsx`, `notify-buyer-rejection/index.ts` |

## Execution

**Response 1**: Phases 93, 94, 95 (high/medium — bulk action gap, undo safeguard, on_hold button)
**Response 2**: Phases 96, 97, 99 (low — config, UX polish, copy improvement)

