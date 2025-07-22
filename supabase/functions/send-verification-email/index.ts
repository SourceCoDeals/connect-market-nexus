
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationEmailRequest {
  email: string;
  token: string;
  redirectTo?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('📧 Send verification email function called');
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('📧 Request body:', requestBody);
    
    const payload: VerificationEmailRequest = JSON.parse(requestBody);
    const { email, token, redirectTo } = payload;

    console.log('📨 Processing verification email:', { email, redirectTo });

    // Use the correct domain and proper verification URL structure
    const verificationUrl = `https://market.sourcecodeals.com/verify-email-handler?token=${token}&type=signup`;

    const subject = "Please verify your email address - SourceCo Marketplace";
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Welcome to SourceCo Marketplace</h1>
          <p style="margin: 15px 0 0 0; opacity: 0.9; font-size: 16px;">Please verify your email to complete your registration</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">Hi there,</p>
          
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
            Thank you for joining SourceCo Marketplace! To access our curated business acquisition platform, please verify your email address by clicking the button below.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); 
                      color: white; 
                      padding: 16px 32px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: 600;
                      font-size: 16px;
                      display: inline-block;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              ✅ Verify Email Address
            </a>
          </div>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>Direct Link:</strong> If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="margin: 5px 0 0 0; word-break: break-all; font-size: 14px;">
            <a href="${verificationUrl}" style="color: #059669;">${verificationUrl}</a>
          </p>
        </div>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            This verification link will expire in 24 hours. If you didn't sign up for SourceCo Marketplace, please ignore this email.
          </p>
          
          <p style="margin: 0;">
            <strong>Questions?</strong> Contact us at <a href="mailto:support@sourcecodeals.com" style="color: #059669;">support@sourcecodeals.com</a>
          </p>
        </div>
      </div>
    `;

    console.log('📤 Sending verification email via Brevo...');
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': Deno.env.get('BREVO_API_KEY') || '',
      },
      body: JSON.stringify({
        sender: {
          name: "SourceCo Marketplace",
          email: "noreply@sourcecodeals.com"
        },
        to: [{
          email: email,
          name: email
        }],
        subject: subject,
        htmlContent: htmlContent,
        replyTo: {
          email: "support@sourcecodeals.com",
          name: "SourceCo Support"
        }
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("❌ Brevo API error:", errorData);
      throw new Error(`Brevo API error: ${errorData.message || 'Unknown error'}`);
    }

    const responseData = await emailResponse.json();
    console.log("✅ Verification email sent successfully:", responseData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification email sent successfully',
        messageId: responseData.messageId,
        emailProvider: 'brevo'
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-verification-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred',
        details: error.stack
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
