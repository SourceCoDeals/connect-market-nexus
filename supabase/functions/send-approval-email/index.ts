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

    // Construct SourceCo-branded HTML email content
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <!-- Header with SourceCo Branding -->
        <div style="background: linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%); padding: 40px; border-radius: 16px; margin-bottom: 30px; text-align: center; box-shadow: 0 8px 32px rgba(184, 134, 11, 0.3);">
          <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <div style="color: white; font-size: 36px; font-weight: 900;">S</div>
          </div>
          <h1 style="color: white; font-size: 32px; font-weight: 800; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            Welcome to SourceCo
          </h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 18px; margin: 12px 0 0 0; font-weight: 500;">
            Your account has been approved
          </p>
        </div>
        
        <!-- Main Content -->
        <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          <!-- Success Badge -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
              ✓ Account Approved
            </div>
          </div>
          
          <!-- Message Content -->
          <div style="white-space: pre-wrap; color: #374151; font-size: 16px; line-height: 1.7; margin-bottom: 30px;">
${message}
          </div>
          
          <!-- Call to Action -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://marketplace.sourcecodeals.com/marketplace" style="display: inline-block; background: linear-gradient(135deg, #b8860b 0%, #daa520 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 6px 20px rgba(184, 134, 11, 0.4); transition: transform 0.2s;">
              Explore Marketplace →
            </a>
          </div>
          
          ${signatureHtml}
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; color: #64748b; font-size: 14px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} SourceCo. Premium Business Marketplace.</p>
          <p style="margin: 8px 0 0 0;">This email was sent regarding your SourceCo marketplace account.</p>
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