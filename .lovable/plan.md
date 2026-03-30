

# Phase 86-92: Connection Request Lifecycle — End-to-End Audit

## Flow Summary

```text
BUYER SUBMITS REQUEST:
  ConnectionButton → fee gate check → ConnectionRequestDialog (AI draft)
  → useRequestConnection (RPC: enhanced_merge_or_create_connection_request)
  → logs user_activity + journey milestone
  → fires buyer quality scoring (async)
  → sends 2 emails: user_confirmation + admin_notification (via send-connection-notification)
  → toast: "Request sent"

ADMIN REVIEWS:
  ConnectionRequestsTable → ConnectionRequestRow → ConnectionRequestActions
  → Approve: updateStatus(approved) + system message + approval email
  → Reject: updateStatus(rejected) + system message + rejection email
  → On Hold: updateStatus(on_hold) — NO email sent
  → Flag: flagMutation + creates daily task for assigned admin

BUYER SEES RESULT:
  My Deals page (MyRequests.tsx) — two-column deal command center
  Realtime: toast appears on status change
  Notification bell: NO persistent notification for status changes
  Email: approval/rejection emails sent
```

## Findings

### Phase 86: Realtime toast fires for ALL users, not just the affected buyer (HIGH)
`useRealtimeConnections` subscribes to ALL updates on `connection_requests` without any `user_id` filter. When Admin A approves Buyer X's request:
- Buyer Y (unrelated) sees "Connection Approved! ✅" toast
- Admin B sees the same toast
- Only Buyer X should see it

**Fix**: Add `filter: 'user_id=eq.${user?.id}'` to the UPDATE subscription, and skip toasts for admin users. Requires access to current user ID in the hook.

### Phase 87: No persistent user_notification for connection status changes (MEDIUM)
When a connection request is approved/rejected/put on hold, the buyer gets:
- An email (approval or rejection)
- A realtime toast (if online)
- But NO entry in `user_notifications` table

This means the buyer's notification bell never shows "Your request for [Deal] was approved." If the buyer was offline, they'd only know via email — the bell would be empty.

**Fix**: In `useConnectionRequestActions.handleAccept()` and `handleReject()`, insert a `user_notifications` row with type `request_approved` or `status_changed`.

### Phase 88: `send-connection-notification` requires auth but landing page calls it unauthenticated (HIGH)
The edge function calls `requireAuth(req)` and returns 401 if not authenticated. But `useDealLandingFormSubmit` (anonymous landing page form) calls it without auth — those admin notification emails silently fail with 401. The form submission itself succeeds (direct insert to `connection_requests`), but admins never get the email notification.

**Fix**: Either make the edge function accept unauthenticated calls for `admin_notification` type, or use the service role key for the landing page invocation.

### Phase 89: Landing page submissions use direct insert bypassing RPC duplicate logic (MEDIUM)
Authenticated marketplace submissions use `enhanced_merge_or_create_connection_request` RPC which handles duplicates and merging. Landing page submissions (`useDealLandingFormSubmit`) do a raw `.insert()` with only a manual email+listing dedup check. If the same lead submits from different browsers or after clearing localStorage, duplicates can be created.

The landing page also lacks the `user_id` field (anonymous), so the dedup check (`lead_email` + `listing_id`) is the only guard. This is acceptable but should be documented.

### Phase 90: Approval email CTA links to /messages but buyer deals are at /my-deals (LOW-MEDIUM)
The approval email in `send-connection-notification` has a CTA button linking to `https://marketplace.sourcecodeals.com/messages`. But the buyer's deal command center is at `/my-deals` (MyRequests). The messages tab within a deal is at `/my-deals?deal=X&tab=messages`. Linking to `/messages` takes them to a separate message center that may not show the relevant thread clearly.

**Fix**: Change the approval email CTA from `/messages` to `/my-deals`.

### Phase 91: `on_hold` status has no email notification to buyer (LOW)
When an admin puts a request on hold, no email is sent and no system message is created. The buyer has no idea their request status changed unless they check the My Deals page. This is potentially intentional (on_hold is an internal state), but should be explicitly documented.

### Phase 92: Rejected request "Request Again" creates a second connection request (LOW)
When a buyer's request is rejected, the UI shows a "Request Again" button. This goes through the same `useRequestConnection` which calls the `enhanced_merge_or_create_connection_request` RPC. The RPC should handle this as a duplicate/update, but need to verify it doesn't create a separate row that confuses admin view.

## Implementation Plan

| Phase | Fix | Priority | Files |
|-------|-----|----------|-------|
| 86 | Add user_id filter to realtime subscription + skip admin toasts | High | `use-realtime-connections.ts` |
| 87 | Insert user_notification on approve/reject | Medium | `useConnectionRequestActions.ts` |
| 88 | Fix auth requirement for landing page admin notifications | High | `send-connection-notification/index.ts` or `useDealLandingFormSubmit.ts` |
| 89 | Document landing page dedup behavior (no code change needed) | Low | Documentation |
| 90 | Fix approval email CTA to /my-deals | Low-Medium | `send-connection-notification/index.ts` |
| 91 | Document on_hold as internal-only status (no buyer notification by design) | Low | Documentation |
| 92 | Verify RPC handles re-request after rejection correctly | Low | Audit only |

## Execution

**Response 1**: Phases 86, 87, 88 (high/medium priority — realtime fix, notification gaps, auth issue)
**Response 2**: Phases 90, 92 (email CTA fix, re-request verification)

