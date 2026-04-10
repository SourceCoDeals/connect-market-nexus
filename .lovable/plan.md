
Audit result: not everything is truly fixed yet.

What is confirmed fixed
- `src/components/admin/ConnectionRequestEmailDialog.tsx`
  - widened to `sm:max-w-4xl`
  - upgraded preview styling
  - Adam is in the sender dropdown
  - first-person approval copy is implemented for named senders
  - approval preview says buyers can reply to the email
  - full email wrapper is simulated in the modal
- `src/components/admin/connection-request-actions/index.tsx`
  - admin comment is now forwarded into the action handlers
- `src/components/admin/connection-request-actions/useConnectionRequestActions.ts`
  - approval flow no longer requires `listingId` before attempting email send
  - admin comment is passed into the status mutation
  - sender info is passed into the approval email call
- `supabase/functions/send-connection-notification/index.ts`
  - `listingId` is optional
  - first-person default approval body exists
  - approval copy now says access to materials/details and allows replies
  - no “do not reply” in the approval email body

What is still not fully fixed
1. `src/components/admin/WebflowLeadDetail.tsx` still contains the old bugs
- still discards the dialog comment: `(_comment: string, ...)`
- approve path still does `if (buyerEmail && listingId)`, so general-inquiry/webflow cases can still skip email entirely
- approve path does not save the admin comment
- this means one admin surface is still broken even though another was fixed

2. `supabase/functions/notify-buyer-rejection/index.ts` still uses old wording
- still says “move forward with an introduction”
- still says “We limit introductions...”
- that part of the copy request was not fully implemented

3. `src/pages/admin/AdminRequests.tsx` uses a separate approval/rejection path from the fixed hook
- the main Requests page does not use `useConnectionRequestActions`
- it uses `useConnectionRequestsMutation()` and then separately invokes the email function
- because of that, the “fixed” logic is not centralized and not guaranteed across all admin entry points

4. The latest failure strongly suggests the main Requests-page status update path is still the real blocker
- edge logs show recent `user_confirmation` and `admin_notification` sends
- there are no matching `approval_notification` logs for the failed approval attempt
- in `AdminRequests.tsx`, the email send only happens after `await updateRequest(...)`
- if status stayed “decision required” and no approval email log exists, the likely failure point is the status mutation/RPC path before the email call

5. “Exact final email preview” is still only partially true
- default preview is close to the sent email
- but when the admin edits the body, the edge function sends the edited text as one escaped paragraph with `<br>` line breaks
- so custom-edited content is sent, but the preview is not a perfect final-render match for richer formatting

What I can conclude from read-only investigation
- The earlier fixes were implemented only partially across the codebase.
- One flow was repaired (`connection-request-actions`), but duplicate approval flows remain and still contain old logic.
- That is why you can still see failures even though parts of the system look updated.

Recommended implementation plan
1. Unify approval/rejection logic
- make `AdminRequests.tsx` and `WebflowLeadDetail.tsx` use the same shared approval/rejection action path as `useConnectionRequestActions`
- remove duplicated email/status logic so there is one source of truth

2. Fix the remaining broken paths
- in `WebflowLeadDetail.tsx`, pass the dialog comment through, save it, and remove the `listingId` email guard
- in `notify-buyer-rejection/index.ts`, update all remaining “introduction(s)” language to the new “access/opportunity” framing

3. Harden the main Requests-page flow
- add explicit error handling around `updateRequest(...)`
- keep the modal open and show the actual failure if status update fails
- only show success after the mutation succeeds
- log enough context to confirm whether the RPC or follow-up read is failing

4. Make edited-email behavior match the preview more closely
- preserve paragraph structure in custom edited emails instead of wrapping the whole body in a single `<p>`
- ensure the sent version visually matches what the admin saw

5. Verify end-to-end after rebuilding
- approve a normal listing request
- approve a general inquiry / no-listing request
- approve with Adam as sender
- edit the email body and verify the edited body arrives
- confirm `admin_comment` is stored
- confirm status changes immediately in UI and persists after refresh
- confirm edge logs show `approval_notification` and the email provider accepts the send

Files that still need work
- `src/pages/admin/AdminRequests.tsx`
- `src/components/admin/WebflowLeadDetail.tsx`
- `supabase/functions/notify-buyer-rejection/index.ts`
- likely also the shared approval action wiring so all screens use one implementation

Bottom line
- No, it is not fully fixed yet.
- The modal/design work and much of the approval-email copy work are in place.
- The system still has duplicated admin flows, and at least one of those flows still contains the old bugs.
- The next step should be a consolidation pass plus a true end-to-end verification pass.
