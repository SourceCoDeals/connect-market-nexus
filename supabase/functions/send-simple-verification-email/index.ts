import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface EmailRequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== SIMPLE VERIFICATION EMAIL FUNCTION START ===");
  
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== PARSING REQUEST ===");
    const { email, firstName = '', lastName = '' }: EmailRequest = await req.json();
    
    console.log(`Processing email for: ${email}`);
    console.log(`Name: ${firstName} ${lastName}`);

    console.log("=== GENERATING RECOVERY LINK ===");
    // Use recovery type - works for all users regardless of status
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: 'https://marketplace.sourcecodeals.com/'
      }
    });

    if (linkError || !linkData.properties?.action_link) {
      console.error('Failed to generate recovery link:', linkError);
      throw new Error('Failed to generate verification link');
    }

    const verificationLink = linkData.properties.action_link;
    console.log("✅ Recovery link generated successfully");

    console.log("=== SENDING EMAIL VIA BREVO ===");
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is not configured');
    }

    const displayName = firstName && lastName ? `${firstName} ${lastName}` : (firstName || 'Valued User');

    const emailContent = {
      sender: {
        name: "SourceCo Team",
        email: "no-reply@sourcecodeals.com"
      },
      to: [{
        email: email,
        name: displayName
      }],
      subject: "Important: Complete Your SourceCo Account Verification",
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your SourceCo Verification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">SourceCo</h1>
              <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Premium Business Marketplace</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">
                Hello ${displayName},
              </h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We apologize for any technical difficulties you may have experienced with your account verification process. 
                We've resolved the issue and are sending you a new verification link.
              </p>

              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Please click the button below to complete your account verification and gain full access to SourceCo's premium business marketplace:
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); 
                          color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; 
                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);">
                  Complete Verification
                </a>
              </div>

              <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-top: 30px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verificationLink}" style="color: #3b82f6; word-break: break-all;">${verificationLink}</a>
              </p>

              <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px;">
                <p style="color: #64748b; font-size: 14px; margin: 0;">
                  This link will expire in 24 hours for security purposes. If you need assistance, please contact our support team.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                © 2024 SourceCo. All rights reserved.<br>
                Premium Business Acquisition Marketplace
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(emailContent)
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('Brevo API error:', brevoResponse.status, errorText);
      throw new Error(`Email sending failed: ${brevoResponse.status}`);
    }

    const result = await brevoResponse.json();
    console.log("✅ Email sent successfully via Brevo:", result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification email sent successfully',
        messageId: result.messageId 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in simple verification email function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);