
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactResponseData {
  to: string;
  subject: string;
  content: string;
  feedbackId: string;
  userName?: string;
  category?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, content, feedbackId, userName, category }: ContactResponseData = await req.json();
    
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY not configured');
    }

    // Create email content based on category
    let emailHtml = '';
    let emailSubject = subject;

    if (category === 'contact') {
      emailSubject = `Thank you for contacting us${userName ? `, ${userName}` : ''}`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h1 style="color: #333; margin: 0;">Thank You for Contacting Us!</h1>
          </div>
          
          <div style="padding: 30px; background-color: white;">
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Hello${userName ? ` ${userName}` : ''},
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Thank you for reaching out to us! We have received your message and our team will get back to you within 24 hours.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Your Message:</h3>
              <p style="margin: 0; color: #666; font-style: italic;">${content}</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              In the meantime, feel free to explore our marketplace and discover great business opportunities.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Best regards,<br>
              <strong>The SourcecodeAls Team</strong>
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 14px; color: #666;">
            <p style="margin: 0;">This is an automated response. Please do not reply to this email.</p>
          </div>
        </div>
      `;
    } else {
      // For other categories (bug, feature, etc.)
      emailSubject = `Thank you for your feedback${userName ? `, ${userName}` : ''}`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h1 style="color: #333; margin: 0;">Thank You for Your Feedback!</h1>
          </div>
          
          <div style="padding: 30px; background-color: white;">
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Hello${userName ? ` ${userName}` : ''},
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Thank you for your valuable feedback! Your ${category || 'feedback'} has been received and is being reviewed by our team.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Your ${category || 'feedback'}:</h3>
              <p style="margin: 0; color: #666; font-style: italic;">${content}</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              We take all feedback seriously and use it to improve our platform. If your feedback requires a response, we'll get back to you soon.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333;">
              Best regards,<br>
              <strong>The SourcecodeAls Team</strong>
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; text-center; font-size: 14px; color: #666;">
            <p style="margin: 0;">This is an automated response. Please do not reply to this email.</p>
          </div>
        </div>
      `;
    }

    // Send email using Brevo API
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify({
        to: [{ email: to }],
        sender: { 
          email: 'noreply@sourcecodeals.com', 
          name: 'SourcecodeAls Team' 
        },
        subject: emailSubject,
        htmlContent: emailHtml,
        tags: ['contact-response', category || 'feedback'],
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Brevo API error:', errorData);
      throw new Error(`Failed to send email: ${emailResponse.statusText}`);
    }

    const result = await emailResponse.json();
    console.log('Email sent successfully via Brevo:', result);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: result.messageId,
      feedbackId 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-contact-response function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
});
