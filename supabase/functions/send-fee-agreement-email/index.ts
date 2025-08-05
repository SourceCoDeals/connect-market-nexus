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
  userId: string;
  userEmail: string;
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

// Admin profiles mapping
const ADMIN_PROFILES: Record<string, AdminProfile> = {
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userId, 
      userEmail, 
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
      useTemplate, 
      subject: emailSubject, 
      adminEmail, 
      adminName,
      listingTitle,
      attachmentCount: attachments?.length || 0 
    });

    // Validate required parameters
    if (!userId || !userEmail) {
      throw new Error("Missing required parameters: userId and userEmail are required");
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

    // Initialize Supabase client for custom signature lookup
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
            <strong>${effectiveAdminName}</strong><br>
            ${adminTitle}<br>
            <a href="mailto:${adminEmail}" style="color: #0066cc; text-decoration: none;">${adminEmail}</a><br>
            <a href="tel:${finalPhone.replace(/[^\d]/g, '')}" style="color: #0066cc; text-decoration: none;">${finalPhone}</a><br>
            <a href="${finalCalendly}" style="color: #0066cc; text-decoration: none;">Click here to schedule a call with me</a>
          </p>
        </div>`;
      console.log('✅ Using Bill Martin format signature template');
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

    // Skip complex templates - textContent is all we need for simple, working emails

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

    // Prepare Brevo email payload
    const brevoPayload: any = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: userEmail,
          name: userEmail.split('@')[0] // Use email username as display name
        }
      ],
      subject: emailSubject,
      textContent: textContent,
      htmlContent: htmlContent,
      replyTo: {
        email: adminEmail,
        name: adminName
      }
    };

    // Simple attachment processing without logo
    const hasUserAttachments = attachments && attachments.length > 0;

    // Enhanced attachment processing with detailed logging
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
        brevoPayload.attachment = processedAttachments;
        console.log(`📎 Successfully added ${processedAttachments.length} attachment(s) to Brevo payload`);
        console.log(`📎 Final attachment summary:`, processedAttachments.map(a => ({
          name: a.name,
          size: Math.round(a.content.length * 0.75) + ' bytes',
          hasCID: !!a.cid
        })));
      } else {
        console.error(`❌ No valid attachments processed from ${attachments.length} input attachment(s)`);
      }
    }
    
    // Only set attachment property if we actually have attachments
    if (!brevoPayload.attachment || brevoPayload.attachment.length === 0) {
      delete brevoPayload.attachment;
      console.log('📎 No attachments needed - removed attachment property from payload');
    }

    console.log('📬 Sending fee agreement email via Brevo...', {
      to: userEmail,
      from: brevoPayload.sender,
      replyTo: brevoPayload.replyTo,
      subject: emailSubject,
      attachmentCount: brevoPayload.attachment?.length || 0,
      payloadSize: JSON.stringify(brevoPayload).length
    });

    // Send email using Brevo API
    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify(brevoPayload)
    });

    console.log(`📡 Brevo API response status: ${emailResponse.status}`);

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("❌ Brevo API error response:", errorData);
      console.error("❌ Brevo API status:", emailResponse.status, emailResponse.statusText);
      console.error("❌ Request payload size:", JSON.stringify(brevoPayload).length, "bytes");
      console.error("❌ Sender config:", brevoPayload.sender);
      console.error("❌ Attachment info:", {
        count: brevoPayload.attachment?.length || 0,
        names: brevoPayload.attachment?.map((a: any) => a.name) || [],
        sizes: brevoPayload.attachment?.map((a: any) => a.content?.length || 0) || []
      });
      
      // Try to parse error response for better error messages
      let errorMessage = "Unknown email service error";
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.message || errorJson.error || errorData;
      } catch {
        errorMessage = errorData;
      }
      
      // Provide more specific error messages
      if (emailResponse.status === 400) {
        throw new Error(`Email validation error: ${errorMessage}`);
      } else if (emailResponse.status === 401) {
        throw new Error("Email service authentication failed. Check BREVO_API_KEY configuration.");
      } else if (emailResponse.status === 402) {
        throw new Error("Email service quota exceeded. Please contact support.");
      } else if (emailResponse.status === 403) {
        throw new Error(`Email service forbidden: ${errorMessage}. Check sender domain configuration.`);
      } else {
        throw new Error(`Email service error (${emailResponse.status}): ${errorMessage}`);
      }
    }

    const result = await emailResponse.json();
    console.log("✅ Fee agreement email sent successfully via Brevo:", result);

    // Now log to database after successful email send
    console.log('📝 Logging fee agreement email to database...');
    try {
      // Update profile status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          fee_agreement_email_sent: true,
          fee_agreement_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        console.error('⚠️ Profile update failed but email was sent:', profileError);
      }

      // Log the email action
      const { error: logError } = await supabase
        .from('fee_agreement_logs')
        .insert({
          user_id: userId,
          admin_id: adminId,
          action_type: 'sent',
          email_sent_to: userEmail,
          admin_email: adminEmail,
          admin_name: adminName,
          notes: `Fee agreement email sent via admin interface${listingTitle ? ` for listing: ${listingTitle}` : ''}`,
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

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: result.messageId 
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