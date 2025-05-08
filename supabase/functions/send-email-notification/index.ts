
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  type: 'verification' | 'approval' | 'rejection' | 'connection_approved' | 'connection_rejected';
  email: string;
  firstName: string;
  data?: {
    verificationLink?: string;
    rejectionReason?: string;
    listingName?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Get API key from environment
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({
        error: "Missing Resend API key",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    const { type, email, firstName, data } = await req.json() as EmailPayload;
    let subject = "";
    let htmlContent = "";
    
    switch (type) {
      case 'verification':
        subject = "✅ Please verify your email for SourceCo Marketplace";
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>Thank you for registering with SourceCo Marketplace!</p>
          <p>Please click the link below to verify your email address:</p>
          <p><a href="${data?.verificationLink}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
          <p>This step is required to activate your account.</p>
          <p>— The SourceCo Team</p>
        `;
        break;
      
      case 'approval':
        subject = "🎉 Your SourceCo Marketplace account is approved!";
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>Good news — your account has been approved!</p>
          <p>You can now log in and start exploring exclusive listings.</p>
          <p><a href="https://marketplace.sourcecodeals.com/login" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 4px;">Login</a></p>
          <p>— The SourceCo Team</p>
        `;
        break;
      
      case 'rejection':
        subject = "❌ Your SourceCo Marketplace account request";
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>We're sorry — your account request was not approved.</p>
          <p>Reason:<br>${data?.rejectionReason || "No specific reason provided."}</p>
          <p>If you believe this was a mistake, please reply to this email.</p>
          <p>— The SourceCo Team</p>
        `;
        break;
      
      case 'connection_approved':
        subject = "✅ Your connection request has been approved!";
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>Great news — your connection request for:</p>
          <p><strong>${data?.listingName}</strong></p>
          <p>has been approved!</p>
          <p>Please log in to see details.</p>
          <p><a href="https://marketplace.sourcecodeals.com/my-requests" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 4px;">Go to My Requests</a></p>
          <p>— The SourceCo Team</p>
        `;
        break;
      
      case 'connection_rejected':
        subject = "❌ Your connection request update";
        htmlContent = `
          <h1>Hi ${firstName},</h1>
          <p>We wanted to let you know your connection request for:</p>
          <p><strong>${data?.listingName}</strong></p>
          <p>was not approved at this time.</p>
          <p>If you have questions, please reply to this email.</p>
          <p>— The SourceCo Team</p>
        `;
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: "Invalid email type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    const result = await resend.emails.send({
      from: "SourceCo Marketplace <notifications@sourcecodeals.com>",
      to: [email],
      subject,
      html: htmlContent,
    });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
