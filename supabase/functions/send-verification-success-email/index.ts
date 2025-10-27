import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationSuccessRequest {
  email: string;
  firstName: string;
  lastName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Email verification success notification request received");
    
    const requestBody = await req.json();
    console.log("Request body:", JSON.stringify(requestBody));

    const { email, firstName, lastName }: VerificationSuccessRequest = requestBody;

    if (!email) {
      throw new Error("Email is required");
    }

    console.log(`Sending email verification success notification to: ${email}`);

    const userName = firstName && lastName ? `${firstName} ${lastName}` : firstName || 'there';

    const emailResponse = await resend.emails.send({
      from: "SourceCodeALS <noreply@sourcecodeals.com>",
      to: [email],
      subject: "✅ Email Verified Successfully - What's Next",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verified Successfully</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
              .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
              .content { padding: 40px 30px; }
              .success-icon { text-align: center; margin-bottom: 30px; }
              .success-icon div { width: 80px; height: 80px; border-radius: 50%; background-color: #10b981; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
              .success-icon span { font-size: 36px; color: white; }
              h2 { color: #1f2937; margin-bottom: 16px; font-size: 24px; font-weight: 600; }
              .steps { background-color: #f3f4f6; border-radius: 12px; padding: 30px; margin: 30px 0; }
              .step { display: flex; align-items: flex-start; margin-bottom: 20px; }
              .step:last-child { margin-bottom: 0; }
              .step-number { background-color: #6366f1; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 16px; flex-shrink: 0; font-size: 14px; }
              .step-content h3 { margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600; }
              .step-content p { margin: 0; color: #6b7280; font-size: 14px; }
              .completed { opacity: 0.7; }
              .completed .step-number { background-color: #10b981; }
              .timeline { margin: 30px 0; padding: 20px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6; }
              .timeline h3 { margin: 0 0 12px 0; color: #1e40af; font-size: 18px; }
              .timeline p { margin: 8px 0; color: #1f2937; }
              .cta-section { text-align: center; margin: 40px 0; padding: 30px; background-color: #fafafa; border-radius: 12px; }
              .button { display: inline-block; background-color: #6366f1; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 8px; }
              .support { margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb; text-align: center; }
              .support p { color: #6b7280; font-size: 14px; margin: 8px 0; }
              .support a { color: #6366f1; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Email Verified Successfully!</h1>
              </div>
              
              <div class="content">
                <div class="success-icon">
                  <div>
                    <span>✅</span>
                  </div>
                </div>
                
                <h2>Great news, ${userName}!</h2>
                <p>Your email address has been successfully verified. You're now one step closer to accessing our exclusive business marketplace.</p>
                
                <div class="timeline">
                  <h3>⏰ What happens next?</h3>
                  <p><strong>Admin Review:</strong> Our team typically reviews and approves new accounts within 24 hours during business days.</p>
                  <p><strong>Approval Notification:</strong> You'll receive an email confirmation once your account is approved.</p>
                  <p><strong>Full Access:</strong> After approval, you'll have complete access to browse thousands of business listings.</p>
                </div>
                
                <div class="steps">
                  <h3 style="margin-bottom: 24px; color: #1f2937;">Your Registration Progress</h3>
                  
                  <div class="step completed">
                    <div class="step-number">✓</div>
                    <div class="step-content">
                      <h3>Account Created</h3>
                      <p>Your account has been successfully created with all your information.</p>
                    </div>
                  </div>
                  
                  <div class="step completed">
                    <div class="step-number">✓</div>
                    <div class="step-content">
                      <h3>Email Verified</h3>
                      <p>You've successfully confirmed your email address.</p>
                    </div>
                  </div>
                  
                  <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                      <h3>Admin Approval</h3>
                      <p>Our team will review and approve your account (typically within 24 hours).</p>
                    </div>
                  </div>
                  
                  <div class="step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                      <h3>Start Browsing</h3>
                      <p>Access thousands of business listings and connect with sellers.</p>
                    </div>
                  </div>
                </div>
                
                <div class="cta-section">
                  <h3>While You Wait...</h3>
                  <p>Feel free to log in to your account and complete your profile. You can also bookmark our marketplace for quick access once approved.</p>
                  <a href="https://marketplace.sourcecodeals.com/login" class="button">Log In to Your Account</a>
                </div>
                
                <div class="support">
                  <p><strong>Questions?</strong> Our support team is here to help.</p>
                  <p>Email us at <a href="mailto:adam.haile@sourcecodeals.com">adam.haile@sourcecodeals.com</a></p>
                  <p>Visit our marketplace: <a href="https://marketplace.sourcecodeals.com">marketplace.sourcecodeals.com</a></p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Email Verified Successfully!

Great news, ${userName}!

Your email address has been successfully verified. You're now one step closer to accessing our exclusive business marketplace.

What happens next?
- Admin Review: Our team typically reviews and approves new accounts within 24 hours during business days.
- Approval Notification: You'll receive an email confirmation once your account is approved.
- Full Access: After approval, you'll have complete access to browse thousands of business listings.

Your Registration Progress:
✅ Account Created - Your account has been successfully created with all your information.
✅ Email Verified - You've successfully confirmed your email address.
⏳ Admin Approval - Our team will review and approve your account (typically within 24 hours).
⏳ Start Browsing - Access thousands of business listings and connect with sellers.

While You Wait...
Feel free to log in to your account and complete your profile. You can also bookmark our marketplace for quick access once approved.

Log in: https://marketplace.sourcecodeals.com/login

Questions? Our support team is here to help.
Email: adam.haile@sourcecodeals.com
Website: https://marketplace.sourcecodeals.com

Best regards,
The SourceCodeALS Team
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-verification-success-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);