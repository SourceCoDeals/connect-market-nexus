import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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

    console.log(`Sending verification email with link to: ${email}`);

    // Generate email verification link via Supabase Auth
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: 'https://marketplace.sourcecodeals.com/'
      }
    });

    if (linkError || !linkData.properties?.action_link) {
      console.error('Failed to generate verification link:', linkError);
      throw new Error('Failed to generate verification link');
    }

    const verificationLink = linkData.properties.action_link;

    const userName = firstName && lastName ? `${firstName} ${lastName}` : firstName || 'there';

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': Deno.env.get('BREVO_API_KEY') || '',
      },
      body: JSON.stringify({
        sender: {
          name: "Adam Haile - SourceCo",
          email: "adam.haile@sourcecodeals.com"
        },
        to: [{
          email: email,
          name: userName
        }],
        subject: "Email Verification Required - Quick Approval After Verification",
        replyTo: {
          email: "adam.haile@sourcecodeals.com",
          name: "Adam Haile - SourceCo"
        },
        // CRITICAL: Disable all tracking to prevent link rewriting
        trackClicks: "0",
        trackOpens: "0",
        textContent: `Hi ${userName},

We want to apologize for the delay in your email verification. Due to some technical problems with our email delivery system over the past few days, some verification emails were not delivered as expected.

These technical issues have now been resolved. To complete your registration, please verify your email address by clicking the link below:

${verificationLink}

Once you verify your email, your account will be approved within 5 minutes and you'll have immediate access to our business marketplace.

What happens after verification:
- Your account will be automatically approved within 5 minutes
- You'll receive a confirmation email once approved
- You can then log in and access all business listings

Login after verification: https://marketplace.sourcecodeals.com/login

Questions? Email us at support@sourcecodeals.com

Thank you for your patience.

Adam Haile
SourceCo
adam.haile@sourcecodeals.com`
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("❌ Brevo API error:", errorData);
      throw new Error(`Brevo API error: ${errorData.message || 'Unknown error'}`);
    }

    const responseData = await emailResponse.json();
    console.log("✅ Apology verification email sent successfully:", responseData);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: responseData.messageId,
      emailProvider: 'brevo'
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