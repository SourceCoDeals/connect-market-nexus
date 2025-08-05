import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { getAdminProfile } from "../_shared/admin-profiles.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendNDAEmailRequest {
  userId: string;
  userEmail: string;
  customSubject?: string;
  customMessage?: string;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  listingTitle?: string;
  customSignatureText?: string;
  useTemplate?: boolean;
  attachments?: Array<{
    name: string;
    content: string; // base64 encoded content
    contentType?: string;
  }>;
}

// Admin profiles mapping for signature data
const ADMIN_PROFILES: Record<string, any> = {
  'bill.martin@sourcecodeals.com': {
    email: 'bill.martin@sourcecodeals.com',
    name: 'Bill Martin',
    title: 'Principal & SVP - Growth',
    phone: '(614) 832-6099',
    calendlyUrl: 'https://calendly.com/bill-martin-sourceco/30min'
  },
  'adam.haile@sourcecodeals.com': {
    email: 'adam.haile@sourcecodeals.com',
    name: 'Adam Haile',
    title: 'Founder & CEO',
    phone: '(614) 555-0100',
    calendlyUrl: 'https://calendly.com/adam-haile-sourceco/30min'
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      console.error('❌ BREVO_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('✅ Brevo API key found, proceeding with email setup');

    const {
      userId,
      userEmail,
      customSubject,
      customMessage,
      adminId,
      adminEmail: providedAdminEmail,
      adminName: providedAdminName,
      listingTitle,
      customSignatureText,
      useTemplate = true,
      attachments = []
    }: SendNDAEmailRequest = await req.json();

    const subject = listingTitle 
      ? `NDA Required - ${listingTitle} | SourceCo`
      : customSubject || "Non-Disclosure Agreement | SourceCo";
    
    console.log('📧 Starting NDA email process', {
      userEmail,
      userId,
      subject,
      adminEmail: providedAdminEmail,
      adminName: providedAdminName,
      listingTitle,
      attachmentCount: attachments.length,
      hasCustomMessage: !!customMessage
    });

    // Validate required parameters
    if (!userId || !userEmail) {
      throw new Error("Missing required parameters: userId and userEmail are required");
    }

    if (!providedAdminEmail || !providedAdminName) {
      throw new Error("Admin information is required: adminEmail and adminName must be provided");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get default NDA document if no attachments provided
    let finalAttachments = [...attachments];
    
    if (finalAttachments.length === 0) {
      console.log('📎 No attachments provided, fetching default NDA document...');
      
      try {
        const defaultFileName = 'SourceCo Form Bilateral NDA_2025.docx';
        console.log('📎 Trying to fetch default NDA:', defaultFileName);
        
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('nda-documents')
          .download(defaultFileName);

        if (!downloadError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          finalAttachments.push({
            name: defaultFileName,
            content: base64Content,
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
          
          console.log('✅ Default NDA document loaded successfully:', defaultFileName);
        } else {
          console.log('⚠️ Could not fetch default NDA document');
        }
      } catch (error) {
        console.error('❌ Error fetching default NDA document:', error);
      }
    }

    // Determine sender information with admin profile lookup
    let senderEmail = providedAdminEmail;
    let senderName = providedAdminName;
    let adminTitle = '';
    let adminPhone = '';
    let adminCalendly = '';

    // Get admin profile data if available
    const adminProfile = ADMIN_PROFILES[providedAdminEmail] || getAdminProfile(providedAdminEmail);
    if (adminProfile) {
      adminTitle = adminProfile.title || '';
      adminPhone = adminProfile.phone || '';
      adminCalendly = adminProfile.calendlyUrl || '';
    }

    console.log('📧 Using sender:', `${senderName} <${senderEmail}>`);

    // Try to get custom admin signature from database (like fee agreement function)
    let customSignature = null;
    console.log('🔍 Looking for custom signature for adminId:', adminId);
    
    if (adminId) {
      try {
        const { data: signatureData } = await supabaseAdmin
          .from('admin_signature_preferences')
          .select('signature_html, signature_text, phone_number, calendly_url')
          .eq('admin_id', adminId)
          .single();
        
        if (signatureData) {
          customSignature = signatureData;
          console.log('✅ Found custom signature for admin:', adminId);
          console.log('📝 Signature data:', { 
            hasHtml: !!signatureData.signature_html, 
            hasText: !!signatureData.signature_text 
          });
        } else {
          console.log('❌ No signature data returned from database');
        }
      } catch (error) {
        console.log('⚠️ Error fetching custom signature:', error);
      }
    } else {
      console.log('⚠️ No adminId provided for signature lookup');
    }

    console.log('📧 Using text-only signature without logo for immediate delivery');
    
    // Create premium signature (same logic as fee agreement)
    let adminSignature;
    
    if (customSignature && customSignature.signature_html) {
      // Use custom signature completely as-is without any modifications
      adminSignature = customSignature.signature_html;
      console.log('✅ Using custom admin signature as-is');
    } else {
      // Only use fallback logic when NO custom signature exists
      const finalPhone = customSignature?.phone_number || adminPhone || '(614) 555-0000';
      const finalCalendly = customSignature?.calendly_url || adminCalendly || 'https://calendly.com/sourceco-admin/30min';
      
      adminSignature = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">
          <p style="margin: 0;">
            <strong>${senderName}</strong><br>
            ${adminTitle}<br>
            <a href="mailto:${senderEmail}" style="color: #0066cc; text-decoration: none;">${senderEmail}</a><br>
            <a href="tel:${finalPhone.replace(/[^\d]/g, '')}" style="color: #0066cc; text-decoration: none;">${finalPhone}</a><br>
            <a href="${finalCalendly}" style="color: #0066cc; text-decoration: none;">Click here to schedule a call with me</a>
          </p>
        </div>`;
      console.log('✅ Using standard format signature template');
    }

    // Simple text content - use custom signature text if provided, otherwise strip HTML
    let signatureText;
    if (customSignatureText) {
      signatureText = customSignatureText;
    } else if (customSignature?.signature_text) {
      signatureText = customSignature.signature_text;
    } else {
      // Convert HTML signature to text with proper line breaks
      signatureText = adminSignature
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
    }

    // Build email content
    const emailMessage = customMessage || `Dear valued client,

Please find the attached Non-Disclosure Agreement for your review and signature. This agreement is required to access confidential deal information.

Once signed, please return the executed document so we can proceed with sharing the relevant materials.

Thank you for your understanding and cooperation.`;

    const textContent = `${emailMessage}

${signatureText}`;

    const htmlContent = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
${emailMessage.replace(/\n/g, '<br>')}
<br><br>
${adminSignature}
</div>`;

    // Process attachments safely
    console.log('📎 Starting attachment processing for', finalAttachments.length, 'attachment(s)');
    
    const processedAttachments = [];

    for (const [index, attachment] of finalAttachments.entries()) {
      console.log(`📎 Processing attachment ${index + 1}/${finalAttachments.length}: ${attachment.name}`);
      
      try {
        if (!attachment.content) {
          console.error(`❌ Attachment ${attachment.name} has no content`);
          continue;
        }
        
        const cleanBase64 = attachment.content.replace(/^data:[^;]+;base64,/, '');
        console.log(`📎 Original content length for ${attachment.name}: ${cleanBase64.length} chars`);
        
        const decodedBytes = atob(cleanBase64);
        console.log(`✅ Successfully decoded base64 for ${attachment.name}: ${cleanBase64.length} chars → ${decodedBytes.length} bytes`);
        
        processedAttachments.push({
          name: attachment.name,
          content: cleanBase64,
          ...(attachment.contentType && { contentType: attachment.contentType })
        });
        
        console.log(`✅ Successfully processed attachment: ${attachment.name} (${decodedBytes.length} bytes)`);
      } catch (error) {
        console.error(`❌ Error processing attachment ${attachment.name}:`, error);
      }
    }

    console.log('📎 Successfully added', processedAttachments.length, 'attachment(s) to Brevo payload');

    // Determine the sender email - use current admin info (same logic as fee agreement)
    let finalSenderEmail = senderEmail;
    let finalSenderName = senderName;
    
    // Only use noreply if admin email is not from our domain
    if (!senderEmail.includes("@sourcecodeals.com")) {
      finalSenderEmail = "noreply@sourcecodeals.com";
      finalSenderName = `${senderName} - SourceCo`;
    }

    // Send email via Brevo
    console.log('📬 Sending NDA email via Brevo...', {
      to: userEmail,
      from: { name: finalSenderName, email: finalSenderEmail },
      replyTo: { email: senderEmail, name: senderName },
      subject: subject,
      attachmentCount: processedAttachments.length,
      payloadSize: JSON.stringify(processedAttachments).length
    });

    const brevoPayload = {
      to: [{ email: userEmail }],
      sender: { name: finalSenderName, email: finalSenderEmail },
      replyTo: { email: senderEmail, name: senderName },
      subject: subject,
      textContent: textContent,
      htmlContent: htmlContent,
      attachment: processedAttachments
    };

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify(brevoPayload),
    });

    console.log('📡 Brevo API response status:', brevoResponse.status);

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error('❌ Brevo API error:', errorText);
      throw new Error(`Failed to send email: ${brevoResponse.status} ${errorText}`);
    }

    const brevoResult = await brevoResponse.json();
    console.log('✅ NDA email sent successfully via Brevo:', brevoResult);

    // Now log to database after successful email send
    console.log('📝 Logging NDA email to database...');
    try {
      // Update profile status
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          nda_email_sent: true,
          nda_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        console.error('⚠️ Profile update failed but email was sent:', profileError);
      }

      // Log the email action
      const { error: logError } = await supabaseAdmin
        .from('nda_logs')
        .insert({
          user_id: userId,
          admin_id: adminId,
          action_type: 'sent',
          email_sent_to: userEmail,
          admin_email: adminEmail,
          admin_name: adminName,
          notes: `NDA email sent via admin interface${listingTitle ? ` for listing: ${listingTitle}` : ''}`,
          metadata: { email_sent: true, sent_at: new Date().toISOString() }
        });

      if (logError) {
        console.error('⚠️ Log insert failed but email was sent:', logError);
      } else {
        console.log('✅ Database logging successful');
      }
    } catch (dbError: any) {
      console.error('⚠️ Database logging failed but email was sent:', dbError);
      // Don't throw error since email was successfully sent
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: brevoResult.messageId,
        message: 'NDA email sent successfully'
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('❌ Error in send-nda-email function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to send NDA email'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);