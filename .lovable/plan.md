

# Add Tooltips to Decision Banner + Clean Up Design

## What Each Action Does (for tooltip content)

| Action | DB Status | Buyer Sees | Email Sent | Notification |
|--------|-----------|------------|------------|-------------|
| **Accept** | `approved` | Deal thread message: "We have sent you a brief overview..." | Approval email via `send-connection-notification` | Bell: "Connection Approved" |
| **Decline** | `rejected` | Thread message with admin's note or "Request declined" | Rejection email via `notify-buyer-rejection` | Bell: "Connection Update — not approved" |
| **On Hold** | `on_hold` | Thread message: "placed on hold for further evaluation" | None | None |
| **Flag for Review** | No status change | Nothing | None | Creates internal admin task |

## Changes — Single File

### `src/components/admin/connection-request-actions/ApprovalSection.tsx`

**1. Add tooltips to each button** using the existing `Tooltip` / `TooltipTrigger` / `TooltipContent` from `@/components/ui/tooltip`:

- **Accept Request**: "Approves the buyer, sends approval email, adds to pipeline, and posts a deal thread message"
- **Decline**: "Rejects the request, sends rejection email to buyer with optional note"
- **On Hold**: "Pauses the request without notifying the buyer — no email or notification sent"
- **Flag for Review**: "Flags for a team member to review — no buyer impact, creates an internal task"
- **Awaiting Action**: No tooltip needed (just a status label)

**2. Design cleanup** — make the banner more minimal and aligned with the quiet luxury aesthetic:

- Remove the heavy `bg-sourceco-muted` background and `shadow-md` — use a subtle `bg-muted/40` with a thin `border border-border` instead
- Replace the large 48px gold icon box with a smaller, simpler treatment
- Reduce the "Decision Required" text from `text-lg font-extrabold` to `text-sm font-semibold uppercase tracking-wide` — more understated
- Subtitle: lighter weight, `text-xs`
- Buttons: uniform outline style with subtle differentiation — Accept gets a filled dark button (`bg-[#0E101A] text-white`), Decline stays outline, On Hold stays outline with muted amber. Remove the bold gold Accept button.
- Remove the "AWAITING ACTION" pill — redundant with "Decision Required" header
- Use consistent `h-9 px-4 text-sm font-medium` sizing for all action buttons
- Wrap the entire button row in `<TooltipProvider>` for hover tooltips

**3. Status banners** (approved/rejected/on_hold) — leave as-is, they're already clean and informative.

### No other files changed.

