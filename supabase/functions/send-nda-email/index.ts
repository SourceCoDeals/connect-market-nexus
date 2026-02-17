import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { getAdminProfile } from "../_shared/admin-profiles.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendNDAEmailRequest {
  userId?: string;
  userEmail: string;
  firmId?: string;
  sendToAllMembers?: boolean;
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

// Admin profiles mapping - only basic info, no hardcoded contact details
const ADMIN_PROFILES: Record<string, any> = {
  'bill.martin@sourcecodeals.com': {
    email: 'bill.martin@sourcecodeals.com',
    name: 'Bill Martin',
    title: 'Principal & SVP - Growth',
    phone: '',
    calendlyUrl: ''
  },
  'adam.haile@sourcecodeals.com': {
    email: 'adam.haile@sourcecodeals.com',
    name: 'Adam Haile',
    title: 'Founder & CEO',
    phone: '',
    calendlyUrl: ''
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
      firmId,
      sendToAllMembers,
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
      firmId,
      sendToAllMembers,
      subject,
      adminEmail: providedAdminEmail,
      adminName: providedAdminName,
      listingTitle,
      attachmentCount: attachments.length,
      hasCustomMessage: !!customMessage
    });

    if (!providedAdminEmail || !providedAdminName) {
      throw new Error("Admin information is required: adminEmail and adminName must be provided");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // If firmId and sendToAllMembers, get all firm members
    let recipientEmails: Array<{email: string, userId: string, name?: string}> = [];
    
    if (firmId && sendToAllMembers) {
      console.log('📧 Fetching all members for firm:', firmId);
      const { data: members, error: membersError } = await supabaseAdmin
        .from('firm_members')
        .select(`
          user_id,
          user:profiles(email, first_name, last_name)
        `)
        .eq('firm_id', firmId);
      
      if (membersError) {
        console.error('❌ Error fetching firm members:', membersError);
        throw new Error('Failed to fetch firm members');
      }
      
      recipientEmails = members?.map(m => ({
        email: m.user.email,
        userId: m.user_id,
        name: [m.user.first_name, m.user.last_name].filter(Boolean).join(' ')
      })) || [];
      
      console.log(`✅ Found ${recipientEmails.length} firm members to email`);
    } else {
      if (!userId || !userEmail) {
        throw new Error("Missing required parameters: userId and userEmail are required for single emails");
      }
      recipientEmails = [{ email: userEmail, userId }];
    }

    // Get default NDA document if no attachments provided
    const finalAttachments = [...attachments];
    
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
    const senderEmail = providedAdminEmail;
    const senderName = providedAdminName;
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
    
    if (customSignature?.signature_text) {
      // Prioritize text signature and build HTML from it
      console.log('✅ Using custom text signature (prioritized)');
      const signatureParts = customSignature.signature_text.split('\n').filter(line => line.trim());
      
      // Add optional phone and calendly if provided
      if (customSignature.phone_number?.trim()) {
        signatureParts.push(`<a href="tel:${customSignature.phone_number.replace(/[^\d]/g, '')}" style="color: #0066cc; text-decoration: none;">${customSignature.phone_number}</a>`);
      }
      
      if (customSignature.calendly_url?.trim()) {
        signatureParts.push(`<a href="${customSignature.calendly_url}" style="color: #0066cc; text-decoration: none;">Click here to schedule a call with me</a>`);
      }
      
      adminSignature = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">
          <p style="margin: 0;">
            ${signatureParts.join('<br>')}
          </p>
        </div>`;
    } else {
      // Create template signature with conditional elements
      const signatureParts = [
        `<strong>${senderName}</strong>`,
        adminTitle,
        `<a href="mailto:${senderEmail}" style="color: #0066cc; text-decoration: none;">${senderEmail}</a>`
      ];
      
      // Only add phone if provided in custom signature
      if (customSignature?.phone_number) {
        signatureParts.push(`<a href="tel:${customSignature.phone_number.replace(/[^\d]/g, '')}" style="color: #0066cc; text-decoration: none;">${customSignature.phone_number}</a>`);
      }
      
      // Only add calendly if provided in custom signature
      if (customSignature?.calendly_url) {
        signatureParts.push(`<a href="${customSignature.calendly_url}" style="color: #0066cc; text-decoration: none;">Click here to schedule a call with me</a>`);
      }
      
      adminSignature = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.4;">
          <p style="margin: 0;">
            ${signatureParts.join('<br>')}
          </p>
        </div>`;
      console.log('✅ Using conditional signature template');
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
    const emailMessage = customMessage || `Please sign the attached NDA to access confidential deal information.

Return the signed document to proceed.`;

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

    // Send emails to all recipients
    const emailResults = [];
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipientEmails) {
      try {
        console.log(`📬 Sending NDA to ${recipient.email} (${recipient.userId})...`);
        
        const brevoPayload = {
          to: [{ email: recipient.email, name: recipient.name || recipient.email.split('@')[0] }],
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

        if (!brevoResponse.ok) {
          const errorText = await brevoResponse.text();
          console.error(`❌ Failed to send to ${recipient.email}:`, errorText);
          failCount++;
          emailResults.push({ email: recipient.email, success: false, error: errorText });
          continue;
        }

        const brevoResult = await brevoResponse.json();
        console.log(`✅ Sent to ${recipient.email}:`, brevoResult.messageId);
        successCount++;
        emailResults.push({ email: recipient.email, success: true, messageId: brevoResult.messageId });

        // Update database for this recipient
        try {
          await supabaseAdmin
            .from('profiles')
            .update({
              nda_email_sent: true,
              nda_email_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', recipient.userId);

          await supabaseAdmin
            .from('nda_logs')
            .insert({
              user_id: recipient.userId,
              admin_id: adminId,
              firm_id: firmId,
              action_type: 'sent',
              email_sent_to: recipient.email,
              admin_email: providedAdminEmail,
              admin_name: providedAdminName,
              notes: `NDA email sent${sendToAllMembers ? ' (firm-wide)' : ''}${listingTitle ? ` for listing: ${listingTitle}` : ''}`,
              metadata: { email_sent: true, sent_at: new Date().toISOString(), firm_email: sendToAllMembers }
            });
        } catch (dbError) {
          console.error(`⚠️ Database update failed for ${recipient.email}:`, dbError);
        }
      } catch (error: any) {
        console.error(`❌ Error sending to ${recipient.email}:`, error);
        failCount++;
        emailResults.push({ email: recipient.email, success: false, error: error.message });
      }
    }

    console.log(`📊 NDA batch complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: successCount > 0,
        totalRecipients: recipientEmails.length,
        successCount,
        failCount,
        results: emailResults,
        message: `NDA email sent to ${successCount}/${recipientEmails.length} recipients`
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