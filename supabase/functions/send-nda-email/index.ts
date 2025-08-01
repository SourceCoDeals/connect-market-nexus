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

// Default fallback signatures to prevent undefined errors
const DEFAULT_TEXT_SIGNATURE = `Best regards,
SourceCo Team

SourceCo
Email: hello@sourcecodeals.com
Website: https://sourcecodeals.com`;

const DEFAULT_HTML_SIGNATURE = `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5;">
  <p style="margin: 0; color: #666;">Best regards,<br>
  <strong>SourceCo Team</strong></p>
  <br>
  <p style="margin: 0; color: #888; font-size: 12px;">
    <strong>SourceCo</strong><br>
    Email: hello@sourcecodeals.com<br>
    Website: <a href="https://sourcecodeals.com" style="color: #0066cc;">https://sourcecodeals.com</a>
  </p>
</div>`;

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
    
    console.log('📧 Starting NDA email process', {
      userEmail,
      userId,
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

    // Determine sender information with fallbacks
    let senderEmail = 'hello@sourcecodeals.com';
    let senderName = 'SourceCo Team';

    // Use provided admin info if available
    if (providedAdminEmail && providedAdminName) {
      senderEmail = providedAdminEmail;
      senderName = providedAdminName;
    }

    console.log('📧 Using sender:', `${senderName} <${senderEmail}>`);

    // Get signatures with robust fallback chain
    let finalTextSignature = DEFAULT_TEXT_SIGNATURE;
    let finalHtmlSignature = DEFAULT_HTML_SIGNATURE;

    // Priority 1: Use provided custom signatures
    if (customSignatureText) {
      finalTextSignature = customSignatureText;
      console.log('📝 Using provided custom text signature');
    }
    if (customSignatureHtml) {
      finalHtmlSignature = customSignatureHtml;
      console.log('📝 Using provided custom HTML signature');
    }

    // Priority 2: Try to get admin signature from database if no custom provided
    if (!customSignatureText || !customSignatureHtml) {
      console.log('📝 Fetching admin signature preferences...');
      try {
        const { data: signatureData } = await supabaseAdmin
          .from('admin_signature_preferences')
          .select('signature_html, signature_text')
          .single();

        if (signatureData) {
          if (!customSignatureText && signatureData.signature_text) {
            finalTextSignature = signatureData.signature_text;
            console.log('✅ Using database text signature');
          }
          if (!customSignatureHtml && signatureData.signature_html) {
            finalHtmlSignature = signatureData.signature_html;
            console.log('✅ Using database HTML signature');
          }
        }
      } catch (error) {
        console.log('⚠️ No database signature found, using defaults');
      }
    }

    console.log('📧 Signature processing complete - using safe fallbacks');

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

    // Build email content safely with null coalescing
    const messageText = customMessage ?? '';
    const textContent = messageText ? `${messageText}\n\n${finalTextSignature}` : finalTextSignature;
    
    const htmlContent = messageText 
      ? `<p>${messageText.replace(/\n/g, '<br>')}</p><br>${finalHtmlSignature}` 
      : finalHtmlSignature;

    // Send email via Brevo
    console.log('📬 Sending NDA email via Brevo...', {
      to: userEmail,
      from: { name: senderName, email: senderEmail },
      subject: subject,
      attachmentCount: processedAttachments.length,
      payloadSize: JSON.stringify(processedAttachments).length
    });

    const brevoPayload = {
      to: [{ email: userEmail }],
      sender: { name: senderName, email: senderEmail },
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