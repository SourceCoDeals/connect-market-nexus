
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminNotificationRequest {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { first_name, last_name, email, company }: AdminNotificationRequest = await req.json();

    console.log(`Sending admin notification for new user: ${email}`);

    // Enhanced retry logic for email delivery
    let emailSent = false;
    let retryCount = 0;
    const maxRetries = 3;
    const providers = ['resend', 'brevo'];

    for (const provider of providers) {
      if (emailSent) break;
      
      retryCount = 0;
      while (!emailSent && retryCount < maxRetries) {
        try {
          let response;
          
          if (provider === 'resend') {
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (!resendApiKey) {
              console.log("Resend API key not found, trying next provider");
              break;
            }
            
            response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "admin@yourdomain.com",
                to: ["admin@yourdomain.com"],
                subject: "New User Registration - Action Required",
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">New User Registration</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="color: #007bff; margin-top: 0;">User Details</h3>
                      <p><strong>Name:</strong> ${first_name} ${last_name}</p>
                      <p><strong>Email:</strong> ${email}</p>
                      <p><strong>Company:</strong> ${company || 'Not provided'}</p>
                      <p><strong>Registration Time:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0; color: #856404;"><strong>Action Required:</strong> Please review and approve/reject this user registration in the admin panel.</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${req.headers.get('origin')}/admin/users" 
                         style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Review User Registration
                      </a>
                    </div>
                    <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
                      This is an automated notification from your application's user registration system.
                    </p>
                  </div>
                `,
              }),
            });
          } else if (provider === 'brevo') {
            const brevoApiKey = Deno.env.get("BREVO_API_KEY");
            if (!brevoApiKey) {
              console.log("Brevo API key not found, trying next provider");
              break;
            }
            
            response = await fetch("https://api.brevo.com/v3/smtp/email", {
              method: "POST",
              headers: {
                "api-key": brevoApiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sender: {
                  name: "Admin Notifications",
                  email: "admin@yourdomain.com"
                },
                to: [{ email: "admin@yourdomain.com", name: "Admin" }],
                subject: "New User Registration - Action Required",
                htmlContent: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">New User Registration</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="color: #007bff; margin-top: 0;">User Details</h3>
                      <p><strong>Name:</strong> ${first_name} ${last_name}</p>
                      <p><strong>Email:</strong> ${email}</p>
                      <p><strong>Company:</strong> ${company || 'Not provided'}</p>
                      <p><strong>Registration Time:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0; color: #856404;"><strong>Action Required:</strong> Please review and approve/reject this user registration in the admin panel.</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${req.headers.get('origin')}/admin/users" 
                         style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Review User Registration
                      </a>
                    </div>
                    <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
                      This is an automated notification from your application's user registration system.
                    </p>
                  </div>
                `,
              }),
            });
          }

          if (response && response.ok) {
            console.log(`Admin notification sent successfully via ${provider}`);
            emailSent = true;
            break;
          } else {
            retryCount++;
            console.error(`${provider} attempt ${retryCount} failed:`, response ? await response.text() : 'No response');
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        } catch (error) {
          retryCount++;
          console.error(`${provider} attempt ${retryCount} error:`, error);
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
    }

    if (!emailSent) {
      console.error("All email delivery attempts failed");
      return new Response(
        JSON.stringify({ 
          error: "Failed to send admin notification",
          warning: "User registration successful but admin was not notified"
        }),
        {
          status: 207, // Multi-status: partial success
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin notification sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in enhanced-admin-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
