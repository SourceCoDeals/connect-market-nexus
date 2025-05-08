
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
        break;
        
      default:
        throw new Error(`Invalid email notification type: ${type}`);
    }

    console.log("Sending email to:", email);
    console.log("Email subject:", subject);
    
    const emailResponse = await resend.emails.send({
      from: "SourceCo Marketplace <notifications@sourcecodeals.com>",
      to: [email],
      subject: subject,
      html: htmlContent,
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
