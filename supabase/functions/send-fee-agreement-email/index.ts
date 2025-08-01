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

    // Get admin profile for enhanced signature
    const adminProfile = adminEmail ? ADMIN_PROFILES[adminEmail] : null;
    const effectiveAdminName = adminProfile?.name || adminName || 'SourceCo Team';
    const adminTitle = adminProfile?.title || '';
    const adminPhone = adminProfile?.phone || '';
    const adminCalendly = adminProfile?.calendlyUrl || '';

    // Use custom content if provided, otherwise use default template
    const emailSubject = subject || "SourceCo - Fee Agreement";
    
    // Skip logo entirely for fast, reliable emails
    console.log('📧 Using text-only signature without logo for immediate delivery');
    
    // Create minimal premium signature - investment grade design
    const adminSignature = `
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #E5E5E5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="color: #000000; line-height: 1.4;">
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">${effectiveAdminName}</div>
          ${adminTitle ? `<div style="font-size: 14px; color: #666666; margin-bottom: 12px;">${adminTitle}</div>` : ''}
          
          <div style="font-size: 14px; color: #333333; margin-bottom: 2px;">
            <a href="mailto:${adminEmail}" style="color: #000000; text-decoration: none;">${adminEmail}</a>
          </div>
          ${adminPhone ? `<div style="font-size: 14px; color: #666666; margin-bottom: 2px;">${adminPhone}</div>` : ''}
          
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #F0F0F0; font-size: 12px; color: #888888;">
            This communication is confidential and may be legally privileged.
          </div>
        </div>
      </div>`;

    // ENHANCED: Generate multiple premium email templates
    const templateVariants = {
      standard: `<div style="font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.7; color: #333333; max-width: 700px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 50px 40px; background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%); border: 1px solid #E5E5E5;">
            <div style="text-align: center; margin-bottom: 50px; padding-bottom: 30px; border-bottom: 3px solid #D4AF37;">
              <h1 style="color: #000000; font-size: 32px; margin: 0; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Fee Agreement</h1>
              <p style="color: #666666; margin: 15px 0 0 0; font-size: 16px; letter-spacing: 3px; text-transform: uppercase;">SourceCo</p>
            </div>
            
            <div style="margin-bottom: 40px;">
              <p style="margin-bottom: 30px; font-size: 18px; color: #333333;">Dear <strong style="color: #D4AF37; font-weight: 700;">${userEmail.split('@')[0]}</strong>,</p>
              
              <p style="margin-bottom: 30px; font-size: 16px; line-height: 1.8;">We are pleased to present our comprehensive Fee Agreement for your review and execution. This document establishes the framework for our professional advisory relationship and outlines the terms that will govern our collaboration.</p>
              
              <div style="background: linear-gradient(135deg, #F8F8F8 0%, #F0F0F0 100%); padding: 35px; margin: 40px 0; border-left: 6px solid #D4AF37; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 0 8px 8px 0;">
                <p style="margin: 0 0 25px 0; font-weight: 700; color: #000000; font-size: 18px; letter-spacing: 0.5px;">Key Agreement Elements:</p>
                <ul style="margin: 0; padding-left: 0; list-style: none; color: #444444; font-size: 15px; line-height: 1.8;">
                  <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #D4AF37; font-weight: 700;">✓</span>
                    Professional advisory fees and transparent payment structure
                  </li>
                  <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #D4AF37; font-weight: 700;">✓</span>
                    Comprehensive scope of services and specific deliverables
                  </li>
                  <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #D4AF37; font-weight: 700;">✓</span>
                    Strict confidentiality and non-disclosure provisions
                  </li>
                  <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #D4AF37; font-weight: 700;">✓</span>
                    Project timeline, milestones, and success metrics
                  </li>
                  <li style="margin-bottom: 0; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #D4AF37; font-weight: 700;">✓</span>
                    Exclusive representation and fiduciary obligations
                  </li>
                </ul>
              </div>
              
              <p style="margin-bottom: 30px; font-size: 16px; line-height: 1.8;">We encourage you to carefully review all terms and conditions. Our team remains readily available to address any questions or discuss specific provisions that may require clarification or modification.</p>
              
              <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); color: #ffffff; padding: 35px; margin: 40px 0; text-align: center; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.15);">
                <p style="margin: 0; color: #D4AF37; font-weight: 700; font-size: 16px; letter-spacing: 2px; text-transform: uppercase;">Next Steps</p>
                <p style="margin: 20px 0 0 0; color: #ffffff; font-size: 15px; line-height: 1.6;">Upon your acceptance of these terms, please execute and return the agreement to formalize our engagement and begin the collaboration process.</p>
              </div>
              
              <p style="margin-bottom: 40px; font-size: 16px; line-height: 1.8;">We genuinely appreciate the opportunity to serve as your trusted advisor and look forward to a successful and mutually beneficial collaboration.</p>
              
              <p style="margin-bottom: 30px; font-weight: 600; font-size: 16px;">Respectfully yours,</p>
            </div>
            
            ${adminSignature}
          </div>
        </div>`,
      
      executive: `<div style="font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.8; color: #333333; max-width: 750px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 60px 50px; background: linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%); border: 2px solid #D4AF37; box-shadow: 0 8px 30px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 60px; padding-bottom: 40px; border-bottom: 4px solid #D4AF37;">
              <h1 style="color: #000000; font-size: 36px; margin: 0; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">Executive Fee Agreement</h1>
              <p style="color: #666666; margin: 20px 0 0 0; font-size: 18px; letter-spacing: 4px; text-transform: uppercase; font-weight: 500;">SourceCo</p>
            </div>
            
            <div style="margin-bottom: 50px;">
              <p style="margin-bottom: 35px; font-size: 20px; color: #333333;">Dear <strong style="color: #D4AF37; font-weight: 800;">${userEmail.split('@')[0]}</strong>,</p>
              
              <p style="margin-bottom: 35px; font-size: 17px; line-height: 1.9;">We are honored to present our Executive Fee Agreement, meticulously crafted for high-value strategic engagements. This comprehensive document establishes the premium framework for our exclusive advisory partnership.</p>
              
              <div style="background: linear-gradient(135deg, #F5F5F5 0%, #EEEEEE 100%); padding: 45px; margin: 50px 0; border: 2px solid #D4AF37; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.12);">
                <p style="margin: 0 0 30px 0; font-weight: 800; color: #000000; font-size: 20px; letter-spacing: 1px; text-align: center;">Premium Service Framework</p>
                <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                  <div style="flex: 1; min-width: 250px; background: #ffffff; padding: 25px; border-left: 4px solid #D4AF37; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 15px 0; color: #D4AF37; font-size: 16px; font-weight: 700;">Strategic Advisory</h4>
                    <p style="margin: 0; color: #444444; font-size: 14px; line-height: 1.6;">Comprehensive strategic planning and execution guidance</p>
                  </div>
                  <div style="flex: 1; min-width: 250px; background: #ffffff; padding: 25px; border-left: 4px solid #D4AF37; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 15px 0; color: #D4AF37; font-size: 16px; font-weight: 700;">Exclusive Access</h4>
                    <p style="margin: 0; color: #444444; font-size: 14px; line-height: 1.6;">Priority access to premium deal flow and opportunities</p>
                  </div>
                </div>
              </div>
              
              <p style="margin-bottom: 35px; font-size: 17px; line-height: 1.9;">This agreement reflects our commitment to delivering exceptional value through personalized service, strategic insight, and unwavering dedication to your success.</p>
              
              <div style="background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%); color: #000000; padding: 40px; margin: 50px 0; text-align: center; border-radius: 12px; box-shadow: 0 8px 25px rgba(212,175,55,0.3);">
                <p style="margin: 0; color: #000000; font-weight: 800; font-size: 18px; letter-spacing: 2px; text-transform: uppercase;">Executive Priority Processing</p>
                <p style="margin: 25px 0 0 0; color: #000000; font-size: 16px; line-height: 1.7; font-weight: 500;">Your agreement will receive expedited review and processing within 24 hours of execution.</p>
              </div>
              
              <p style="margin-bottom: 45px; font-size: 17px; line-height: 1.9;">We are privileged to partner with you and remain committed to exceeding your expectations at every stage of our collaboration.</p>
              
              <p style="margin-bottom: 35px; font-weight: 700; font-size: 17px;">With distinguished regards,</p>
            </div>
            
            ${adminSignature}
          </div>
        </div>`
    };

    const emailContent = useTemplate
      ? templateVariants.standard
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