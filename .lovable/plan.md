

# Add Inquiry Confirmation Email to Buyer

## What

When a buyer sends a question via "Ask a Question" on a listing page, send them a confirmation email: "We received your message about [Deal Title]. A team member will respond shortly. You'll receive a notification via email when they reply, but please respond directly on the platform."

## Approach

Use the existing Brevo email infrastructure (`sendEmail` + `wrapEmailHtml`) — same pattern as `notify-buyer-new-message`. Create a new edge function `notify-buyer-inquiry-received` that:

1. Accepts `listing_id`, `buyer_email`, `buyer_name`, `deal_title`, `message_preview`
2. Builds a branded confirmation email using `wrapEmailHtml`
3. Sends via `sendEmail` through Brevo

Then invoke it fire-and-forget from `ListingSidebarActions.tsx` after a successful message send.

## Email Content

- Subject: "We received your message about [Deal Title]"
- Body:
  - "Hi [Name],"
  - "Thank you for reaching out about [Deal Title]. We have received your message and a team member will review it shortly."
  - Quote block showing their message preview
  - "When we respond, you will receive an email notification. Please reply directly on the platform to keep all communication in one place."
  - CTA button: "Go to Messages" → links to `/messages`
  - Footer with SourceCo branding

## Files

### New
- `supabase/functions/notify-buyer-inquiry-received/index.ts` — new edge function using `sendEmail` + `wrapEmailHtml`, no auth required (verify_jwt=false, fire-and-forget like `notify-support-inbox`)

### Modified
- `src/components/listing-detail/ListingSidebarActions.tsx` — after successful message send (around line 134), invoke `notify-buyer-inquiry-received` fire-and-forget with the buyer's info and listing title
- `supabase/config.toml` — add the new function entry
- `src/components/admin/emails/AdminEmailRouting.tsx` — add "Inquiry Confirmation to Buyer" row in the Messaging category

### Deploy
- Deploy `notify-buyer-inquiry-received` edge function

