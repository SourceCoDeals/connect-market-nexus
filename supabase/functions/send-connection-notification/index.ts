
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Update to only include the specified admin email
const ADMIN_EMAILS = ["adam.haile@sourcecodeals.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserNotificationRequest {
  type: 'approved' | 'rejected' | 'request_received';
  userId?: string;
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
    message?: string;
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
    if ('type' in requestData) {
      if (requestData.type === 'approved' || requestData.type === 'rejected') {
        return await handleUserNotification(requestData as UserNotificationRequest);
      } else if (requestData.type === 'request_received') {
        return await handleRequestReceivedNotification(requestData as UserNotificationRequest);
      } else if (requestData.type === 'new_request') {
        return await handleAdminNotification(requestData as AdminNotificationRequest);
      } else {
        throw new Error("Invalid notification type");
      }
    } else {
      throw new Error("Invalid notification format");
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
      <p>Please log in to your account to view the details.</p>
      <p><a href="https://market.sourcecodeals.com/my-requests" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">→ View My Requests</a></p>
      <p>— The SourceCo Team</p>
    `;
    textContent = `Hi ${firstName},\n\nGreat news! Your connection request for ${listingName} has been approved.\n\nYou can now log in and view the details here:\nhttps://market.sourcecodeals.com/my-requests\n\n— The SourceCo Team`;
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
  
  return await sendEmail({
    to: [{ email: userEmail, name: firstName }],
    subject,
    htmlContent,
    textContent
  });
}

async function handleRequestReceivedNotification(data: UserNotificationRequest): Promise<Response> {
  const { userEmail, firstName, listingName } = data;
  
  if (!userEmail || !firstName || !listingName) {
    throw new Error("Missing required fields in request");
  }
  
  const subject = '✅ We\'ve received your connection request';
  const htmlContent = `
    <p>Hi ${firstName},</p>

    <p>Thanks for your interest in <strong>${listingName}</strong>!</p>

    <p>We've received your request to connect with the owner. Our team will review it and reach out if it's a fit.</p>

    <p>
      <a href="https://market.sourcecodeals.com/my-requests"
         style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">
         🔗 View Your Requests
      </a>
    </p>

    <p>— The SourceCo Team</p>
  `;
  
  const textContent = `
    Hi ${firstName},

    Thanks for your interest in ${listingName}!

    We've received your request to connect with the owner. Our team will review it and reach out soon if it's a fit.

    → View your requests: https://market.sourcecodeals.com/my-requests

    — The SourceCo Team
  `;

  console.log("Sending request received notification email to:", userEmail);
  
  return await sendEmail({
    to: [{ email: userEmail, name: firstName }],
    subject,
    htmlContent,
    textContent
  });
}

async function handleAdminNotification(data: AdminNotificationRequest): Promise<Response> {
  const { listing, buyer, timestamp } = data;
  
  if (!listing || !buyer || !timestamp) {
    throw new Error("Missing required fields in admin notification request");
  }

  const subject = `🔔 New Connection Request – ${listing.title}`;
  
  let htmlContent = `
    <p>A new connection request has been submitted.</p>

    <p><strong>Listing:</strong> ${listing.title}<br/>
      <strong>Category:</strong> ${listing.category}<br/>
      <strong>Location:</strong> ${listing.location}</p>

    <p><strong>Buyer:</strong> ${buyer.name}<br/>
      <strong>Email:</strong> ${buyer.email}<br/>
      <strong>Company:</strong> ${buyer.company || "-"}</p>
  `;

  let textContent = `
A new connection request has been submitted.

Listing: ${listing.title}
Category: ${listing.category}
Location: ${listing.location}

Buyer: ${buyer.name}
Email: ${buyer.email}
Company: ${buyer.company || "-"}
  `;

  // Add buyer's message if provided
  if (buyer.message) {
    htmlContent += `
    <p><strong>Buyer's Message:</strong></p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
      ${buyer.message}
    </div>`;
    
    textContent += `
Buyer's Message:
${buyer.message}
    `;
  }

  htmlContent += `
    <p><strong>Submitted:</strong> ${timestamp}</p>

    <p><a href="https://market.sourcecodeals.com/admin/connection-requests" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">→ View Request</a></p>
  `;
  
  textContent += `

Submitted: ${timestamp}

View Request: https://market.sourcecodeals.com/admin/connection-requests
  `;

  console.log("Sending admin notification email");
  
  return await sendEmail({
    to: ADMIN_EMAILS.map(email => ({ email })),
    subject,
    htmlContent,
    textContent
  });
}

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailOptions {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
}

async function sendEmail(options: EmailOptions): Promise<Response> {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    throw new Error("BREVO_API_KEY environment variable is not set");
  }
  
  const brevoPayload = {
    sender: {
      name: "SourceCo Marketplace",
      email: "adam.haile@sourcecodeals.com"
    },
    to: options.to,
    subject: options.subject,
    htmlContent: options.htmlContent,
    textContent: options.textContent,
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

serve(handler);
