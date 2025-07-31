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
    const emailSubject = subject || "SourceCo - Deal Fee Agreement";
    
    // Generate professional email signature with company branding and logo
    const logoUrl = "https://vhzipqarkmmfuqadefep.supabase.co/storage/v1/object/public/listing-images/sourceco-logo.png";
    
    const adminSignature = `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #1e40af; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 20px; border-radius: 8px;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="vertical-align: top; width: 120px; padding-right: 20px;">
              <img src="${logoUrl}" alt="SourceCo Logo" style="max-width: 100px; height: auto; border-radius: 4px;" />
            </td>
            <td style="vertical-align: top;">
              <div style="line-height: 1.4;">
                <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1e40af; margin-bottom: 4px;">${adminName}</p>
                <p style="margin: 0; font-size: 13px; color: #64748b; margin-bottom: 2px;">Business Development Manager</p>
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 8px;">SourceCo</p>
                <p style="margin: 0; font-size: 12px; color: #64748b; margin-bottom: 2px;">
                  <span style="color: #1e40af;">✉</span> ${adminEmail}
                </p>
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  <span style="color: #1e40af;">🌐</span> sourcecodeals.com
                </p>
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">This email contains confidential and privileged information intended for institutional investors.</p>
        </div>
      </div>`;

    // Generate professional email content with enhanced styling
    const emailContent = useTemplate
      ? `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
              <h1 style="color: #1e40af; font-size: 24px; margin: 0; font-weight: 600;">Fee Agreement Review</h1>
              <p style="color: #64748b; margin: 8px 0 0 0; font-size: 14px;">SourceCo Business Development</p>
            </div>
            
            <p style="margin-bottom: 20px; font-size: 16px;">Dear <strong>${userEmail.split('@')[0]}</strong>,</p>
            
            <p style="margin-bottom: 20px;">I hope this email finds you well. As part of our engagement process, I'm sending you our Fee Agreement for your review and signature.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #1e40af;">
              <p style="margin: 0 0 15px 0; font-weight: 600; color: #1e40af;">This agreement outlines:</p>
              <ul style="margin: 0; padding-left: 20px; color: #475569;">
                <li style="margin-bottom: 8px;">Service fees and payment terms</li>
                <li style="margin-bottom: 8px;">Scope of work and deliverables</li>
                <li style="margin-bottom: 8px;">Confidentiality provisions</li>
                <li style="margin-bottom: 8px;">Engagement timeline and milestones</li>
              </ul>
            </div>
            
            <p style="margin-bottom: 20px;">Please review the attached agreement carefully. If you have any questions or concerns, please don't hesitate to reach out to me directly.</p>
            
            <div style="background-color: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #1e40af; font-weight: 600;">📋 Next Steps</p>
              <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px;">Once you're comfortable with the terms, please sign and return the agreement at your earliest convenience.</p>
            </div>
            
            <p style="margin-bottom: 30px;">Thank you for your trust in our services. I look forward to working with you.</p>
            
            <p style="margin-bottom: 20px; font-weight: 500;">Best regards,</p>
            
            ${adminSignature}
          </div>
        </div>`
      : `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto;">
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
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
          size: Math.round(a.content.length * 0.75) + ' bytes'
        })));
      } else {
        console.error(`❌ No valid attachments processed from ${attachments.length} input attachment(s)`);
      }
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