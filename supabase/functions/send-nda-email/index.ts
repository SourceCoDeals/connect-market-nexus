import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { getAdminProfile } from "../_shared/admin-profiles.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendNDAEmailRequest {
  userEmail: string;
  userId: string;
  customSubject?: string;
  customMessage?: string;
  adminEmail?: string;
  adminName?: string;
  listingTitle?: string;
  customSignatureHtml?: string;
  customSignatureText?: string;
  attachments?: Array<{
    name: string;
    content: string; // base64 encoded content
    contentType?: string;
  }>;
}

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
      userEmail,
      userId,
      customSubject,
      customMessage,
      adminEmail: providedAdminEmail,
      adminName: providedAdminName,
      listingTitle,
      customSignatureHtml,
      customSignatureText,
      attachments = []
    }: SendNDAEmailRequest = await req.json();

    const subject = listingTitle 
      ? `NDA Required - ${listingTitle} | SourceCo`
      : customSubject || "Non-Disclosure Agreement | SourceCo";
    const useTemplate = !customMessage;
    
    console.log('📧 Starting NDA email process', {
      userEmail,
      userId,
      useTemplate,
      subject,
      adminEmail: providedAdminEmail,
      adminName: providedAdminName,
      listingTitle,
      attachmentCount: attachments.length
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get default NDA document if no attachments provided
    let finalAttachments = [...attachments];
    
    if (finalAttachments.length === 0) {
      console.log('📎 No attachments provided, fetching default NDA document...');
      
      try {
        // Try specific filename first
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
          console.log('⚠️ Could not fetch specific NDA file, trying to list all files...');
          
          // Fallback: list all files and take the first one
          const { data: files, error: listError } = await supabaseAdmin.storage
            .from('nda-documents')
            .list('', { limit: 10 });

          if (!listError && files && files.length > 0) {
            console.log('📎 Found files in NDA bucket:', files.map(f => f.name));
            
            const defaultFile = files[0];
            console.log('📎 Using first available file:', defaultFile.name);
            
            const { data: fallbackFileData, error: fallbackError } = await supabaseAdmin.storage
              .from('nda-documents')
              .download(defaultFile.name);

            if (!fallbackError && fallbackFileData) {
              const arrayBuffer = await fallbackFileData.arrayBuffer();
              const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
              
              finalAttachments.push({
                name: defaultFile.name,
                content: base64Content,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              });
              
              console.log('✅ Fallback NDA document loaded successfully:', defaultFile.name);
            } else {
              console.error('❌ Error downloading fallback NDA:', fallbackError);
            }
          } else {
            console.log('⚠️ No NDA documents found in storage bucket');
          }
        }
      } catch (error) {
        console.error('❌ Error fetching default NDA document:', error);
      }
    }

    // Determine sender information
    let senderEmail = 'adam.haile@sourcecodeals.com';
    let senderName = 'Adam Haile';
    let adminTitle = 'Founder & CEO';
    let adminPhone = '(614) 555-0100';
    let adminCalendly = 'https://calendly.com/adam-haile-sourceco/30min';

    if (providedAdminEmail) {
      const adminProfile = getAdminProfile(providedAdminEmail);
      if (adminProfile) {
        senderEmail = adminProfile.email;
        senderName = adminProfile.name;
        adminTitle = adminProfile.title;
        adminPhone = adminProfile.phone;
        adminCalendly = adminProfile.calendlyUrl;
      }
    }

    const effectiveAdminName = providedAdminName || senderName;

    console.log('📧 Using sender:', `${effectiveAdminName} <${senderEmail}>`, 'reply-to:', `${effectiveAdminName} <${senderEmail}>`);

    // Fetch custom admin signature if available
    let finalHtmlSignature = customSignatureHtml;
    let finalTextSignature = customSignatureText;

    if (!finalHtmlSignature || !finalTextSignature) {
      console.log('📝 Fetching admin signature preferences...');
      try {
        const { data: signatureData } = await supabaseAdmin
          .from('admin_signature_preferences')
          .select('signature_html, signature_text')
          .single();

        if (signatureData) {
          finalHtmlSignature = signatureData.signature_html || customSignatureHtml;
          finalTextSignature = signatureData.signature_text || customSignatureText;
          console.log('✅ Using admin custom signature');
        }
      } catch (error) {
        console.log('⚠️ No custom signature found, using default');
      }
    }

    console.log('📧 Using signature with admin preferences integration');

    // Process attachments
    console.log('📎 Starting attachment processing for', finalAttachments.length, 'attachment(s)');
    
    const processedAttachments = [];

    for (const [index, attachment] of finalAttachments.entries()) {
      console.log(`📎 Processing attachment ${index + 1}/${finalAttachments.length}: ${attachment.name}`);
      
      try {
        // Validate attachment has content
        if (!attachment.content) {
          console.error(`❌ Attachment ${attachment.name} has no content`);
          continue;
        }
        
        // Validate base64 content
        const cleanBase64 = attachment.content.replace(/^data:[^;]+;base64,/, '');
        console.log(`📎 Original content length for ${attachment.name}: ${cleanBase64.length} chars`);
        
        // Validate PDF header if it's a PDF
        if (attachment.name.toLowerCase().endsWith('.pdf')) {
          const decoded = atob(cleanBase64);
          if (decoded.startsWith('%PDF-')) {
            console.log(`✅ PDF header validation passed for ${attachment.name}`);
          } else {
            console.log(`⚠️ PDF header validation failed for ${attachment.name}`);
          }
        }

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

    // Simple text content - just message + signature with proper formatting
    const textContent = customMessage ? `${customMessage}

${finalTextSignature}` : finalTextSignature;

    // Send email via Brevo
    console.log('📬 Sending NDA email via Brevo...', {
      to: userEmail,
      from: { name: effectiveAdminName, email: senderEmail },
      replyTo: { email: senderEmail, name: effectiveAdminName },
      subject: subject,
      attachmentCount: processedAttachments.length,
      payloadSize: JSON.stringify(processedAttachments).length
    });

    const brevoPayload = {
      to: [{ email: userEmail }],
      sender: { name: effectiveAdminName, email: senderEmail },
      replyTo: { email: senderEmail, name: effectiveAdminName },
      subject: subject,
      textContent: textContent,
      htmlContent: customMessage ? `<p>${customMessage.replace(/\n/g, '<br>')}</p><br><div>${finalHtmlSignature || textContent.replace(/\n/g, '<br>')}</div>` : finalHtmlSignature || textContent.replace(/\n/g, '<br>'),
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