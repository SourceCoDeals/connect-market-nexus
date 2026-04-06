

# Fix Approval Modal + Email Content

## Two Problems

### Problem 1: Modal is misleading
The ApprovalEmailDialog shows editable Subject, Welcome Message, and Signature fields — but `sendCustomApprovalEmail` in `use-admin-email.ts` (line 323-328) **ignores all of them**. It only passes `userId` and `userEmail` to `send-templated-approval-email`. The customization fields are completely non-functional.

### Problem 2: Email content is wrong
`send-templated-approval-email` checks NDA status. For new users (NDA always unsigned), it sends "Sign Your NDA" as the main CTA pointing to `/pending-approval`. But this is a **marketplace signup approval** email — the primary message should welcome them to browse deals, with documents mentioned secondarily.

## Changes

### 1. `src/components/admin/ApprovalEmailDialog.tsx` — Simplify to confirmation dialog

Remove all non-functional fields (subject input, message textarea, signature editor). Replace with a clean confirmation dialog that shows:
- User info card (name, email, current status)
- Brief description of what will happen: "This will approve their account and send a welcome email with instructions to browse the marketplace."
- A preview summary of the email content (not editable, just informational):
  - Subject line shown as read-only text
  - Key points: account approved, browse marketplace CTA, documents info at bottom
- Approve button

Remove `EditableSignature` import, `customSubject`/`customMessage`/`customSignatureHtml`/`customSignatureText` state, and the `DEFAULT_APPROVAL_EMAIL` constant.

### 2. `supabase/functions/send-templated-approval-email/index.ts` — Fix email content

**Both variants** (NDA signed and unsigned) should lead with marketplace approval, not NDA signing.

**For unsigned NDA (the common case):**
- Subject: "Welcome to SourceCo — Your account is approved"
- Body: "Your account has been approved. You now have access to our curated pipeline of off-market acquisition opportunities."
- Main CTA: **"Browse the Marketplace"** → `/marketplace`
- Below the CTA, secondary section: "To unlock full deal details, data rooms, and request introductions, you'll need to sign two standard documents — an NDA and a Fee Agreement. You can request these from your profile or any listing page. It takes about 60 seconds."
- Keep the "A few things to know" bullet list

**For signed NDA:** Keep as-is (already correct — "Browse Deals" CTA).

### 3. `src/components/admin/ApprovalEmailDialog.tsx` — Update interface

Since customization fields are removed, simplify the `onSendApprovalEmail` callback signature. The parent only needs `(user: UserType) => Promise<void>` — no options object needed. But to minimize blast radius, keep the options param and just pass empty/default values from the simplified dialog.

### 4. Deploy `send-templated-approval-email`

### Files changed
- `src/components/admin/ApprovalEmailDialog.tsx` — simplified confirmation UI
- `supabase/functions/send-templated-approval-email/index.ts` — fix email content for unsigned NDA variant

