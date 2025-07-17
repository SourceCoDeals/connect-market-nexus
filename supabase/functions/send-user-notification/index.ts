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
  
  // Handle CORS preflight requests
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
      subject = "Welcome! Your account has been approved";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #059669;">Account Approved! 🎉</h1>
          
          <p>Hello ${firstName},</p>
          
          <p>Great news! Your account has been approved and you now have full access to our marketplace.</p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #059669; margin-top: 0;">What's next?</h3>
            <ul style="margin: 0;">
              <li>Browse available business listings</li>
              <li>Save interesting opportunities</li>
              <li>Request connections with sellers</li>
              <li>Complete your profile for better matches</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="${Deno.env.get('SUPABASE_URL')?.replace('//', '//').replace('supabase.co', 'supabase.co')}" 
               style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Access Marketplace
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions, please don't hesitate to contact our support team.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px;">
            This email was sent to ${userEmail}. If you didn't expect this email, please contact support.
          </p>
        </div>
      `;
    } else if (type === 'rejected') {
      subject = "Update on your account application";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Account Application Update</h1>
          
          <p>Hello ${firstName},</p>
          
          <p>Thank you for your interest in our marketplace. After careful review, we're unable to approve your account at this time.</p>
          
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
          name: "Marketplace",
          email: "noreply@yourdomain.com" // Update this to your verified domain
        },
        to: [{
          email: userEmail,
          name: `${firstName} ${lastName}`
        }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const responseData = await emailResponse.json();
    console.log("✅ Email sent successfully:", responseData);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${type} email sent successfully`,
        messageId: responseData.messageId
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