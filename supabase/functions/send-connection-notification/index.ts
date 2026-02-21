
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAuth, escapeHtml, escapeHtmlWithBreaks } from "../_shared/auth.ts";

interface ConnectionNotificationRequest {
  type: 'user_confirmation' | 'admin_notification';
  recipientEmail: string;
  recipientName: string;
  requesterName: string;
  requesterEmail: string;
  listingTitle: string;
  listingId: string;
  message?: string;
  requestId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    // AUTH: Requires authenticated user (users submit connection requests)
    const auth = await requireAuth(req);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const requestData: ConnectionNotificationRequest = await req.json();
    
    const {
      type,
      recipientEmail,
      recipientName,
      requesterName,
      requesterEmail,
      listingTitle,
      listingId,
      message,
      requestId
    } = requestData;

    console.log("Sending connection notification:", {
      type,
      recipientEmail,
      requesterName,
      listingTitle,
      requestId
    });

    const loginUrl = `https://marketplace.sourcecodeals.com/login`;
    const listingUrl = `https://marketplace.sourcecodeals.com/listing/${listingId}`;

    let subject: string;
    let htmlContent: string;

    if (type === 'user_confirmation') {
      // User confirmation email
      subject = `Connection Request Submitted - "${listingTitle}"`;
      
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Request Submitted Successfully</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your connection request has been submitted and is being reviewed.</p>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">Request Details</h2>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #475569;">Listing:</strong> ${escapeHtml(listingTitle)}
            </div>

            ${message ? `
            <div style="margin-top: 20px;">
              <strong style="color: #475569;">Your Message:</strong>
              <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #059669;">
                ${escapeHtmlWithBreaks(message)}
              </div>
            </div>
            ` : ''}
          </div>
          
          <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0891b2;">
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">What happens next?</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569;">
              <li>The listing owner will review your request</li>
              <li>You'll receive an email with their response (typically within 24-48 hours)</li>
              <li>If approved, you'll get access to detailed financial information</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${listingUrl}" 
               style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
              View Listing
            </a>
            <a href="${loginUrl}" 
               style="background: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
            <p>Thank you for your interest! We'll keep you updated on the status of your request.</p>
            <p>If you have any questions, contact us at <a href="mailto:adam.haile@sourcecodeals.com" style="color: #059669;">adam.haile@sourcecodeals.com</a></p>
          </div>
        </div>
      `;
    } else {
      // Admin notification email
      subject = `New Connection Request for "${listingTitle}"`;
      
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Connection Request</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Someone is interested in connecting with you about your listing.</p>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">Connection Details</h2>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #475569;">From:</strong> ${escapeHtml(requesterName)} (${escapeHtml(requesterEmail)})
            </div>

            <div style="margin-bottom: 15px;">
              <strong style="color: #475569;">Listing:</strong> ${escapeHtml(listingTitle)}
            </div>

            ${message ? `
            <div style="margin-top: 20px;">
              <strong style="color: #475569;">Message:</strong>
              <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #3b82f6;">
                ${escapeHtmlWithBreaks(message)}
              </div>
            </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
              View in Dashboard
            </a>
            <a href="${listingUrl}" 
               style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Listing
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
            <p>This notification was sent automatically when someone requested to connect with you. Please log in to your dashboard to respond.</p>
            <p>If you have any questions, contact us at <a href="mailto:adam.haile@sourcecodeals.com" style="color: #059669;">adam.haile@sourcecodeals.com</a></p>
          </div>
        </div>
      `;
    }

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured - cannot send email");
      throw new Error("BREVO_API_KEY not configured");
    }
    
    console.log("Using Brevo API to send email to:", recipientEmail);

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: "SourceCo Marketplace",
          email: "adam.haile@sourcecodeals.com"
        },
        to: [{
          email: recipientEmail,
          name: recipientName
        }],
        subject: subject,
        htmlContent: htmlContent,
        replyTo: {
          email: "adam.haile@sourcecodeals.com",
          name: "Adam Haile - SourceCo"
        },
        // Disable click tracking to prevent broken links
        params: {
          trackClicks: false,
          trackOpens: true
        }
      })
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Error sending email via Brevo:", {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        error: errorText,
        recipient: recipientEmail,
        type
      });
      throw new Error(`Brevo API error: ${errorText}`);
    }

    const responseData = await emailResponse.json();
    console.log("Connection notification sent successfully:", {
      type,
      recipient: recipientEmail,
      messageId: responseData.messageId
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Connection notification sent successfully" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error("Error in send-connection-notification function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send connection notification" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
};

serve(handler);
