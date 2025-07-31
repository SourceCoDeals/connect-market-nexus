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
    type: string;
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
    
    // Create admin-specific signature
    const adminSignature = adminName && adminEmail 
      ? `Best regards,<br><strong>${adminName}</strong><br>SourceCo<br>${adminEmail}`
      : "Best regards,<br><strong>SourceCo Team</strong>";

    const defaultTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          Deal Fee Agreement
        </h1>
        
        <p>Dear Valued Client,</p>
        
        <p>Thank you for your interest in our business listings platform. To proceed with connecting you to listing owners, we require a signed fee agreement.</p>
        
        <p>Please review and sign the attached fee agreement at your earliest convenience. This agreement outlines our commission structure and terms of service for facilitating business acquisitions.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Key Points:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Our commission is only paid upon successful transaction completion</li>
            <li>No upfront fees or costs</li>
            <li>Professional representation throughout the process</li>
            <li>Access to vetted, quality business opportunities</li>
          </ul>
        </div>
        
        <p>Once signed, you'll have immediate access to connect with business owners and begin your acquisition journey.</p>
        
        <p>If you have any questions about the agreement or our services, please don't hesitate to reach out.</p>
        
        <p>${adminSignature}</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #666;">
          Please reply to this email with your signed agreement or any questions you may have.
        </p>
      </div>`;

    // Format email content
    const emailContent = content 
      ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
           ${content.replace(/\n/g, '<br>')}
           <br><br>
           <p>${adminSignature}</p>
         </div>`
      : defaultTemplate;

    // Prepare Brevo email payload
    const brevoPayload: any = {
      sender: {
        name: `${adminName} - SourceCo`,
        email: "noreply@sourcecodeals.com"
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

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      console.log(`📎 Processing ${attachments.length} attachment(s)`);
      
      // Validate and process attachments
      const processedAttachments = [];
      for (const att of attachments) {
        if (!att.name || !att.content) {
          console.warn("⚠️ Skipping invalid attachment:", att.name || "unnamed");
          continue;
        }
        
        // Ensure content is properly base64 encoded
        let content = att.content;
        if (!content.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
          console.warn("⚠️ Attachment content doesn't appear to be base64, skipping:", att.name);
          continue;
        }
        
        processedAttachments.push({
          name: att.name,
          content: content
        });
        
        console.log(`✅ Processed attachment: ${att.name} (${Math.round(content.length * 0.75)} bytes)`);
      }
      
      if (processedAttachments.length > 0) {
        brevoPayload.attachment = processedAttachments;
        console.log(`📎 Added ${processedAttachments.length} valid attachment(s) to email`);
      } else {
        console.warn("⚠️ No valid attachments to include");
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
      
      // Provide more specific error messages
      if (emailResponse.status === 400) {
        throw new Error(`Email validation error: ${errorData}`);
      } else if (emailResponse.status === 401) {
        throw new Error("Email service authentication failed. Please contact support.");
      } else if (emailResponse.status === 402) {
        throw new Error("Email service quota exceeded. Please contact support.");
      } else {
        throw new Error(`Email service error (${emailResponse.status}): ${errorData}`);
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