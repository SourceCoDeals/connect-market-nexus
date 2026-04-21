import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email-sender.ts';

import { requireAdmin } from '../_shared/auth.ts';

/**
 * send-lead-agreement-email
 *
 * Sends a combined Fee Agreement + NDA email to Webflow leads.
 * Attaches NDA.docx and FeeAgreement.docx from Supabase Storage.
 * Plain, personal-style email — optimized for Primary inbox placement.
 *
 * Accepts:
 *   connectionRequestId, leadEmail, leadName, dealTitle, firmId
 *   Optional: senderEmail, senderName, senderTitle, isResend,
 *             customBodyHtml, customBodyText
 */

/** Download a file from agreement-templates bucket and base64-encode it */
async function downloadAttachment(
  supabase: ReturnType<typeof createClient>,
  fileName: string,
): Promise<{ name: string; content: string } | null> {
  try {
    const { data, error } = await supabase.storage.from('agreement-templates').download(fileName);
    if (error || !data) {
      console.warn(`[send-lead-agreement-email] Could not download ${fileName}: ${error?.message}`);
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    // Base64-encode in chunks to avoid call-stack overflow on large files
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Content = btoa(binary);
    console.log(
      `[send-lead-agreement-email] Attached ${fileName} (${arrayBuffer.byteLength} bytes)`,
    );
    return { name: fileName, content: base64Content };
  } catch (err) {
    console.warn(`[send-lead-agreement-email] Attachment fetch error for ${fileName}:`, err);
    return null;
  }
}

/** Build plain email HTML + text from params */
function buildEmailContent(
  displayName: string,
  dealTitle: string,
  senderName: string,
  senderTitle: string | undefined,
  hasAttachments: boolean,
) {
  const attachmentLine = hasAttachments
    ? 'Attached to this email you will find a Fee Agreement and a Non-Disclosure Agreement.'
    : 'We will follow up separately with the Fee Agreement and Non-Disclosure Agreement.';

  const attachmentLineText = hasAttachments
    ? 'Attached to this email you will find a Fee Agreement and a Non-Disclosure Agreement.'
    : 'We will follow up separately with the Fee Agreement and Non-Disclosure Agreement.';

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

  return { htmlContent, textContent };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller: service-role (internal) OR authenticated admin (UI resend)
    const authHeader = req.headers.get('authorization') || '';
    const internalSecret = req.headers.get('x-internal-secret') || '';
    const isServiceRole = authHeader.includes(serviceKey) || internalSecret === serviceKey;

    if (!isServiceRole) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const auth = await requireAdmin(req, supabaseAdmin);
      if (!auth.isAdmin) {
        return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
          status: auth.authenticated ? 403 : 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json()) as {
      connectionRequestId: string;
      leadEmail: string;
      leadName: string;
      dealTitle: string;
      firmId?: string | null;
      senderEmail?: string;
      senderName?: string;
      senderTitle?: string;
      isResend?: boolean;
      customBodyHtml?: string;
      customBodyText?: string;
    };

    const {
      connectionRequestId,
      leadEmail,
      leadName,
      dealTitle,
      firmId,
      senderEmail,
      senderName,
      senderTitle,
      isResend,
      customBodyHtml,
      customBodyText,
    } = body;

    if (!connectionRequestId || !leadEmail) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(
      `[send-lead-agreement-email] START | cr=${connectionRequestId} | to=${leadEmail} | firm=${firmId || 'none'} | resend=${!!isResend}`,
    );

    // ── Check if firm already has signed Fee Agreement (only if firmId provided) ──
    let firm: { fee_agreement_status: string | null; nda_status: string | null } | null = null;
    if (firmId) {
      const { data: firmData } = await supabase
        .from('firm_agreements')
        .select('fee_agreement_status, nda_status')
        .eq('id', firmId)
        .maybeSingle();
      firm = firmData;

      if (!isResend && firm?.fee_agreement_status === 'signed') {
        console.log(
          `[send-lead-agreement-email] SKIP | firm has signed Fee Agreement — sufficient coverage`,
        );

        await supabase
          .from('connection_requests')
          .update({
            lead_agreement_email_status: 'already_covered',
          })
          .eq('id', connectionRequestId);

        return new Response(JSON.stringify({ skipped: true, reason: 'already_covered' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ── Download attachments from Storage ──
    const [ndaAttachment, feeAttachment] = await Promise.all([
      downloadAttachment(supabase, 'NDA.docx'),
      downloadAttachment(supabase, 'FeeAgreement.docx'),
    ]);
    const attachments = [ndaAttachment, feeAttachment].filter(Boolean) as Array<{
      name: string;
      content: string;
    }>;
    const hasAttachments = attachments.length === 2;
    console.log(`[send-lead-agreement-email] Attachments: ${attachments.length}/2 downloaded`);

    // ── Build email content ──
    const displayName = leadName || 'there';
    const resolvedSenderName = senderName || 'SourceCo';
    const resolvedSenderEmail = senderEmail || 'support@sourcecodeals.com';
    const resolvedTitle = dealTitle || 'Deal Opportunity';

    // Use custom body if provided, otherwise generate from template
    let htmlContent: string;
    let textContent: string;
    if (customBodyHtml && customBodyText) {
      htmlContent = customBodyHtml;
      textContent = customBodyText;
    } else {
      const generated = buildEmailContent(
        displayName,
        resolvedTitle,
        resolvedSenderName,
        senderTitle,
        hasAttachments,
      );
      htmlContent = generated.htmlContent;
      textContent = generated.textContent;
    }

    const subject = `${resolvedTitle} - Next Steps`;

    // ── Send email with attachments ──
    const emailResult = await sendEmail({
      templateName: 'lead_agreement_combined',
      to: leadEmail,
      toName: leadName || leadEmail,
      subject,
      textContent,
      htmlContent,
      senderName: resolvedSenderName,
      senderEmail: resolvedSenderEmail,
      replyTo: resolvedSenderEmail,
      isTransactional: true,
      attachments: attachments.length > 0 ? attachments : undefined,
      metadata: {
        connectionRequestId,
        firmId,
        dealTitle: resolvedTitle,
        isResend: !!isResend,
        documentTypes: ['fee_agreement', 'nda'],
        attachmentsIncluded: hasAttachments,
      },
    });

    console.log(
      `[send-lead-agreement-email] Email result: success=${emailResult.success}, emailId=${emailResult.emailId}`,
    );

    // ── Insert document_requests for both doc types (only if firmId provided) ──
    const correlationId = emailResult.correlationId || crypto.randomUUID();
    if (firmId) {
      for (const docType of ['fee_agreement', 'nda'] as const) {
        try {
          await supabase.from('document_requests').insert({
            firm_id: firmId,
            user_id: connectionRequestId,
            agreement_type: docType,
            status: emailResult.success ? 'email_sent' : 'requested',
            requested_at: new Date().toISOString(),
            recipient_email: leadEmail,
            recipient_name: leadName || null,
            email_sent_at: emailResult.success ? new Date().toISOString() : null,
            email_provider_message_id: emailResult.providerMessageId || null,
            email_correlation_id: correlationId,
            last_email_error: emailResult.error || null,
          });
        } catch (docErr) {
          console.warn(
            `[send-lead-agreement-email] document_requests insert error for ${docType}:`,
            docErr,
          );
        }
      }
    }

    // ── Update connection_requests with tracking info ──
    await supabase
      .from('connection_requests')
      .update({
        lead_agreement_email_sent_at: emailResult.success ? new Date().toISOString() : null,
        lead_agreement_email_status: emailResult.success ? 'sent' : 'failed',
        lead_agreement_sender_email: resolvedSenderEmail,
        lead_agreement_outbound_id: emailResult.emailId || null,
        lead_fee_agreement_email_sent: emailResult.success,
        lead_fee_agreement_email_sent_at: emailResult.success ? new Date().toISOString() : null,
        lead_nda_email_sent: emailResult.success,
        lead_nda_email_sent_at: emailResult.success ? new Date().toISOString() : null,
      })
      .eq('id', connectionRequestId);

    // ── Update firm_agreements status if not already sent (only if firmId provided) ──
    if (emailResult.success && firmId) {
      const firmUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (firm?.fee_agreement_status !== 'signed') {
        firmUpdate.fee_agreement_status = 'sent';
        firmUpdate.fee_agreement_sent_at = new Date().toISOString();
        firmUpdate.fee_agreement_email_sent_at = new Date().toISOString();
      }
      if (firm?.nda_status !== 'signed') {
        firmUpdate.nda_status = 'sent';
        firmUpdate.nda_sent_at = new Date().toISOString();
        firmUpdate.nda_email_sent_at = new Date().toISOString();
      }
      await supabase.from('firm_agreements').update(firmUpdate).eq('id', firmId);
    }

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResult.error || 'Failed to send email',
          correlationId,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResult.emailId,
        correlationId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  } catch (err) {
    console.error('[send-lead-agreement-email] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }
});
