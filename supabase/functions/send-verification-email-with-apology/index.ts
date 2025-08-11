import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationEmailRequest {
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
    console.log("Verification email with apology request received");
    
    const requestBody = await req.json();
    console.log("Request body:", JSON.stringify(requestBody));

    const { email, firstName, lastName }: VerificationEmailRequest = requestBody;

    if (!email) {
      throw new Error("Email is required");
    }

    console.log(`Sending verification email with apology to: ${email}`);

    const userName = firstName && lastName ? `${firstName} ${lastName}` : firstName || 'there';

    const emailResponse = await resend.emails.send({
      from: "SourceCodeALS <noreply@sourcecodeals.com>",
      to: [email],
      subject: "🙏 Apologies + Email Verification - SourceCo Marketplace",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification - We Apologize for the Delay</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
              .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 40px 30px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
              .apology-section { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 30px; }
              .apology-section h2 { color: #dc2626; margin: 0 0 12px 0; font-size: 20px; }
              .content { padding: 40px 30px; }
              .success-icon { text-align: center; margin-bottom: 30px; }
              .success-icon div { width: 80px; height: 80px; border-radius: 50%; background-color: #10b981; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
              .success-icon span { font-size: 36px; color: white; }
              h3 { color: #1f2937; margin-bottom: 16px; font-size: 24px; font-weight: 600; }
              .steps { background-color: #f3f4f6; border-radius: 12px; padding: 30px; margin: 30px 0; }
              .step { display: flex; align-items: flex-start; margin-bottom: 20px; }
              .step:last-child { margin-bottom: 0; }
              .step-number { background-color: #6366f1; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 16px; flex-shrink: 0; font-size: 14px; }
              .step-content h4 { margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600; }
              .step-content p { margin: 0; color: #6b7280; font-size: 14px; }
              .completed { opacity: 0.7; }
              .completed .step-number { background-color: #10b981; }
              .timeline { margin: 30px 0; padding: 20px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6; }
              .timeline h4 { margin: 0 0 12px 0; color: #1e40af; font-size: 18px; }
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
                <h1>🙏 We Apologize for the Delay</h1>
              </div>
              
              <div class="apology-section">
                <h2>Our Sincere Apologies</h2>
                <p>Dear ${userName},</p>
                <p>We want to sincerely apologize for the delay in your email verification. Due to a temporary issue with our email service credits over the past few days, some verification emails were not delivered as expected.</p>
                <p><strong>This issue has now been resolved</strong>, and we're personally ensuring that all affected users receive their verification emails.</p>
              </div>
              
              <div class="content">
                <div class="success-icon">
                  <div>
                    <span>✅</span>
                  </div>
                </div>
                
                <h3>Your Email Has Been Verified!</h3>
                <p>Good news! We've automatically verified your email address as part of resolving this issue. You're now ready to proceed with the final steps to access our exclusive business marketplace.</p>
                
                <div class="timeline">
                  <h4>⏰ What happens next?</h4>
                  <p><strong>Admin Review:</strong> Our team will review and approve your account within 24 hours during business days.</p>
                  <p><strong>Approval Notification:</strong> You'll receive an email confirmation once your account is approved.</p>
                  <p><strong>Full Access:</strong> After approval, you'll have complete access to browse thousands of business listings.</p>
                </div>
                
                <div class="steps">
                  <h4 style="margin-bottom: 24px; color: #1f2937;">Your Registration Progress</h4>
                  
                  <div class="step completed">
                    <div class="step-number">✓</div>
                    <div class="step-content">
                      <h4>Account Created</h4>
                      <p>Your account has been successfully created with all your information.</p>
                    </div>
                  </div>
                  
                  <div class="step completed">
                    <div class="step-number">✓</div>
                    <div class="step-content">
                      <h4>Email Verified</h4>
                      <p>Your email address has been verified (resolved during our service restoration).</p>
                    </div>
                  </div>
                  
                  <div class="step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                      <h4>Admin Approval</h4>
                      <p>Our team will review and approve your account (typically within 24 hours).</p>
                    </div>
                  </div>
                  
                  <div class="step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                      <h4>Start Browsing</h4>
                      <p>Access thousands of business listings and connect with sellers.</p>
                    </div>
                  </div>
                </div>
                
                <div class="cta-section">
                  <h4>Ready to Get Started</h4>
                  <p>You can now log in to your account and complete your profile while waiting for approval. Thank you for your patience during this technical difficulty.</p>
                  <a href="https://marketplace.sourcecodeals.com/login" class="button">Log In to Your Account</a>
                </div>
                
                <div class="support">
                  <p><strong>Questions or Concerns?</strong> We're here to help and make this right.</p>
                  <p>Email us at <a href="mailto:support@sourcecodeals.com">support@sourcecodeals.com</a></p>
                  <p>Visit our marketplace: <a href="https://marketplace.sourcecodeals.com">marketplace.sourcecodeals.com</a></p>
                  <br>
                  <p style="font-style: italic;">Again, we sincerely apologize for any inconvenience this delay may have caused. We appreciate your understanding and patience.</p>
                  <p><strong>- The SourceCodeALS Team</strong></p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
🙏 We Apologize for the Delay

Dear ${userName},

Our Sincere Apologies:
We want to sincerely apologize for the delay in your email verification. Due to a temporary issue with our email service credits over the past few days, some verification emails were not delivered as expected.

This issue has now been resolved, and we're personally ensuring that all affected users receive their verification emails.

Your Email Has Been Verified!
Good news! We've automatically verified your email address as part of resolving this issue. You're now ready to proceed with the final steps to access our exclusive business marketplace.

What happens next?
- Admin Review: Our team will review and approve your account within 24 hours during business days.
- Approval Notification: You'll receive an email confirmation once your account is approved.
- Full Access: After approval, you'll have complete access to browse thousands of business listings.

Your Registration Progress:
✅ Account Created - Your account has been successfully created with all your information.
✅ Email Verified - Your email address has been verified (resolved during our service restoration).
⏳ Admin Approval - Our team will review and approve your account (typically within 24 hours).
⏳ Start Browsing - Access thousands of business listings and connect with sellers.

Ready to Get Started:
You can now log in to your account and complete your profile while waiting for approval. Thank you for your patience during this technical difficulty.

Log in: https://marketplace.sourcecodeals.com/login

Questions or Concerns? We're here to help and make this right.
Email: support@sourcecodeals.com
Website: https://marketplace.sourcecodeals.com

Again, we sincerely apologize for any inconvenience this delay may have caused. We appreciate your understanding and patience.

- The SourceCodeALS Team
      `,
    });

    console.log("Apology verification email sent successfully:", emailResponse);

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
    console.error("Error in send-verification-email-with-apology function:", error);
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