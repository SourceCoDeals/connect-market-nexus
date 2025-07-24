
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Updated to use ahaile14@gmail.com as requested admin email
const ADMIN_EMAILS = [
  "ahaile14@gmail.com"
];

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
    
    const textContent = `
      A new user has signed up to the SourceCo Marketplace:
      Name: ${fullName}
      Email: ${email}
      Company: ${companyName}
      Time: ${timestamp}
      View User in Admin Panel: https://marketplace.sourcecodeals.com/admin/users
    `;

    console.log(`Sending admin notification to ${ADMIN_EMAILS.length} recipients`);
    
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY environment variable is not set");
    }
    
    const brevoPayload = {
      sender: {
        name: "SourceCo Marketplace",
        email: "adam.haile@sourcecodeals.com"
      },
      to: ADMIN_EMAILS.map(email => ({
        email: email
      })),
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent,
      replyTo: {
        email: "adam.haile@sourcecodeals.com",
        name: "Adam Haile"
      },
      // Disable click tracking to prevent broken links
      params: {
        trackClicks: false,
        trackOpens: true
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
      console.error("Error sending admin notification via Brevo:", responseData);
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
