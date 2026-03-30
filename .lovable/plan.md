

# Notification System Deep Dive: Audit & Testing Roadmap

## Architecture Overview

```text
TWO NOTIFICATION TABLES:
  admin_notifications — for admins (task assignments, deal changes, signing requests)
  user_notifications  — for buyers (agreements, memos, document uploads)

TWO BELL COMPONENTS:
  AdminNotificationBell — shows admin_notifications (admin navbar)
  BuyerNotificationBell — shows user_notifications (buyer navbar)

TWO FULL PAGES:
  AdminNotifications (/admin/settings/notifications) — full admin notification list
  (No equivalent buyer page — buyer only has the bell popover)

REALTIME:
  Both hooks subscribe to postgres_changes for live updates
```

## Complete Notification Type Registry

### Admin Notifications (admin_notifications table)

| Type | Source | Icon in Bell? | Click Navigation? |
|------|--------|--------------|-------------------|
| `task_assigned` | Client (useDailyTaskMutations, useTaskActions) | Yes (ListTodo) | Yes (action_url → pipeline) |
| `task_completed` | Client (useDailyTaskMutations) | Yes (CheckCheck) | Yes (action_url) |
| `task_approved` | Client (useDailyTaskMutations) | **NO — falls to default Bell** | Yes (action_url) |
| `response_sent` | Client (EnhancedFeedbackManagement) | **NO — falls to default Bell** | Yes (action_url) |
| `document_signing_requested` | Edge fn (get-buyer-nda-embed, get-buyer-fee-embed) | Yes (FileSignature) | Yes → /admin/documents |
| `document_completed` | Edge fn (confirm-agreement-signed, pandadoc-webhook) | Yes (FileCheck) | Yes → /admin/documents |
| `remarketing_a_tier_match` | Edge fn (notify-remarketing-match) | Yes (Bell green) | Yes (action_url) |
| `deal_assignment` | Client (useDealMutations) | **NO — falls to default Bell** | Pipeline via custom event |
| `deal_reassignment` | Client (useDealMutations) | **NO — falls to default Bell** | Pipeline via custom event |
| `alert_dismissed` | Edge fn (alert-tools) | N/A (meta-type, not user-facing) | N/A |
| `alert_snoozed` | Edge fn (alert-tools) | N/A (meta-type) | N/A |
| `connection_request_new` | Listed in TypeScript type but **no insert found** | NO | NO |
| `deal_stage_changed` | Listed in TypeScript type but **no insert found** | NO | NO |
| `deal_follow_up_needed` | Listed in TypeScript type but **no insert found** | NO | NO |

### User (Buyer) Notifications (user_notifications table)

| Type | Source | Icon in Bell? | Click Navigation? |
|------|--------|--------------|-------------------|
| `agreement_pending` | Edge fn (create-pandadoc-document, AI tools) | Yes (FileSignature) | Yes → /profile?tab=documents |
| `agreement_signed` | Edge fn (confirm-agreement-signed, pandadoc-webhook) | **NO — falls to default Bell** | **NO — falls to generic connection_request_id nav** |
| `memo_shared` | Edge fn (send-memo-email) | Yes (FileText) | Yes → /deals/:id or /marketplace/:slug |
| `document_uploaded` | Unknown insert source | Yes (FolderOpen) | Yes → /my-requests?deal=X&tab=documents |
| `status_changed` | Unknown insert source | Yes (CheckCircle) | Generic nav |
| `request_approved` | Unknown insert source | Yes (CheckCircle) | Yes → /deals/:id |
| `new_message` | Unknown insert source | Yes (MessageSquare) | Yes → /messages?deal=X |
| `request_created` | Unknown insert source | Yes (Bell blue) | Generic nav |

---

## Findings

### Phase 73: Admin notification_type TypeScript union is incomplete (HIGH)
The `AdminNotification` interface defines `notification_type` as a union of 6 types: `task_assigned | task_completed | deal_stage_changed | response_sent | connection_request_new | deal_follow_up_needed`. But actual inserts use 10+ types including `task_approved`, `document_signing_requested`, `document_completed`, `remarketing_a_tier_match`, `deal_assignment`, `deal_reassignment`. The AdminNotificationBell works around this with `(notification.notification_type as string)` casts. The type should be updated to match reality.

