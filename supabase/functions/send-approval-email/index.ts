import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendApprovalEmailRequest {
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  customSignatureHtml?: string;
  customSignatureText?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const requestData: SendApprovalEmailRequest = await req.json();
    const { 
      userId, 
      userEmail, 
      subject, 
      message,
      adminId,
      adminEmail,
      adminName,
      customSignatureHtml,
      customSignatureText
    } = requestData;

    console.log('Sending approval email to:', userEmail);

    // Get admin profile for signature
    let senderInfo = {
      email: adminEmail || 'admin@sourceco.com',
      name: adminName || 'SourceCo Admin'
    };

    // If admin ID provided, try to get enhanced profile info
    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, company')
        .eq('id', adminId)
        .single();

      if (adminProfile) {
        senderInfo = {
          email: adminProfile.email || senderInfo.email,
          name: adminProfile.first_name && adminProfile.last_name 
            ? `${adminProfile.first_name} ${adminProfile.last_name}`
            : senderInfo.name
        };
      }
    }

    // Create simple plain text email with signature
    const textSignature = customSignatureText || `\n\n${senderInfo.name}\nSourceCo`;

    // Send email using Brevo - plain text only
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: senderInfo.name,
          email: senderInfo.email
        },
        to: [{
          email: userEmail,
          name: userEmail.split('@')[0]
        }],
        subject: subject,
        textContent: `${message}${textSignature}`
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Brevo API error:', emailResult);
      throw new Error(`Email API error: ${emailResult.message || 'Unknown error'}`);
    }

    console.log('Approval email sent successfully:', emailResult);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResult.messageId || 'unknown',
      message: 'Approval email sent successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in send-approval-email function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to send approval email',
      details: error.toString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);