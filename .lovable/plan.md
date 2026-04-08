

# Unify Webflow Lead Workflow with Marketplace Request Workflow

## Problem

Webflow leads currently show a stripped-down view without Accept/Decline/On Hold/Flag actions or marketplace-style agreements. The workflow must be identical regardless of source — only the presentation of the submission context differs.

## Approach

Instead of a fully separate component, **route Webflow leads through `ConnectionRequestActions` when they have a matched user**, and for guest Webflow leads, add the approval workflow directly. In both cases, prepend the Webflow source banner.

### For Webflow leads WITH a matched user

Render the existing `ConnectionRequestActions` (which has Accept/Decline/On Hold/Flag, Agreements, Requested Deal, Conversation Thread, etc.) **but**:
- Prepend the Webflow source banner (blue card with form name, URL, UTMs)
- Replace the "Conversation Thread" tab content with the read-only "Form Submission" card — the message is a one-way form entry, not a chat. Keep the Internal Notes tab.
- Show the user's profile inline via the existing `ExpandableBusinessProfile` below (already rendered in `ConnectionRequestRow.tsx` line 632)

### For Webflow leads WITHOUT a matched user (guest)

Render `WebflowLeadDetail` but add:
- **Approval section** — Accept, Decline, On Hold, Flag for Review buttons (import `ApprovalSection` and `FlagReviewSection` from `connection-request-actions/`)
- Use `useUpdateConnectionRequestStatus` and `useFlagConnectionRequest` hooks directly (they only need `requestId`, not a user)
- Keep existing lead contact info, form submission card, requested deal, and `LeadRequestActions` (NDA/Fee toggles + follow-up)

## Changes

| File | Change |
|------|--------|
| `src/components/admin/ConnectionRequestRow.tsx` | For `source === 'webflow'` with a matched user: render Webflow source banner + `ConnectionRequestActions` (instead of `WebflowLeadDetail`). For guest Webflow leads: keep `WebflowLeadDetail`. Remove the "View Profile" external link button from the matched-user banner. |
| `src/components/admin/WebflowLeadDetail.tsx` | Add `ApprovalSection` + `FlagReviewSection` for guest Webflow leads. Wire up `useUpdateConnectionRequestStatus` and `useFlagConnectionRequest`. Keep all existing Webflow context (source banner, form submission, lead info). |
| `src/components/admin/connection-request-actions/MessagesSection.tsx` | Accept an optional `isWebflowSubmission` prop. When true, show the message as a read-only "Form Submission" card (no reply composer, label says "Form Submission" not "Conversation Thread"). |

## Result

- All Webflow leads get Accept/Decline/On Hold/Flag — same as marketplace
- Matched users get full marketplace agreements (NDA/Fee via firm), profile shown inline
- Guest leads get lead-level agreement toggles
- Webflow source context (banner, form name, URL, UTMs) is always visible
- No conversation thread / reply composer for Webflow leads — read-only form submission instead

