
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConnectionNotificationRequest {
  recipientEmail: string;
  recipientName: string;
  requesterName: string;
  requesterEmail: string;
  listingTitle: string;
  listingId: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      recipientEmail,
      recipientName,
      requesterName,
      requesterEmail,
      listingTitle,
      listingId,
      message
    }: ConnectionNotificationRequest = await req.json();

    console.log("Sending connection notification:", {
      recipientEmail,
      requesterName,
      listingTitle
    });

    const loginUrl = `https://market.sourcecodeals.com/login`;
    const listingUrl = `https://market.sourcecodeals.com/listing/${listingId}`;

    const subject = `New Connection Request for "${listingTitle}"`;
    
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">New Connection Request</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Someone is interested in connecting with you about your listing.</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">Connection Details</h2>
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #475569;">From:</strong> ${requesterName} (${requesterEmail})
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #475569;">Listing:</strong> ${listingTitle}
          </div>
          
          ${message ? `
          <div style="margin-top: 20px;">
            <strong style="color: #475569;">Message:</strong>
            <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #3b82f6;">
              ${message.replace(/\n/g, "<br>")}
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
          <p>If you have any questions, contact us at <a href="mailto:support@sourcecodeals.com" style="color: #059669;">support@sourcecodeals.com</a></p>
        </div>
      </div>
    `;

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

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
          email: "noreply@sourcecodeals.com"
        },
        to: [{
          email: recipientEmail,
          name: recipientName
        }],
        subject: subject,
        htmlContent: htmlContent,
        replyTo: {
          email: "support@sourcecodeals.com",
          name: "SourceCo Support"
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
      console.error("Error sending email via Brevo:", errorText);
      throw new Error(`Brevo API error: ${errorText}`);
    }

    console.log("Connection notification sent successfully");

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
