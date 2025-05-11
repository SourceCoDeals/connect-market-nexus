
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    let text = '';
    
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
        text = `Hi ${firstName},\n\nGood news — your account has been approved!\n\nYou can now log in and start exploring exclusive listings.\n\nLogin: https://marketplace.sourcecodeals.com/login\n\n— The SourceCo Team`;
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
        text = `Hi ${firstName},\n\nWe're sorry — your account request was not approved.\n\n${data?.rejectionReason ? `Reason: ${data.rejectionReason}\n\n` : ''}If you believe this was a mistake, please reply to this email.\n\n— The SourceCo Team`;
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
        text = `Hi ${firstName},\n\nGreat news — your connection request for: ${data?.listingName || 'Selected listing'} has been approved!\n\nPlease log in to see details.\n\nGo to Marketplace: https://marketplace.sourcecodeals.com/my-requests\n\n— The SourceCo Team`;
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
        text = `Hi ${firstName},\n\nWe wanted to let you know your connection request for: ${data?.listingName || 'Selected listing'} was not approved at this time.\n\nIf you have questions, please reply to this email.\n\n— The SourceCo Team`;
        break;
        
      default:
        throw new Error(`Unsupported email type: ${type}`);
    }

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY environment variable is not set");
    }
    
    const brevoPayload = {
      sender: {
        name: "SourceCo Marketplace",
        email: "adam.haile@sourcecodeals.com"
      },
      to: [
        {
          email: recipientEmail,
          name: firstName
        }
      ],
      subject: subject,
      htmlContent: html,
      textContent: text,
      replyTo: {
        email: "adam.haile@sourcecodeals.com",
        name: "Adam Haile"
      }
    };
    
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(brevoPayload)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Error sending email via Brevo:", responseData);
      return new Response(
        JSON.stringify({ error: responseData }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Email sent successfully:", responseData);

    return new Response(JSON.stringify(responseData), {
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
