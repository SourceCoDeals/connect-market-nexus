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

    // Default signature if not provided
    const defaultSignature = `
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="color: #374151; font-size: 14px; line-height: 1.5;">
          <div style="font-weight: 600; margin-bottom: 4px;">Best regards,</div>
          <div style="margin-bottom: 8px;">${senderInfo.name}</div>
          <div style="font-size: 12px; color: #6b7280;">
            SourceCo - Connecting businesses, creating opportunities
          </div>
        </div>
      </div>
    `;

    const signatureHtml = customSignatureHtml || defaultSignature;

    // Construct HTML email content
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <h1 style="color: white; font-size: 28px; font-weight: 700; margin: 0; text-align: center;">
            Welcome to SourceCo
          </h1>
          <p style="color: #e0e7ff; font-size: 16px; margin: 12px 0 0 0; text-align: center;">
            Your account has been approved
          </p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="white-space: pre-wrap; color: #374151; font-size: 16px; line-height: 1.6;">
${message}
          </div>
          
          ${signatureHtml}
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
          <p>This email was sent regarding your SourceCo marketplace account.</p>
        </div>
      </div>
    `;

    // Send email using Brevo
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
        htmlContent: htmlContent,
        textContent: `${message}\n\n---\n${senderInfo.name}\nSourceCo Team`
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