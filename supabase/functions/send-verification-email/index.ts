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

    const verificationUrl = `${redirectTo || Deno.env.get('SUPABASE_URL')}/verify-email-handler?token=${token}&type=signup`;

    const subject = "Please verify your email address";
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Verify Your Email 📧</h1>
        
        <p>Hello,</p>
        
        <p>Thank you for signing up! Please click the link below to verify your email address and complete your registration.</p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; text-align: center;">
            <a href="${verificationUrl}" 
               style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:
          <br>
          <a href="${verificationUrl}" style="color: #059669; word-break: break-all;">${verificationUrl}</a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          This link will expire in 24 hours. If you didn't sign up for an account, please ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          This email was sent to ${email}. If you didn't expect this email, please contact support.
        </p>
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
          name: "Connect Market Nexus",
          email: "noreply@connect-market-nexus.com"
        },
        to: [{
          email: email,
          name: email
        }],
        subject: subject,
        htmlContent: htmlContent
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