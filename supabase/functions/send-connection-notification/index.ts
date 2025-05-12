
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ADMIN_EMAILS = ["adam.haile@sourcecodeals.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserNotificationRequest {
  type: 'approved' | 'rejected';
  userId: string;
  userEmail: string;
  firstName: string;
  listingName: string;
}

interface AdminNotificationRequest {
  type: 'new_request';
  listing: {
    title: string;
    category: string;
    location: string;
  };
  buyer: {
    name: string;
    email: string;
    company?: string;
  };
  timestamp: string;
}

type NotificationRequest = UserNotificationRequest | AdminNotificationRequest;

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
    
    const requestData = JSON.parse(text) as NotificationRequest;
    console.log("Parsed request data:", requestData);
    
    // Check if it's a user notification or admin notification
    if ('type' in requestData && (requestData.type === 'approved' || requestData.type === 'rejected')) {
      return await handleUserNotification(requestData as UserNotificationRequest);
    } else if ('type' in requestData && requestData.type === 'new_request') {
      return await handleAdminNotification(requestData as AdminNotificationRequest);
    } else {
      throw new Error("Invalid notification type");
    }
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

async function handleUserNotification(data: UserNotificationRequest): Promise<Response> {
  const { type, userEmail, firstName, listingName } = data;
  
  if (!type || !userEmail || !firstName || !listingName) {
    throw new Error("Missing required fields in request");
  }
  
  let subject = '';
  let htmlContent = '';
  let textContent = '';
  
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
    textContent = `Hi ${firstName},\n\nGreat news! Your connection request for ${listingName} has been approved!\n\nPlease log in to see details: https://marketplace.sourcecodeals.com/my-requests\n\n— The SourceCo Team`;
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
    textContent = `Hi ${firstName},\n\nWe wanted to let you know your connection request for ${listingName} was not approved at this time.\n\nIf you have questions, please reply to this email.\n\n— The SourceCo Team`;
  }

  console.log("Sending email to:", userEmail);
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
        email: userEmail,
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
  
  try {
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
        JSON.stringify({ success: false, message: "Email failed to send", error: responseData }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    console.log("Email sent successfully:", responseData);
    
    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error during Brevo API call:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Email sending failed", error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}

async function handleAdminNotification(data: AdminNotificationRequest): Promise<Response> {
  const { listing, buyer, timestamp } = data;
  
  if (!listing || !buyer || !timestamp) {
    throw new Error("Missing required fields in admin notification request");
  }

  const subject = `🔔 New Connection Request – ${listing.title}`;
  const htmlContent = `
    <p>A new connection request has been submitted.</p>

    <p><strong>Listing:</strong> ${listing.title}<br/>
      <strong>Category:</strong> ${listing.category}<br/>
      <strong>Location:</strong> ${listing.location}</p>

    <p><strong>Buyer:</strong> ${buyer.name}<br/>
      <strong>Email:</strong> ${buyer.email}<br/>
      <strong>Company:</strong> ${buyer.company || "-"}</p>

    <p><strong>Submitted:</strong> ${timestamp}</p>

    <p><a href="https://sourcecodeals.com/admin/connection-requests" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">→ View Request</a></p>
  `;
  
  const textContent = `
A new connection request has been submitted.

Listing: ${listing.title}
Category: ${listing.category}
Location: ${listing.location}

Buyer: ${buyer.name}
Email: ${buyer.email}
Company: ${buyer.company || "-"}

Submitted: ${timestamp}

View Request: https://sourcecodeals.com/admin/connection-requests
  `;

  console.log("Sending admin notification email");
  
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
    }
  };
  
  try {
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
      console.error("Error sending admin email via Brevo:", responseData);
      return new Response(
        JSON.stringify({ success: false, message: "Admin email failed to send", error: responseData }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    console.log("Admin email sent successfully:", responseData);
    
    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error during Brevo API call:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Admin email sending failed", error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
}

serve(handler);
