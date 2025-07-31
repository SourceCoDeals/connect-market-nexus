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

    console.log(`📧 Sending fee agreement email to: ${userEmail} for user: ${userId}`, { 
      useTemplate, 
      subject, 
      adminEmail, 
      adminName,
      attachmentCount: attachments?.length || 0 
    });

    // Get Brevo API key
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY environment variable is not set");
    }

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
        name: adminName ? `${adminName} - SourceCo` : "SourceCo",
        email: adminEmail || "noreply@sourcecodeals.com"
      },
      to: [
        {
          email: userEmail,
          name: userEmail
        }
      ],
      subject: emailSubject,
      htmlContent: emailContent
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      brevoPayload.attachment = attachments.map(att => ({
        name: att.name,
        content: att.content
      }));
    }

    console.log('📬 Sending fee agreement email via Brevo...', {
      to: userEmail,
      from: brevoPayload.sender,
      subject: emailSubject,
      attachmentCount: attachments?.length || 0
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

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("❌ Brevo API error response:", errorData);
      console.error("❌ Brevo API status:", emailResponse.status, emailResponse.statusText);
      throw new Error(`Failed to send email via Brevo: ${emailResponse.statusText} - ${errorData}`);
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