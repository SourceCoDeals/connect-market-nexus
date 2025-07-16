
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PasswordResetRequest {
  email: string;
  action: 'request' | 'reset';
  token?: string;
  newPassword?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, action, token, newPassword }: PasswordResetRequest = await req.json();

    if (action === 'request') {
      console.log(`Password reset requested for email: ${email}`);
      
      // Generate reset token using our secure function
      const { data: resetToken, error: tokenError } = await supabase
        .rpc('create_password_reset_token', { user_email: email });

      if (tokenError) {
        console.error('Error creating reset token:', tokenError);
        throw tokenError;
      }

      if (resetToken === 'token_sent') {
        // Don't reveal whether email exists
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'If the email exists, a reset link will be sent.' 
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Send password reset email with retry logic
      let emailSent = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!emailSent && retryCount < maxRetries) {
        try {
          const { error: emailError } = await supabase.functions.invoke(
            'send-password-reset-email',
            {
              body: JSON.stringify({
                email,
                resetToken,
                resetUrl: `${req.headers.get('origin')}/reset-password?token=${resetToken}`
              })
            }
          );

          if (!emailError) {
            emailSent = true;
            console.log(`Password reset email sent successfully to: ${email}`);
          } else {
            retryCount++;
            console.error(`Email send attempt ${retryCount} failed:`, emailError);
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        } catch (error) {
          retryCount++;
          console.error(`Email send attempt ${retryCount} failed:`, error);
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'If the email exists, a reset link will be sent.',
          emailSent 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );

    } else if (action === 'reset') {
      if (!token || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'Token and new password are required' }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      console.log('Validating reset token...');
      
      // Validate token using our secure function
      const { data: userId, error: validateError } = await supabase
        .rpc('validate_reset_token', { token_value: token });

      if (validateError || !userId) {
        console.error('Token validation failed:', validateError);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired reset token' }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Reset the password using Supabase Admin API
      const { error: resetError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (resetError) {
        console.error('Password reset failed:', resetError);
        return new Response(
          JSON.stringify({ error: 'Failed to reset password' }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      console.log(`Password reset successful for user: ${userId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Password reset successfully' 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
