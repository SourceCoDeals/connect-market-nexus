
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserNotificationRequest {
  email: string;
  subject: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  actionUrl?: string;
  actionText?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      subject,
      message,
      type = 'info',
      actionUrl,
      actionText
    }: UserNotificationRequest = await req.json();

    console.log("Sending user notification:", { email, subject, type });

    const typeColors = {
      info: '#3b82f6',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626'
    };

    const typeEmojis = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
            ${typeEmojis[type]} ${subject}
          </h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">SourceCo Marketplace Notification</p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid ${typeColors[type]};">
            ${message.replace(/\n/g, "<br>")}
          </div>
        </div>
        
        ${actionUrl && actionText ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" 
             style="background: ${typeColors[type]}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            ${actionText}
          </a>
        </div>
        ` : ''}
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
          <p>This notification was sent from SourceCo Marketplace.</p>
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
          email: email,
          name: email.split('@')[0] // Use email prefix as name fallback
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

    console.log("User notification sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User notification sent successfully" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error("Error in send-user-notification function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send user notification" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
};

serve(handler);
