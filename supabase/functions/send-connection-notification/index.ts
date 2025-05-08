
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConnectionNotificationRequest {
  type: 'approved' | 'rejected';
  userId: string;
  userEmail: string;
  firstName: string;
  listingName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Connection notification request received");
  
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
    
    const requestData: ConnectionNotificationRequest = JSON.parse(text);
    console.log("Parsed request data:", requestData);
    
    const { type, userEmail, firstName, listingName } = requestData;
    
    if (!type || !userEmail || !firstName || !listingName) {
      throw new Error("Missing required fields in request");
    }
    
    let subject = '';
    let htmlContent = '';
    
    if (type === 'approved') {
      subject = '✅ Your connection request has been approved!';
      htmlContent = `
        <h1>Hi ${firstName},</h1>
        <p>Great news — your connection request for:</p>
        <p><strong>${listingName}</strong></p>
        <p>has been approved!</p>
        <p>Please log in to see details.</p>
        <p><a href="https://marketplace.sourcecodeals.com/my-requests" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Go to Marketplace</a></p>
        <p>— The SourceCo Team</p>
      `;
    } else {
      subject = '❌ Your connection request update';
      htmlContent = `
        <h1>Hi ${firstName},</h1>
        <p>We wanted to let you know your connection request for:</p>
        <p><strong>${listingName}</strong></p>
        <p>was not approved at this time.</p>
        <p>If you have questions, please reply to this email.</p>
        <p>— The SourceCo Team</p>
      `;
    }

    console.log("Sending email to:", userEmail);
    console.log("Email subject:", subject);
    
    const emailResponse = await resend.emails.send({
      from: "SourceCo Marketplace <notifications@sourcecodeals.com>",
      to: [userEmail],
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
    console.error("Error in send-connection-notification function:", error);
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
