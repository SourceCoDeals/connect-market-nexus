
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetEmailRequest {
  email: string;
  resetToken: string;
  resetUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, resetToken, resetUrl }: PasswordResetEmailRequest = await req.json();

    console.log(`Sending password reset email to: ${email}`);

    // Try Resend first (if available)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "no-reply@yourdomain.com",
            to: [email],
            subject: "Reset Your Password",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Reset Your Password</h2>
                <p>You requested a password reset for your account.</p>
                <p>Click the button below to reset your password:</p>
                <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
                  Reset Password
                </a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link: ${resetUrl}</p>
              </div>
            `,
          }),
        });

        if (resendResponse.ok) {
          console.log("Password reset email sent successfully via Resend");
          return new Response(
            JSON.stringify({ success: true, provider: "resend" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        } else {
          console.error("Resend failed:", await resendResponse.text());
        }
      } catch (error) {
        console.error("Resend error:", error);
      }
    }

    // Fallback to Brevo if Resend fails
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey) {
      try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              name: "Your App",
              email: "no-reply@yourdomain.com"
            },
            to: [{ email, name: "" }],
            subject: "Reset Your Password",
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Reset Your Password</h2>
                <p>You requested a password reset for your account.</p>
                <p>Click the button below to reset your password:</p>
                <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
                  Reset Password
                </a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link: ${resetUrl}</p>
              </div>
            `,
          }),
        });

        if (brevoResponse.ok) {
          console.log("Password reset email sent successfully via Brevo");
          return new Response(
            JSON.stringify({ success: true, provider: "brevo" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        } else {
          console.error("Brevo failed:", await brevoResponse.text());
        }
      } catch (error) {
        console.error("Brevo error:", error);
      }
    }

    // If both email services fail, log the error but don't expose it to prevent information leakage
    console.error("All email services failed for password reset");
    
    return new Response(
      JSON.stringify({ 
        error: "Email service temporarily unavailable. Please try again later." 
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset-email function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
