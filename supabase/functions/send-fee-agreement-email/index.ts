import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FeeAgreementEmailRequest {
  userId: string;
  userEmail: string;
  subject?: string;
  content?: string;
  useTemplate?: boolean;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  attachments?: Array<{
    name: string;
    content: string; // base64 encoded
    type?: string;
  }>;
}

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
      attachments 
    }: FeeAgreementEmailRequest = await req.json();

    console.log(`📧 Starting fee agreement email process`, { 
      userEmail, 
      userId, 
      useTemplate, 
      subject, 
      adminEmail, 
      adminName,
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

    // Use custom content if provided, otherwise use default template
    const emailSubject = subject || "SourceCo Advisory Services - Fee Agreement";
    
    // Fetch and embed SourceCo logo with fallback
    console.log('🔄 Fetching SourceCo logo...');
    let logoBase64 = '';
    let logoAttachment = null;
    
    // Primary logo sources - your uploaded SourceCo logos
    const logoSources = [
      'https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listing-images/660e3240-2a08-42a0-8723-65b152b941a5.png',
      'https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listing-images/b879fa06-6a99-4263-b973-b9ced4404acb.png',
      'https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listings/sourceco-logo-gold.png'
    ];
    
    for (const logoUrl of logoSources) {
      try {
        console.log(`🔄 Attempting to fetch SourceCo logo from: ${logoUrl}`);
        const logoResponse = await fetch(logoUrl);
        
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const logoBytes = new Uint8Array(logoBuffer);
          logoBase64 = btoa(String.fromCharCode(...logoBytes));
          
          // Create attachment for CID fallback
          logoAttachment = {
            name: "sourceco-logo.png",
            content: logoBase64
          };
          
          console.log('✅ SourceCo logo converted to base64 successfully from:', logoUrl);
          console.log(`✅ Logo size: ${logoBytes.length} bytes, base64 length: ${logoBase64.length} chars`);
          break; // Success, stop trying other sources
        } else {
          console.warn(`⚠️ Could not fetch logo from ${logoUrl}, status:`, logoResponse.status);
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching logo from ${logoUrl}:`, error);
      }
    }
    
    if (!logoBase64) {
      console.warn('⚠️ Could not fetch any SourceCo logo - will proceed without logo embedding');
    } else {
      console.log('🎯 Successfully loaded SourceCo logo for email signature');
    }
    
    // Generate premium SourceCo email signature with embedded base64 logo
    const logoSrc = logoBase64 
      ? `data:image/png;base64,${logoBase64}`
      : 'cid:sourceco_logo'; // Fallback to attachment
    
    const adminSignature = `
      <div style="margin-top: 40px; padding: 0; font-family: 'Georgia', 'Times New Roman', serif;">
        <table cellpadding="0" cellspacing="0" style="width: 100%; border-top: 3px solid #d4af37; padding-top: 25px;">
          <tr>
            <td style="vertical-align: top; width: 100px; padding-right: 25px;">
              <img src="${logoSrc}" alt="SourceCo Advisory Services" style="max-width: 80px; height: auto; display: block;" />
            </td>
            <td style="vertical-align: top; border-left: 1px solid #e5e5e5; padding-left: 25px;">
              <div style="line-height: 1.3;">
                <p style="margin: 0; font-size: 18px; font-weight: 600; color: #000000; margin-bottom: 6px; letter-spacing: 0.5px;">${adminName}</p>
                <p style="margin: 0; font-size: 13px; color: #666666; margin-bottom: 3px; font-style: italic;">Managing Director</p>
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #d4af37; margin-bottom: 12px; letter-spacing: 1px;">SOURCECO</p>
                <p style="margin: 0; font-size: 12px; color: #444444; margin-bottom: 3px; line-height: 1.4;">
                  <span style="color: #d4af37; font-weight: 600;">E</span> ${adminEmail}
                </p>
                <p style="margin: 0; font-size: 12px; color: #444444; line-height: 1.4;">
                  <span style="color: #d4af37; font-weight: 600;">W</span> sourcecodeals.com
                </p>
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 9px; color: #888888; text-align: center; font-family: 'Arial', sans-serif;">
          <p style="margin: 0; line-height: 1.3;">CONFIDENTIAL | This communication contains proprietary information for qualified business acquisition professionals.</p>
        </div>
      </div>`;

    // Generate premium SourceCo email content with black/gold styling
    const emailContent = useTemplate
      ? `<div style="font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.7; color: #333333; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 50px 40px; background-color: #ffffff; border: 2px solid #f5f5f5;">
            <div style="text-align: center; margin-bottom: 40px; padding-bottom: 25px; border-bottom: 2px solid #d4af37;">
              <h1 style="color: #000000; font-size: 28px; margin: 0; font-weight: 600; letter-spacing: 1px;">FEE AGREEMENT</h1>
              <p style="color: #666666; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">SourceCo Advisory Services</p>
            </div>
            
            <p style="margin-bottom: 25px; font-size: 16px; color: #333333;">Dear <strong style="color: #000000;">${userEmail.split('@')[0]}</strong>,</p>
            
            <p style="margin-bottom: 25px; font-size: 15px;">We are pleased to present our Fee Agreement for your review and execution. This document formalizes our engagement and outlines the terms of our professional advisory services.</p>
            
            <div style="background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%); padding: 30px; margin: 35px 0; border-left: 5px solid #d4af37; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <p style="margin: 0 0 20px 0; font-weight: 600; color: #000000; font-size: 16px;">Agreement Scope & Terms:</p>
              <ul style="margin: 0; padding-left: 25px; color: #444444; font-size: 14px; line-height: 1.6;">
                <li style="margin-bottom: 12px;">Professional advisory fees and payment structure</li>
                <li style="margin-bottom: 12px;">Comprehensive scope of services and deliverables</li>
                <li style="margin-bottom: 12px;">Strict confidentiality and non-disclosure provisions</li>
                <li style="margin-bottom: 12px;">Project timeline, milestones, and success metrics</li>
                <li style="margin-bottom: 12px;">Exclusive representation and fiduciary obligations</li>
              </ul>
            </div>
            
            <p style="margin-bottom: 25px; font-size: 15px;">We encourage you to carefully review all terms and conditions. Our team remains available to address any questions or discuss specific provisions that may require clarification.</p>
            
            <div style="background-color: #000000; color: #ffffff; padding: 25px; margin: 30px 0; text-align: center; border-radius: 0;">
              <p style="margin: 0; color: #d4af37; font-weight: 600; font-size: 14px; letter-spacing: 1px;">NEXT STEPS</p>
              <p style="margin: 12px 0 0 0; color: #ffffff; font-size: 13px; line-height: 1.5;">Upon your acceptance of these terms, please execute and return the agreement to formalize our engagement.</p>
            </div>
            
            <p style="margin-bottom: 35px; font-size: 15px;">We appreciate the opportunity to serve as your trusted advisor and look forward to a successful collaboration.</p>
            
            <p style="margin-bottom: 25px; font-weight: 500; font-size: 15px;">Respectfully yours,</p>
            
            ${adminSignature}
          </div>
        </div>`
      : `<div style="font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.7; color: #333333; max-width: 650px; margin: 0 auto;">
          <div style="padding: 50px 40px; background-color: #ffffff; border: 2px solid #f5f5f5;">
            ${content ? content.replace(/\n/g, '<br>') : ''}
            ${adminSignature}
          </div>
        </div>`;

    // Determine the best sender email based on admin domain
    let senderEmail = "noreply@sourcecodeals.com";
    let senderName = `${adminName} - SourceCo`;
    
    // Use admin's domain if it's a verified SourceCo domain
    if (adminEmail.includes("@sourcecodeals.com")) {
      senderEmail = adminEmail;
      senderName = adminName;
    }
    
    console.log(`📧 Using sender: ${senderName} <${senderEmail}>, reply-to: ${adminName} <${adminEmail}>`);

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
      htmlContent: emailContent,
      replyTo: {
        email: adminEmail,
        name: adminName
      }
    };

    // Only add logo attachment if we're using cid fallback AND don't have base64
    const needsLogoAttachment = logoAttachment && !logoBase64;
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
        // Add logo attachment if needed
        if (needsLogoAttachment) {
          processedAttachments.push(logoAttachment);
          console.log('📎 Added logo as attachment for cid fallback');
        }
        brevoPayload.attachment = processedAttachments;
        console.log(`📎 Successfully added ${processedAttachments.length} attachment(s) to Brevo payload`);
        console.log(`📎 Final attachment summary:`, processedAttachments.map(a => ({
          name: a.name,
          size: Math.round(a.content.length * 0.75) + ' bytes'
        })));
      } else {
        console.error(`❌ No valid attachments processed from ${attachments.length} input attachment(s)`);
      }
    } else if (needsLogoAttachment) {
      // Only logo attachment needed
      brevoPayload.attachment = [logoAttachment];
      console.log('📎 Added only logo as attachment for cid fallback');
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