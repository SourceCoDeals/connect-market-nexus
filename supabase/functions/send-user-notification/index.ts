
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserNotificationRequest {
  type: 'approved' | 'rejected';
  userEmail: string;
  firstName: string;
  lastName: string;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('🔔 User notification function called');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('📧 Request body:', requestBody);
    
    const payload: UserNotificationRequest = JSON.parse(requestBody);
    const { type, userEmail, firstName, lastName, reason } = payload;

    console.log('📨 Processing notification:', { type, userEmail, firstName });

    let subject: string;
    let htmlContent: string;

    if (type === 'approved') {
      subject = "🎉 Welcome! Your account has been approved";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #059669; text-align: center;">Account Approved! 🎉</h1>
          
          <p style="font-size: 16px;">Hello ${firstName},</p>
          
          <p style="font-size: 16px;">Great news! Your account has been approved and you now have full access to our marketplace.</p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #059669; margin-top: 0;">🚀 You can now:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li style="margin: 8px 0;">Browse hundreds of business listings</li>
              <li style="margin: 8px 0;">Save opportunities for later review</li>
              <li style="margin: 8px 0;">Request connections with sellers</li>
              <li style="margin: 8px 0;">Access detailed business information</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://marketplace.sourcecodeals.com/login" 
               style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
              Log In to Marketplace
            </a>
          </div>
          
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              <strong>Next Steps:</strong> Log in with your email and password to start exploring business opportunities that match your investment criteria.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions or need assistance, please don't hesitate to contact our support team at support@sourcecodeals.com.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This email was sent to ${userEmail}. If you didn't expect this email, please contact support.
          </p>
        </div>
      `;
    } else if (type === 'rejected') {
      subject = "Update on your account application";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626;">Account Application Update</h1>
          
          <p style="font-size: 16px;">Hello ${firstName},</p>
          
          <p style="font-size: 16px;">Thank you for your interest in our marketplace. After careful review, we're unable to approve your account at this time.</p>
          
          ${reason ? `
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <h3 style="color: #dc2626; margin-top: 0;">Reason:</h3>
              <p style="margin: 0;">${reason}</p>
            </div>
          ` : ''}
          
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">What can you do?</h3>
            <ul style="margin: 0;">
              <li>Review our eligibility requirements</li>
              <li>Update your application with additional information</li>
              <li>Contact our support team for guidance</li>
              <li>Reapply once you meet the criteria</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            We appreciate your understanding and encourage you to reach out if you have any questions about the application process.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px;">
            This email was sent to ${userEmail}. If you didn't expect this email, please contact support.
          </p>
        </div>
      `;
    } else {
      throw new Error(`Invalid notification type: ${type}`);
    }

    console.log('📤 Sending email via Brevo...');
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': Deno.env.get('BREVO_API_KEY') || '',
      },
      body: JSON.stringify({
        sender: {
          name: "SourceCo Marketplace",
          email: "noreply@sourcecodeals.com"
        },
        to: [{
          email: userEmail,
          name: `${firstName} ${lastName}`
        }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("❌ Brevo API error:", errorData);
      throw new Error(`Brevo API error: ${errorData.message || 'Unknown error'}`);
    }

    const responseData = await emailResponse.json();
    console.log("✅ Email sent successfully:", responseData);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${type} email sent successfully`,
        messageId: responseData.messageId,
        emailProvider: 'brevo'
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-user-notification function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred',
        details: error.stack
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
