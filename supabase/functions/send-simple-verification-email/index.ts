import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

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
  const corsHeaders = getCorsHeaders(req);

  console.log("=== SIMPLE VERIFICATION EMAIL FUNCTION START ===");
  
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return corsPreflightResponse(req);
  }

  try {
    console.log("=== PARSING REQUEST ===");
    const { email, firstName = '', lastName = '' }: EmailRequest = await req.json();
    
    console.log(`Processing email for: ${email}`);
    console.log(`Name: ${firstName} ${lastName}`);

    console.log("=== GENERATING RECOVERY LINK ===");
    // Use recovery type - works for all users and provides same verification flow
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
        name: "Adam Haile",
        email: "adam.haile@sourcecodeals.com"
      },
      to: [{
        email: email,
        name: displayName
      }],
      subject: "Email Verification - Technical Issue Resolved",
      textContent: `Hi ${displayName},

We want to apologize for the delay in your email verification. Due to some technical problems with our email delivery system over the past few days, some verification emails were not delivered as expected.

These technical issues have now been resolved, and we're personally ensuring that all affected users receive their verification emails.

Please verify your email address via the link below:

What happens next:
- Our team will pre-approved your account and you'll get access within 30 minutes of verifying your email address
- You'll receive an email confirmation once your access is granted
- After approval, you'll have complete access to browse off-market listings

Please verify your email below:
${verificationLink}

Questions? Reply back to this email.

Thank you for your patience.

Adam Haile
SourceCo
adam.haile@sourcecodeals.com`
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