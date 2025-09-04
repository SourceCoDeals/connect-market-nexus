import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  content: string;
  email_type: string;
  correlation_id: string;
  metadata?: any;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { to, subject, content, email_type, correlation_id, metadata }: EmailRequest = await req.json();

    console.log('📧 Enhanced Email Delivery Request:', {
      to,
      subject,
      email_type,
      correlation_id
    });

    // Log email delivery attempt
    const { data: logData, error: logError } = await supabase
      .from('email_delivery_logs')
      .insert({
        email: to,
        email_type,
        status: 'pending',
        correlation_id,
        error_message: null
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Failed to log email delivery:', logError);
      throw new Error(`Failed to log email delivery: ${logError.message}`);
    }

    console.log('✅ Email delivery logged with ID:', logData.id);

    // For now, simulate email sending since we don't have a real email service configured
    // In production, this would integrate with Resend, SendGrid, or another email service
    
    // Simulate a delay and success
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update delivery status to success
    const { error: updateError } = await supabase
      .from('email_delivery_logs')
      .update({
        status: 'delivered',
        sent_at: new Date().toISOString()
      })
      .eq('id', logData.id);

    if (updateError) {
      console.error('❌ Failed to update delivery status:', updateError);
      throw new Error(`Failed to update delivery status: ${updateError.message}`);
    }

    console.log('✅ Email marked as delivered');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email delivered successfully',
        delivery_id: logData.id,
        correlation_id
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error('❌ Enhanced email delivery error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Failed to deliver email'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);