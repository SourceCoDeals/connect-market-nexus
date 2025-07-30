import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FeeAgreementEmailRequest {
  userId: string;
  userEmail: string;
  adminNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userEmail, adminNotes }: FeeAgreementEmailRequest = await req.json();

    console.log(`📧 Sending fee agreement email to: ${userEmail} for user: ${userId}`);

    const emailResponse = await resend.emails.send({
      from: "Business Marketplace <noreply@resend.dev>",
      to: [userEmail],
      subject: "Fee Agreement Required - Business Marketplace",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            Fee Agreement Required
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
          
          <p>Best regards,<br>
          <strong>The Business Marketplace Team</strong></p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #666;">
            Please reply to this email with your signed agreement or any questions you may have.
          </p>
          
          ${adminNotes ? `
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <strong>Admin Note:</strong> ${adminNotes}
          </div>
          ` : ''}
        </div>
      `,
    });

    console.log("✅ Fee agreement email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
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