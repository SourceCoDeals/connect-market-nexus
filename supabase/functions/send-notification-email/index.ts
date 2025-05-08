
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, recipientEmail, recipientName, data }: NotificationEmailRequest = await req.json();
    
    const firstName = recipientName.split(' ')[0];
    
    let subject = '';
    let html = '';
    
    switch (type) {
      case "account_approved":
        subject = '🎉 Your SourceCo Marketplace account is approved!';
        html = `
          <h1>Hi ${firstName},</h1>
          <p>Good news — your account has been approved!</p>
          <p>You can now log in and start exploring exclusive listings.</p>
          <p><a href="https://marketplace.sourcecodeals.com/login" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Login</a></p>
          <p>— The SourceCo Team</p>
        `;
        break;
        
      case "account_rejected":
        subject = '❌ Your SourceCo Marketplace account request';
        html = `
          <h1>Hi ${firstName},</h1>
          <p>We're sorry — your account request was not approved.</p>
          ${data?.rejectionReason ? `<p><strong>Reason:</strong><br/>${data.rejectionReason}</p>` : ''}
          <p>If you believe this was a mistake, please reply to this email.</p>
          <p>— The SourceCo Team</p>
        `;
        break;
        
      case "connection_approved":
        subject = '✅ Your connection request has been approved!';
        html = `
          <h1>Hi ${firstName},</h1>
          <p>Great news — your connection request for:</p>
          <p><strong>${data?.listingName || 'Selected listing'}</strong></p>
          <p>has been approved!</p>
          <p>Please log in to see details.</p>
          <p><a href="https://marketplace.sourcecodeals.com/my-requests" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Go to Marketplace</a></p>
          <p>— The SourceCo Team</p>
        `;
        break;
        
      case "connection_rejected":
        subject = '❌ Your connection request update';
        html = `
          <h1>Hi ${firstName},</h1>
          <p>We wanted to let you know your connection request for:</p>
          <p><strong>${data?.listingName || 'Selected listing'}</strong></p>
          <p>was not approved at this time.</p>
          <p>If you have questions, please reply to this email.</p>
          <p>— The SourceCo Team</p>
        `;
        break;
        
      default:
        throw new Error(`Unsupported email type: ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: "SourceCo Marketplace <notifications@sourcecodeals.com>",
      to: [recipientEmail],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
