

# Fix Email Catalog — Accuracy & Completeness Audit

## Problems Found

### 1. Missing emails (8 emails not in the catalog)

The catalog has 32 entries but the actual codebase has 40+ distinct email sends across 32 edge functions. These are missing:

**From `send-connection-notification` (3 email types in one function):**
- Connection Request Confirmation — `Introduction request received — [Deal]` → User
- Connection Approval — `You're in — introduction to [Deal] approved.` → Buyer  
- Connection Admin Notification — `New Connection Request: [Deal] — [Buyer]` → Admin

The catalog lists "Connection Request Confirmation" and "Connection Approval" but points to non-existent functions (`send-connection-confirmation`, `send-connection-approval`). The real function is `send-connection-notification` for all three. And the admin notification is entirely missing.

**From `user-journey-notifications` (4 email types in one function):**
- User Created — `Your application to SourceCo is in.` → User
- Email Verified — `Email confirmed — you're in the queue.` → User  
- Profile Approved — `Account Approved — Welcome to SourceCo` → User
- Profile Rejected — `SourceCo Account Update` → User
- Admin notification on signup — `New User Registration: [Name] ([Email])` → Admin

The catalog has "Journey: Admin New User" but doesn't have the 4 user-facing journey emails.

**From `send-templated-approval-email` (2 variants):**
- Approved (NDA signed) — `You're in — full access is live.` → Buyer
- Approved (NDA unsigned) — `You're approved — one step to full access.` → Buyer

Not in catalog at all.

**From `notify-deal-reassignment`:**
- `Deal Modified: [Company]` → Owner (listed but subject is wrong in catalog)

### 2. Wrong subject lines (doesn't match actual code)

| Catalog says | Code actually sends |
|---|---|
| `Welcome to SourceCo Marketplace` | `Project [Name] — Investment Opportunity` |
| `[Name], you're invited to SourceCo Marketplace` | `[Name], you're invited to SourceCo Marketplace` (correct) |
| `Update on Your Interest in [Deal]` | `Regarding Your Interest in [Company]` |
| `New Match: [Deal Title]` | `New deal — matches your mandate.` |
| `[Referrer] shared a deal with you` | `[Referrer] shared a business opportunity with you` |
| `NDA Required — [Deal]` | `Your NDA from SourceCo` |
| `Fee Agreement Required — [Deal]` | `Your Fee Agreement from SourceCo` |
| `Data room open — Project [Name]` | `Data room open — Project [Name]` (correct) |
| `You've been assigned a new deal — [Deal]` | `✨ New Deal Assigned: [Deal]` |
| `Deal ownership update — [Deal]` | `Deal Modified: [Company]` |
| `New inquiry from [Buyer] — [Deal]` | `🏢 New Owner Inquiry: [Company] ([Revenue])` |
| `Buyer introduction update — [Deal]` | `🤝 Owner Intro Requested: [Buyer] → [Company]` |
| `New message from SourceCo re: [Deal]` | `New message from SourceCo re: [Deal]` (correct) |
| `New Buyer Message: [Deal] — [Buyer]` | `New Buyer Message: [Deal] — [Buyer]` (correct) |
| `Still exploring? Here's what to do next` | `Still looking? Here's what other buyers are pursuing.` |
| `Your SourceCo journey — 1 week check-in` | `What's in the pipeline right now.` |
| `Quick update on your request` | `Quick update on your request.` (period) |
| `[Task Title] — assigned to you` | `New Task Assigned: [Task Title]` |
| `New signup: [Name] from [Company]` | `New User Registration: [Name] ([Email])` |

### 3. Wrong edge function names

| Catalog says | Actual function |
|---|---|
| `resolve-email-verification` | `send-verification-success-email` / `send-simple-verification-email` |
| `send-custom-reset-email` | `password-reset` |
| `invite-marketplace-buyer` | `send-marketplace-invitation` |
| `send-connection-confirmation` | `send-connection-notification` (type: user_confirmation) |
| `send-connection-approval` | `send-connection-notification` (type: approval_notification) |
| `journey-admin-new-user` | `user-journey-notifications` (event_type: user_created, admin notify) |
| `send-task-notification` | `send-task-notification-email` |
| `notify-owner-inquiry` | `send-owner-inquiry-notification` |
| `notify-owner-intro` | `send-owner-intro-notification` |

### 4. No "design preview" capability

The user asked for design previews. Currently the catalog is text-only. We should add an expandable preview row that shows a rendered HTML preview of each email's template design when clicked — or at minimum a "Preview" button that renders the email HTML in an iframe/modal.

## Plan

### Step 1: Create corrected & complete email catalog data

Rewrite the `EMAIL_CATALOG` array with:
- All 40+ actual email types from every edge function that calls `sendEmail()`
- Exact subject lines copied from the source code
- Correct edge function names
- Add a `variants` note where one function sends multiple email types

### Step 2: Add email preview capability

Add an expandable row or modal that shows a mini HTML preview of each email's design. Since we can't render the actual edge function HTML client-side, we'll add a `designNotes` field describing the template layout (e.g., "Branded wrapper, CTA button, bullet list") and a `previewHtml` field with a representative static HTML snippet that can be rendered in an iframe.

### Files changed
- `src/components/admin/emails/EmailCatalog.tsx` — complete rewrite of the data array + add preview UI

