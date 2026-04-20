/**
 * Client-side mirror of the edge function's buildEmailContent().
 * Used to generate a preview of the exact email admins will send.
 * Keep in sync with supabase/functions/send-lead-agreement-email/index.ts
 */

export interface LeadAgreementEmailParams {
  displayName: string;
  dealTitle: string;
  senderName: string;
  senderTitle?: string;
  hasAttachments?: boolean;
}

export interface LeadAgreementEmailContent {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export function buildLeadAgreementEmail(
  params: LeadAgreementEmailParams,
): LeadAgreementEmailContent {
  const { displayName, dealTitle, senderName, senderTitle, hasAttachments = true } = params;

  const attachmentLine = hasAttachments
    ? 'Attached to this email you will find a Fee Agreement and a Non-Disclosure Agreement.'
    : 'We will follow up separately with the Fee Agreement and Non-Disclosure Agreement for your review.';

  const attachmentLineText = hasAttachments
    ? 'Attached to this email you will find a Fee Agreement and a Non-Disclosure Agreement.'
    : 'We will follow up separately with the Fee Agreement and Non-Disclosure Agreement for your review.';

  const subject = `${dealTitle} - Next Steps`;

  const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#222;">
<p>Hi ${displayName},</p>
<p>Thank you for requesting access to <strong>${dealTitle}</strong>. We received your submission and appreciate your interest in this opportunity.</p>
<p>Here is what happens next:</p>
<p><strong>1. Fee Agreement &amp; NDA</strong><br/>${attachmentLine} The sourcing fee only applies if you complete a transaction. There are no fees for reviewing materials or having conversations.</p>
<p><strong>2. Review &amp; Sign</strong><br/>Please review both documents and return signed copies by replying to this email. Electronic signatures are perfectly fine.</p>
<p><strong>3. Full Access</strong><br/>Once we receive your signed copies, you will get immediate access to the complete deal profile, data room, and supporting materials.</p>
<p>We look forward to working with you on this.</p>
<p>Best regards,<br/>${senderName}${senderTitle ? `<br/>${senderTitle}` : ''}<br/>SourceCo</p>
</body>
</html>`;

  const textContent = `Hi ${displayName},

Thank you for requesting access to ${dealTitle}. We received your submission and appreciate your interest in this opportunity.

Here is what happens next:

1. Fee Agreement & NDA
${attachmentLineText} The sourcing fee only applies if you complete a transaction. There are no fees for reviewing materials or having conversations.

2. Review & Sign
Please review both documents and return signed copies by replying to this email. Electronic signatures are perfectly fine.

3. Full Access
Once we receive your signed copies, you will get immediate access to the complete deal profile, data room, and supporting materials.

We look forward to working with you on this.

Best regards,
${senderName}${senderTitle ? `\n${senderTitle}` : ''}
SourceCo`;

  return { subject, htmlContent, textContent };
}
