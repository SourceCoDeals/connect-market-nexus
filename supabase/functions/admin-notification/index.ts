
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const ADMIN_EMAILS = [
  "adam.haile@sourcecodeals.com",
  "ahaile14@gmail.com"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminNotificationRequest {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Admin notification request received");
  
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
    
    const userData: AdminNotificationRequest = JSON.parse(text);
    console.log("Parsed user data:", userData);
    
    const { first_name, last_name, email, company } = userData;
    
    if (!email) {
      throw new Error("Missing email in request");
    }
    
    const fullName = `${first_name || ''} ${last_name || ''}`.trim() || 'Unknown User';
    const timestamp = new Date().toISOString();
    const companyName = company || 'Not provided';
    
    const subject = `New User Signup – SourceCo Marketplace`;
    const htmlContent = `
      <h2>A new user has signed up to the SourceCo Marketplace:</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Company:</strong> ${companyName}</p>
      <p><strong>Time:</strong> ${timestamp}</p>
      <p><a href="https://marketplace.sourcecodeals.com/admin/users" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">View User in Admin Panel</a></p>
    `;

    console.log(`Sending admin notification to ${ADMIN_EMAILS.length} recipients`);
    
    const emailResponse = await resend.emails.send({
      from: "SourceCo Marketplace <notifications@sourcecodeals.com>",
      to: ADMIN_EMAILS,
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
    console.error("Error in admin-notification function:", error);
    // Return success anyway to ensure signup process isn't blocked
    return new Response(
      JSON.stringify({ error: error.message, status: "Email failed but continuing" }),
      {
        status: 200, // Return 200 even on error to not block signup
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
