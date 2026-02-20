
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendViaBervo } from "../_shared/brevo-sender.ts";

/**
 * DEPRECATED: Consolidated into enhanced-email-delivery.
 *
 * This function is preserved as a thin wrapper to avoid breaking any hidden
 * callers. It still handles its 4 email types (account_approved,
 * account_rejected, connection_approved, connection_rejected) but now uses the
 * shared Brevo sender instead of duplicated inline fetch logic.
 *
 * New callers should use 'enhanced-email-delivery' directly.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EmailType =
  | "account_approved"
  | "account_rejected"
  | "connection_approved"
  | "connection_rejected";

interface NotificationEmailRequest {
  type: EmailType;
  recipientEmail: string;
  recipientName: string;
  data?: {
    listingName?: string;
    rejectionReason?: string;
    verificationLink?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-notification-email] DEPRECATED — using shared brevo-sender");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, recipientEmail, recipientName, data }: NotificationEmailRequest = await req.json();

    const firstName = recipientName.split(' ')[0];

    let subject = '';
    let html = '';
    let text = '';

    switch (type) {
      case "account_approved":
        subject = 'Your SourceCo Marketplace account is approved!';
        html = `
          <div style="font-family: Arial, sans-serif; background: #ffffff; padding: 30px; color: #111;">
            <h2 style="font-size: 24px;">Hi ${firstName},</h2>
            <p style="font-size: 16px;">Good news — your account has been approved!</p>
            <p style="font-size: 16px;">You can now log in and start exploring exclusive listings.</p>
            <a href="https://marketplace.sourcecodeals.com/login" style="display: inline-block; background-color: #111; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Login</a>
            <p style="font-size: 12px; color: #aaa; margin-top: 40px;">SourceCo Deals. All rights reserved.</p>
          </div>
        `;
        text = `Hi ${firstName},\n\nGood news — your account has been approved!\n\nYou can now log in and start exploring exclusive listings.\n\nLogin: https://marketplace.sourcecodeals.com/login`;
        break;

      case "account_rejected":
        subject = 'Your SourceCo Marketplace account request';
        html = `
          <div style="font-family: Arial, sans-serif; background: #ffffff; padding: 30px; color: #111;">
            <h2 style="font-size: 24px;">Hi ${firstName},</h2>
            <p style="font-size: 16px;">We're sorry — your account request was not approved.</p>
            ${data?.rejectionReason ? `<p style="font-size: 16px;"><strong>Reason:</strong><br/>${data.rejectionReason}</p>` : ''}
            <p style="font-size: 16px;">If you believe this was a mistake, please reply to this email.</p>
            <p style="font-size: 12px; color: #aaa; margin-top: 40px;">SourceCo Deals. All rights reserved.</p>
          </div>
        `;
        text = `Hi ${firstName},\n\nWe're sorry — your account request was not approved.\n\n${data?.rejectionReason ? `Reason: ${data.rejectionReason}\n\n` : ''}If you believe this was a mistake, please reply to this email.`;
        break;

      case "connection_approved":
        subject = 'Your connection request has been approved!';
        html = `
          <div style="font-family: Arial, sans-serif; background: #ffffff; padding: 30px; color: #111;">
            <h2 style="font-size: 24px;">Hi ${firstName},</h2>
            <p style="font-size: 16px;">Great news — your connection request for:</p>
            <p style="font-size: 16px;"><strong>${data?.listingName || 'Selected listing'}</strong></p>
            <p style="font-size: 16px;">has been approved!</p>
            <p style="font-size: 16px;">Please log in to see details.</p>
            <a href="https://marketplace.sourcecodeals.com/my-requests" style="display: inline-block; background-color: #111; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Go to Marketplace</a>
            <p style="font-size: 12px; color: #aaa; margin-top: 40px;">SourceCo Deals. All rights reserved.</p>
          </div>
        `;
        text = `Hi ${firstName},\n\nGreat news — your connection request for: ${data?.listingName || 'Selected listing'} has been approved!\n\nPlease log in to see details.\n\nGo to Marketplace: https://marketplace.sourcecodeals.com/my-requests`;
        break;

      case "connection_rejected":
        subject = 'Your connection request update';
        html = `
          <div style="font-family: Arial, sans-serif; background: #ffffff; padding: 30px; color: #111;">
            <h2 style="font-size: 24px;">Hi ${firstName},</h2>
            <p style="font-size: 16px;">We wanted to let you know your connection request for:</p>
            <p style="font-size: 16px;"><strong>${data?.listingName || 'Selected listing'}</strong></p>
            <p style="font-size: 16px;">was not approved at this time.</p>
            <p style="font-size: 16px;">If you have questions, please reply to this email.</p>
            <p style="font-size: 12px; color: #aaa; margin-top: 40px;">SourceCo Deals. All rights reserved.</p>
          </div>
        `;
        text = `Hi ${firstName},\n\nWe wanted to let you know your connection request for: ${data?.listingName || 'Selected listing'} was not approved at this time.\n\nIf you have questions, please reply to this email.`;
        break;

      default:
        throw new Error(`Unsupported email type: ${type}`);
    }

    const result = await sendViaBervo({
      to: recipientEmail,
      toName: firstName,
      subject,
      htmlContent: html,
      textContent: text,
      senderName: "SourceCo Marketplace",
      senderEmail: "adam.haile@sourcecodeals.com",
      replyToEmail: "adam.haile@sourcecodeals.com",
      replyToName: "Adam Haile",
    });

    if (!result.success) {
      console.error("Email send failed:", result.error);
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", result.messageId);

    return new Response(
      JSON.stringify({ messageId: result.messageId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
