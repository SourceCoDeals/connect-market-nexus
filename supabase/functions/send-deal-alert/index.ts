import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DealAlertRequest {
  alert_id: string;
  user_email: string;
  user_id: string;
  listing_id: string;
  alert_name: string;
  listing_data: {
    id: string;
    title: string;
    category: string;
    location: string;
    revenue: number;
    ebitda: number;
    description: string;
    image_url?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Deal alert function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { alert_id, user_email, user_id, listing_id, alert_name, listing_data }: DealAlertRequest = await req.json();

    console.log("Processing deal alert:", { alert_id, user_email, listing_id });

    // Format currency values
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    // Create the email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Deal Alert - ${listing_data.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #fff; padding: 30px 20px; border: 1px solid #e5e7eb; }
            .listing-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .listing-title { font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 10px; }
            .listing-meta { color: #64748b; margin-bottom: 15px; }
            .financials { display: flex; gap: 20px; margin: 15px 0; }
            .financial-item { background: white; padding: 15px; border-radius: 6px; flex: 1; text-align: center; }
            .financial-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
            .financial-value { font-size: 18px; font-weight: bold; color: #1e293b; }
            .description { margin: 15px 0; color: #374151; }
            .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
            .footer { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #64748b; font-size: 14px; }
            .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 New Deal Alert</h1>
              <p>A new opportunity matches your "${alert_name}" criteria</p>
            </div>
            
            <div class="content">
              <div class="alert-info">
                <strong>Alert:</strong> ${alert_name}<br>
                <strong>Matched:</strong> ${new Date().toLocaleDateString()}
              </div>
              
              <div class="listing-card">
                <div class="listing-title">${listing_data.title}</div>
                <div class="listing-meta">
                  📍 ${listing_data.location} • 🏷️ ${listing_data.category}
                </div>
                
                <div class="financials">
                  <div class="financial-item">
                    <div class="financial-label">Revenue</div>
                    <div class="financial-value">${formatCurrency(listing_data.revenue)}</div>
                  </div>
                  <div class="financial-item">
                    <div class="financial-label">EBITDA</div>
                    <div class="financial-value">${formatCurrency(listing_data.ebitda)}</div>
                  </div>
                </div>
                
                <div class="description">
                  ${listing_data.description.length > 200 
                    ? listing_data.description.substring(0, 200) + '...' 
                    : listing_data.description}
                </div>
                
                <a href="https://vhzipqarkmmfuqadefep.supabase.co/listing/${listing_data.id}" class="btn">
                  View Full Details →
                </a>
              </div>
              
              <p><strong>Why you received this:</strong> This listing matches the criteria you set up in your "${alert_name}" deal alert.</p>
              
              <p>Ready to take the next step? Click "View Full Details" to see complete information and request a connection with the seller.</p>
            </div>
            
            <div class="footer">
              <p>You're receiving this because you have an active deal alert named "${alert_name}".</p>
              <p><a href="https://vhzipqarkmmfuqadefep.supabase.co/profile">Manage your alerts</a> | <a href="#">Unsubscribe</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Deal Alerts <deals@vhzipqarkmmfuqadefep.supabase.co>",
      to: [user_email],
      subject: `🚨 New Deal Alert: ${listing_data.title}`,
      html: emailHtml,
    });

    console.log("Email sent:", emailResponse);

    // Update delivery log status
    const { error: updateError } = await supabaseClient
      .from("alert_delivery_logs")
      .update({ 
        delivery_status: "sent", 
        sent_at: new Date().toISOString() 
      })
      .eq("alert_id", alert_id)
      .eq("listing_id", listing_id)
      .eq("user_id", user_id);

    if (updateError) {
      console.error("Error updating delivery log:", updateError);
    }

    // Update last_sent_at for the alert
    const { error: alertUpdateError } = await supabaseClient
      .from("deal_alerts")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", alert_id);

    if (alertUpdateError) {
      console.error("Error updating alert last_sent_at:", alertUpdateError);
    }

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-deal-alert function:", error);

    // Try to update delivery log with error if we have the alert info
    try {
      const body = await req.json();
      if (body.alert_id && body.listing_id && body.user_id) {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        await supabaseClient
          .from("alert_delivery_logs")
          .update({ 
            delivery_status: "failed", 
            error_message: error.message 
          })
          .eq("alert_id", body.alert_id)
          .eq("listing_id", body.listing_id)
          .eq("user_id", body.user_id);
      }
    } catch (logError) {
      console.error("Error updating error log:", logError);
    }

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