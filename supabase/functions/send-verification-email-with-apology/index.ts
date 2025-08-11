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
  console.log("=== EDGE FUNCTION START ===");
  console.log("Request method:", req.method);
  console.log("Request URL:", req.url);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== MAIN HANDLER START ===");
    console.log("Verification email with apology request received");
    
    console.log("=== PARSING REQUEST BODY ===");
    const requestBody = await req.json();
    console.log("Request body parsed successfully:", JSON.stringify(requestBody));

    const { email, firstName, lastName }: VerificationEmailRequest = requestBody;
    console.log("Extracted email:", email);
    console.log("Extracted firstName:", firstName);
    console.log("Extracted lastName:", lastName);

    if (!email) {
      console.error("❌ Email validation failed - no email provided");
      throw new Error("Email is required");
    }

    console.log("=== CHECKING ENVIRONMENT VARIABLES ===");
    // Check if BREVO_API_KEY is available
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    console.log("BREVO_API_KEY exists:", !!brevoApiKey);
    console.log("BREVO_API_KEY length:", brevoApiKey?.length || 0);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log("SUPABASE_URL exists:", !!supabaseUrl);
    console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!supabaseServiceKey);
    
    if (!brevoApiKey) {
      console.error("❌ BREVO_API_KEY not found in environment");
      throw new Error("BREVO_API_KEY not configured");
    }

    console.log("=== GENERATING VERIFICATION LINK ===");
    console.log(`Attempting to generate verification link for: ${email}`);

    // Generate email verification link via Supabase Auth
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: 'https://marketplace.sourcecodeals.com/'
      }
    });

    console.log("Link generation result - error:", linkError);
    console.log("Link generation result - data:", linkData ? "exists" : "null");

    if (linkError || !linkData.properties?.action_link) {
      console.error('❌ Failed to generate verification link:', linkError);
      console.error('Link data received:', JSON.stringify(linkData));
      throw new Error('Failed to generate verification link');
    }

    const verificationLink = linkData.properties.action_link;
    console.log("✅ Verification link generated successfully");
    console.log("Verification link:", verificationLink);

    const userName = firstName && lastName ? `${firstName} ${lastName}` : firstName || 'there';
    console.log("User name for email:", userName);

    console.log("=== SENDING EMAIL VIA BREVO ===");
    console.log("Preparing to send email to:", email);
    
    const emailPayload = {
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

Once you verify your email, we'll review and approve your account. You'll receive a confirmation email once your account is approved and you can then access all business listings.

Login after approval: https://marketplace.sourcecodeals.com/login

Questions? Email us at support@sourcecodeals.com

Thank you for your patience.

Adam Haile
SourceCo
adam.haile@sourcecodeals.com`
    };
    
    console.log("Email payload prepared, sending to Brevo...");

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify(emailPayload)
    });

    console.log("Brevo API request sent, checking response...");
    console.log("Email response status:", emailResponse.status);
    console.log("Email response headers:", Object.fromEntries(emailResponse.headers.entries()));

    if (!emailResponse.ok) {
      console.error("❌ Brevo API returned error status:", emailResponse.status);
      const errorData = await emailResponse.json();
      console.error("❌ Brevo API error details:", JSON.stringify(errorData));
      throw new Error(`Brevo API error: ${errorData.message || 'Unknown error'}`);
    }

    console.log("✅ Brevo API responded successfully");
    const responseData = await emailResponse.json();
    console.log("✅ Apology verification email sent successfully:", JSON.stringify(responseData));

    const successResponse = { 
      success: true, 
      messageId: responseData.messageId,
      emailProvider: 'brevo'
    };
    
    console.log("=== RETURNING SUCCESS RESPONSE ===");
    console.log("Success response:", JSON.stringify(successResponse));

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("=== ERROR CAUGHT IN HANDLER ===");
    console.error("Error type:", typeof error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Full error object:", JSON.stringify(error));
    
    const errorResponse = { 
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    };
    
    console.log("=== RETURNING ERROR RESPONSE ===");
    console.log("Error response:", JSON.stringify(errorResponse));
    
    return new Response(
      JSON.stringify(errorResponse),
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