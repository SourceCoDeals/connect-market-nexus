
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailNotificationRequest {
  type: 'approval' | 'rejection' | 'verification'; 
  email: string;
  firstName: string;
  data?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Email notification request received");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get request body
    const text = await req.text();
    console.log("Request body:", text);
    
    if (!text) {
      throw new Error("Empty request body");
    }
    
    const requestData: EmailNotificationRequest = JSON.parse(text);
    console.log("Parsed request data:", requestData);
    
    const { type, email, firstName, data } = requestData;
    
    if (!type || !email || !firstName) {
      throw new Error("Missing required fields in request");
    }
    
    let subject = '';
    let htmlContent = '';
    let textContent = '';
    
    switch (type) {
      case 'approval':
        subject = '✅ Your account has been approved!';
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>Great news! Your account has been approved.</p>
          <p>You now have full access to the SourceCo Marketplace.</p>
          <p><a href="https://marketplace.sourcecodeals.com/login" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Go to Marketplace</a></p>
          <p>— The SourceCo Team</p>
        `;
        textContent = `Hi ${firstName},\n\nGreat news! Your account has been approved. You now have full access to the SourceCo Marketplace.\n\nGo to Marketplace: https://marketplace.sourcecodeals.com/login\n\n— The SourceCo Team`;
        break;
        
      case 'rejection':
        subject = 'Account Application Status';
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>Thank you for your interest in the SourceCo Marketplace.</p>
          <p>After reviewing your application, we regret to inform you that we are unable to approve your account at this time.</p>
          ${data?.rejectionReason ? `<p><strong>Reason:</strong> ${data.rejectionReason}</p>` : ''}
          <p>If you have any questions, please reply to this email.</p>
          <p>— The SourceCo Team</p>
        `;
        textContent = `Hi ${firstName},\n\nThank you for your interest in the SourceCo Marketplace.\n\nAfter reviewing your application, we regret to inform you that we are unable to approve your account at this time.\n\n${data?.rejectionReason ? `Reason: ${data.rejectionReason}\n\n` : ''}If you have any questions, please reply to this email.\n\n— The SourceCo Team`;
        break;
        
      case 'verification':
        subject = 'Please verify your email address';
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>Thank you for signing up for the SourceCo Marketplace.</p>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${data?.verificationLink}" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Verify Email</a></p>
          <p>If you did not sign up for an account, please ignore this email.</p>
          <p>— The SourceCo Team</p>
        `;
        textContent = `Hi ${firstName},\n\nThank you for signing up for the SourceCo Marketplace.\n\nPlease verify your email address by clicking the link below:\n\n${data?.verificationLink}\n\nIf you did not sign up for an account, please ignore this email.\n\n— The SourceCo Team`;
        break;
        
      default:
        throw new Error(`Invalid email notification type: ${type}`);
    }

    console.log("Sending email to:", email);
    console.log("Email subject:", subject);
    
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
          email: email,
          name: firstName
        }
      ],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent,
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
    console.error("Error in send-email-notification function:", error);
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
