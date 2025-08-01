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
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
        <div style="color: #1e293b; font-size: 14px; line-height: 1.6; font-weight: 500;">
          <div style="margin-bottom: 8px;">${senderInfo.name}</div>
          <div style="font-size: 13px; color: #64748b; font-weight: 400; letter-spacing: 0.025em;">
            SourceCo
          </div>
        </div>
      </div>
    `;

    const signatureHtml = customSignatureHtml || defaultSignature;

    // Construct SourceCo-branded HTML email content
    const htmlContent = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 640px; margin: 0 auto; padding: 0; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background: #ffffff; padding: 48px 40px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
          <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #b8860b 0%, #daa520 100%); border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
            <div style="color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">S</div>
          </div>
          <h1 style="color: #0f172a; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: -0.025em;">
            Account Approved
          </h1>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 40px;">
          <!-- Message Content -->
          <div style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 32px; white-space: pre-wrap;">
${message}
          </div>
          
          <!-- Deal Alerts Section -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 32px 0;">
            <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.02em;">
              Never Miss an Opportunity
            </h3>
            <p style="color: #64748b; font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
              Set up personalized deal alerts to receive notifications when new acquisitions match your criteria.
            </p>
            <a href="https://marketplace.sourcecodeals.com/dashboard?tab=deal-alerts" style="display: inline-block; background: #1e293b; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">
              Configure Deal Alerts
            </a>
          </div>
          
          <!-- Call to Action -->
          <div style="text-align: center; margin: 40px 0 32px;">
            <a href="https://marketplace.sourcecodeals.com/marketplace" style="display: inline-block; background: linear-gradient(135deg, #b8860b 0%, #daa520 100%); color: white; padding: 16px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: -0.01em;">
              Access Marketplace
            </a>
          </div>
          
          ${signatureHtml}
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 24px 40px; border-top: 1px solid #f1f5f9; background: #f8fafc;">
          <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 500;">
            © ${new Date().getFullYear()} SourceCo
          </p>
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