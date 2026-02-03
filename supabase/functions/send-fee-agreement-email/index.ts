import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminProfile {
  email: string;
  name: string;
  title: string;
  phone: string;
  calendlyUrl: string;
}

interface FeeAgreementEmailRequest {
  userId?: string;
  userEmail: string;
  firmId?: string;
  sendToAllMembers?: boolean;
  subject?: string;
  content?: string;
  useTemplate?: boolean;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  listingTitle?: string;
  customSignatureText?: string;
  attachments?: Array<{
    name: string;
    content: string; // base64 encoded
    type?: string;
  }>;
}

// Admin profiles mapping - only basic info, no hardcoded contact details
const ADMIN_PROFILES: Record<string, AdminProfile> = {
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userId, 
      userEmail, 
      firmId,
      sendToAllMembers,
      subject, 
      content, 
      useTemplate, 
      adminId, 
      adminEmail, 
      adminName,
      listingTitle,
      customSignatureText,
      attachments 
    }: FeeAgreementEmailRequest = await req.json();

    const emailSubject = listingTitle 
      ? `Fee Agreement - ${listingTitle} | SourceCo`
      : subject || 'Fee Agreement | SourceCo';

    console.log(`📧 Starting fee agreement email process`, { 
      userEmail, 
      userId,
      firmId,
      sendToAllMembers,
      useTemplate, 
      subject: emailSubject, 
      adminEmail, 
      adminName,
      listingTitle,
      attachmentCount: attachments?.length || 0 
    });

    // Initialize Supabase client early for firm member lookup
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If firmId and sendToAllMembers, get all firm members
    let recipientEmails: Array<{email: string, userId: string, name?: string}> = [];
    
    if (firmId && sendToAllMembers) {
      console.log('📧 Fetching all members for firm:', firmId);
      const { data: members, error: membersError } = await supabase
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
      // Single recipient
      if (!userId || !userEmail) {
        throw new Error("Missing required parameters: userId and userEmail are required for single emails");
      }
      recipientEmails = [{ email: userEmail, userId }];
    }

    if (!adminEmail || !adminName) {
      throw new Error("Admin information is required: adminEmail and adminName must be provided");
    }

    // Get Brevo API key
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("❌ BREVO_API_KEY environment variable is not set");
      throw new Error("Email service configuration error. Please contact support.");
    }

    console.log("✅ Brevo API key found, proceeding with email setup");

    // Get admin profile for enhanced signature
    const adminProfile = adminEmail ? ADMIN_PROFILES[adminEmail] : null;
    const effectiveAdminName = adminProfile?.name || adminName || 'SourceCo Team';
    const adminTitle = adminProfile?.title || '';
    const adminPhone = adminProfile?.phone || '';
    const adminCalendly = adminProfile?.calendlyUrl || '';

    // Try to get custom admin signature
    let customSignature = null;
    try {
      const { data: signatureData } = await supabase
        .from('admin_signature_preferences')
        .select('signature_html, signature_text, phone_number, calendly_url')
        .eq('admin_id', adminId)
        .single();
      
      if (signatureData) {
        customSignature = signatureData;
        console.log('✅ Found custom signature for admin:', adminId);
      }
    } catch (error) {
      console.log('ℹ️ No custom signature found, using default template');
    }

    // Email subject is already set above with listing title if available
    
    // Skip logo entirely for fast, reliable emails
    console.log('📧 Using text-only signature without logo for immediate delivery');
    
    // Create premium signature with Bill Martin format
    let adminSignature;
    
    if (customSignature?.signature_text) {
      // Prioritize text signature and build HTML from it
      console.log('✅ Using custom text signature (prioritized)');
      let signatureParts = customSignature.signature_text.split('\n').filter(line => line.trim());
      
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
      let signatureParts = [
        `<strong>${effectiveAdminName}</strong>`,
        adminTitle,
        `<a href="mailto:${adminEmail}" style="color: #0066cc; text-decoration: none;">${adminEmail}</a>`
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
    
    const textContent = content ? `${content}

${signatureText}` : signatureText;

    // Determine the sender email - use current admin info
    let senderEmail = adminEmail;
    let senderName = adminName;
    
    // Only use noreply if admin email is not from our domain
    if (!adminEmail.includes("@sourcecodeals.com")) {
      senderEmail = "noreply@sourcecodeals.com";
      senderName = `${adminName} - SourceCo`;
    }
    
    console.log(`📧 Using sender: ${senderName} <${senderEmail}>, reply-to: ${adminName} <${adminEmail}>`);

    // Build HTML content (required by Brevo API)
    const htmlContent = content ? `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
${content.replace(/\n/g, '<br>')}
<br><br>
${adminSignature}
</div>` : `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
${adminSignature}
</div>`;

    // Process attachments once for all recipients
    let processedAttachments: any[] = [];
    
    if (attachments && attachments.length > 0) {
      console.log(`📎 Starting attachment processing for ${attachments.length} attachment(s)`);
      console.log(`📎 Raw attachments data:`, attachments.map(a => ({ 
        name: a.name, 
        hasContent: !!a.content, 
        contentLength: a.content?.length || 0,
        contentPreview: a.content?.substring(0, 50) + '...'
      })));
      
      // Validate and process attachments
      const processedAttachments = [];
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        console.log(`📎 Processing attachment ${i + 1}/${attachments.length}: ${att.name}`);
        
        if (!att.name || !att.content) {
          console.warn(`⚠️ Skipping invalid attachment ${i + 1}: missing name or content`, {
            hasName: !!att.name,
            hasContent: !!att.content,
            name: att.name
          });
          continue;
        }
        
        // Clean and validate base64 content
        let content = att.content;
        console.log(`📎 Original content length for ${att.name}: ${content.length} chars`);
        
        // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
        if (content.includes(',')) {
          const parts = content.split(',');
          content = parts[1];
          console.log(`📎 Removed data URL prefix for ${att.name}, new length: ${content.length} chars`);
        }
        
        // Remove any whitespace or newlines
        const originalLength = content.length;
        content = content.replace(/\s/g, '');
        if (originalLength !== content.length) {
          console.log(`📎 Cleaned whitespace from ${att.name}: ${originalLength} → ${content.length} chars`);
        }
        
        // Enhanced base64 validation
        if (!content || content.length === 0) {
          console.warn(`⚠️ Empty content after cleaning for ${att.name}`);
          continue;
        }
        
        try {
          // Test base64 decoding
          const decoded = atob(content);
          const decodedSize = decoded.length;
          console.log(`✅ Successfully decoded base64 for ${att.name}: ${content.length} chars → ${decodedSize} bytes`);
          
          // Additional PDF header validation for PDFs
          if (att.name.toLowerCase().endsWith('.pdf')) {
            const pdfHeader = decoded.substring(0, 5);
            if (!pdfHeader.startsWith('%PDF')) {
              console.warn(`⚠️ ${att.name} doesn't appear to be a valid PDF (missing %PDF header)`);
              // Continue anyway - some PDFs might have variations
            } else {
              console.log(`✅ PDF header validation passed for ${att.name}`);
            }
          }
          
          processedAttachments.push({
            name: att.name,
            content: content
          });
          
          console.log(`✅ Successfully processed attachment: ${att.name} (${decodedSize} bytes)`);
          
        } catch (e) {
          console.error(`❌ Base64 validation failed for ${att.name}:`, e);
          console.error(`❌ Content sample:`, content.substring(0, 100));
          continue;
        }
      }
      
      if (processedAttachments.length > 0) {
        console.log(`📎 Successfully processed ${processedAttachments.length} attachment(s)`);
      } else {
        console.error(`❌ No valid attachments processed from ${attachments.length} input attachment(s)`);
      }
    }

    // Send emails to all recipients
    const emailResults = [];
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipientEmails) {
      try {
        console.log(`📬 Sending to ${recipient.email} (${recipient.userId})...`);
        
        const brevoPayload: any = {
          sender: { name: senderName, email: senderEmail },
          to: [{ email: recipient.email, name: recipient.name || recipient.email.split('@')[0] }],
          subject: emailSubject,
          textContent: textContent,
          htmlContent: htmlContent,
          replyTo: { email: adminEmail, name: adminName }
        };

        if (processedAttachments.length > 0) {
          brevoPayload.attachment = processedAttachments;
        }

        const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify(brevoPayload)
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.text();
          console.error(`❌ Failed to send to ${recipient.email}:`, errorData);
          failCount++;
          emailResults.push({ email: recipient.email, success: false, error: errorData });
          continue;
        }

        const result = await emailResponse.json();
        console.log(`✅ Sent to ${recipient.email}:`, result.messageId);
        successCount++;
        emailResults.push({ email: recipient.email, success: true, messageId: result.messageId });

        // Update database for this recipient
        try {
          await supabase
            .from('profiles')
            .update({
              fee_agreement_email_sent: true,
              fee_agreement_email_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', recipient.userId);

          await supabase
            .from('fee_agreement_logs')
            .insert({
              user_id: recipient.userId,
              admin_id: adminId,
              firm_id: firmId,
              action_type: 'sent',
              email_sent_to: recipient.email,
              admin_email: adminEmail,
              admin_name: adminName,
              notes: `Fee agreement email sent${sendToAllMembers ? ' (firm-wide)' : ''}${listingTitle ? ` for listing: ${listingTitle}` : ''}`,
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

    console.log(`📊 Email batch complete: ${successCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({ 
      success: successCount > 0,
      totalRecipients: recipientEmails.length,
      successCount,
      failCount,
      results: emailResults
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in send-fee-agreement-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);