### Phase 74: Buyer `agreement_signed` has no icon or navigation handler (MEDIUM)
When a buyer signs an NDA/Fee Agreement, they get an `agreement_signed` notification. But `BuyerNotificationBell.getIcon()` has no case for it (falls to generic Bell icon), and `handleClick()` has no handler (falls to generic connection_request_id navigation, which won't work since agreement_signed notifications don't have a connection_request_id). Should navigate to `/profile?tab=documents`.

### Phase 75: Admin Notifications page icon switch is incomplete (MEDIUM)
`AdminNotifications.tsx` `getNotificationIcon()` only handles `task_assigned` and `task_completed`. All other types (document_signing_requested, document_completed, remarketing, deal_assignment, task_approved, response_sent) get the default gray Bell. Should match `AdminNotificationBell`'s icon set.

### Phase 76: Admin notification grouping uses synthetic IDs that break mark-as-read (MEDIUM)
`use-admin-notifications.ts` creates synthetic grouped IDs like `task_assigned-{deal_id}`. When `markAsRead` is called with these synthetic IDs, the `.in('id', ids)` query will fail silently (no row matches). The `AdminNotificationBell` correctly uses `groupedIds` for marking, but `AdminNotifications.tsx` page uses `notification.groupedIds || [notification.id]` — if the notification is the synthetic one, `notification.id` is the fake ID. This is handled in `AdminNotificationBell` but the **full page** (`AdminNotifications.tsx`) also passes `notification.groupedIds || [notification.id]` which should work. Need to verify the grouping logic doesn't lose real IDs.

### Phase 77: Admin realtime subscription has no user filter (LOW)
`use-admin-notifications.ts` subscribes to ALL inserts/updates on `admin_notifications` table without filtering by `admin_id`. Every admin receives realtime invalidation for every other admin's notifications. Should add `filter: admin_id=eq.${user.id}` like the buyer hook does.

### Phase 78: `connection_request_new`, `deal_stage_changed`, `deal_follow_up_needed` are phantom types (LOW)
These types exist in the TypeScript interface but no code inserts them. They should either be removed from the type or actually wired up. `connection_request_new` in particular seems like it should be created when a buyer submits a connection request (currently only an email is sent via `send-connection-notification`).

### Phase 79: AgreementAlertModal navigates to /messages instead of /profile?tab=documents (LOW-MEDIUM)
The `agreement_pending` notification's `handleClick` navigates to `/profile?tab=documents`, but the `AgreementAlertModal` popup navigates to `/messages`. These should be consistent — the signing action lives in the Profile Documents tab, not Messages.

---

## Implementation Plan

| Phase | Fix | Priority | Files |
|-------|-----|----------|-------|
| 73 | Expand AdminNotification type union to match all real types | High | `use-admin-notifications.ts` |
| 74 | Add `agreement_signed` icon + navigation to BuyerNotificationBell | Medium | `BuyerNotificationBell.tsx` |
| 75 | Sync AdminNotifications page icon switch with bell component | Medium | `AdminNotifications.tsx` |
| 76 | Verify grouping logic preserves real IDs for mark-as-read | Medium | `use-admin-notifications.ts` |
| 77 | Add admin_id filter to realtime subscription | Low | `use-admin-notifications.ts` |
| 78 | Remove phantom notification types from TypeScript interface | Low | `use-admin-notifications.ts` |
| 79 | Update AgreementAlertModal CTA to navigate to /profile?tab=documents | Low-Medium | `AgreementAlertModal.tsx` |

## Estimated Effort

7 phases, all focused and small. Can be completed in **2 responses**:
- Response 1: Phases 73-76 (type safety, missing icons/nav, grouping fix)
- Response 2: Phases 77-79 (realtime filter, cleanup, modal nav)

