import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailData {
  to: string;
  subject: string;
  content: string;
  feedbackId: string;
  templateId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, content, feedbackId, templateId }: EmailData = await req.json();

    // Log the email attempt
    const correlationId = crypto.randomUUID();
    
    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "Feedback System <feedback@connect-market-nexus.lovable.app>",
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Feedback Response</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            ${content.replace(/\n/g, '<br>')}
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              This is a response to your feedback. Please do not reply to this email.
            </p>
          </div>
        </div>
      `,
    });

    // Log email delivery status
    await supabase.from('email_delivery_logs').insert({
      email: to,
      email_type: 'feedback_response',
      status: emailResponse.error ? 'failed' : 'sent',
      correlation_id: correlationId,
      error_message: emailResponse.error?.message || null,
      sent_at: emailResponse.error ? null : new Date().toISOString()
    });

    // Update feedback message with delivery status
    if (!emailResponse.error && feedbackId) {
      await supabase
        .from('feedback_messages')
        .update({ 
          status: 'responded',
          updated_at: new Date().toISOString()
        })
        .eq('id', feedbackId);
    }

    if (emailResponse.error) {
      console.error("Email sending failed:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: emailResponse.error.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        correlationId
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
    console.error("Error in send-feedback-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);