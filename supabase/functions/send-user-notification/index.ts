
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📧 Email notification request received:', req.method)
    
    const { type, userEmail, firstName, lastName, reason } = await req.json()
    console.log('📧 Email data:', { type, userEmail, firstName, lastName })

    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoApiKey) {
      console.error('❌ BREVO_API_KEY is not set')
      throw new Error('BREVO_API_KEY is not set')
    }

    let subject: string
    let htmlContent: string
    const siteUrl = Deno.env.get('SITE_URL') || 'https://vhzipqarkmmfuqadefep.supabase.co'

    switch (type) {
      case 'approved':
        subject = 'Welcome to SourceCo - Your Account is Approved'
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Approved - SourceCo</title>
          </head>
          <body style="font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.6; color: #000000; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff;">
            <div style="background: #000000; padding: 40px 30px; text-align: center;">
              <h1 style="color: #D4AF37; margin: 0; font-size: 32px; font-weight: 400; letter-spacing: 1px;">Welcome to SourceCo</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your gateway to exclusive business opportunities</p>
            </div>
            
            <div style="background: #ffffff; padding: 40px 30px;">
              <h2 style="color: #000000; margin-top: 0; font-size: 24px; font-weight: 400;">Congratulations, ${firstName}</h2>
              
              <p style="font-size: 16px; margin-bottom: 25px; color: #333333; line-height: 1.7;">
                Your account has been approved by our team. You now have exclusive access to our curated marketplace of off-market business opportunities.
              </p>
              
              <div style="background: #f8f8f8; border-left: 4px solid #D4AF37; padding: 25px; margin: 30px 0;">
                <h3 style="margin-top: 0; color: #000000; font-size: 18px; font-weight: 400;">Your exclusive access includes:</h3>
                <ul style="margin: 15px 0 0 0; padding-left: 25px; color: #333333;">
                  <li style="margin-bottom: 12px; line-height: 1.6;">Access to 50+ pre-vetted, founder-led targets ready to transact</li>
                  <li style="margin-bottom: 12px; line-height: 1.6;">Request direct connections with business owners</li>
                  <li style="margin-bottom: 12px; line-height: 1.6;">Review detailed financial information and business metrics</li>
                  <li style="margin-bottom: 12px; line-height: 1.6;">Save and track opportunities of interest</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="${siteUrl}/login" 
                   style="background: #D4AF37; color: #000000; padding: 16px 32px; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 16px; display: inline-block; letter-spacing: 0.5px; transition: all 0.3s ease;">
                  Access Your Account
                </a>
              </div>
              
              <div style="border-top: 1px solid #e0e0e0; padding-top: 25px; margin-top: 40px;">
                <h4 style="color: #000000; margin-bottom: 15px; font-size: 16px; font-weight: 400;">Account Information:</h4>
                 <div style="background: #f8f8f8; padding: 20px; border-radius: 4px; font-size: 14px; color: #333333;">
                   <strong>Email:</strong> ${userEmail}<br>
                   <strong>Name:</strong> ${firstName} ${lastName}
                 </div>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666666; line-height: 1.6;">
                For questions or assistance, please contact our team. We're here to help you navigate these exclusive opportunities.
              </p>
              
              <div style="text-align: center; margin-top: 40px; padding-top: 25px; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; font-size: 14px; color: #666666;">
                  Best regards,<br>
                  <strong style="color: #000000;">The SourceCo Team</strong>
                </p>
              </div>
            </div>
          </body>
          </html>
        `
        break
        
      case 'rejected':
        subject = 'SourceCodeals Account Update'
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Update - SourceCodeals</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc3545; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Account Update</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Hello ${firstName},</h2>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Thank you for your interest in SourceCodeals. After reviewing your application, we're unable to approve your account at this time.
              </p>
              
              ${reason ? `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                  <h3 style="margin-top: 0; color: #495057;">Reason:</h3>
                  <p style="margin: 0;">${reason}</p>
                </div>
              ` : ''}
              
              <p style="margin-top: 25px; font-size: 14px; color: #6c757d;">
                If you believe this decision was made in error or if you have additional information to provide, please contact our support team.
              </p>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9;">
                <p style="margin: 0; font-size: 14px; color: #6c757d;">
                  <strong>The SourceCodeals Team</strong>
                </p>
              </div>
            </div>
          </body>
          </html>
        `
        break
        
      case 'test':
        subject = 'SourceCodeals Email Test'
        htmlContent = `
          <h1>Email Test Successful</h1>
          <p>This is a test email to verify the email delivery system is working.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `
        break
        
      default:
        throw new Error('Invalid notification type')
    }

    console.log('📧 Sending email via Brevo API...')
    
    const emailPayload = {
      sender: {
        name: "SourceCo Marketplace",
        email: "adam.haile@sourcecodeals.com"
      },
      to: [{ email: userEmail, name: firstName }],
      subject: subject,
      htmlContent: htmlContent,
      replyTo: {
        email: "adam.haile@sourcecodeals.com",
        name: "Adam Haile"
      }
    }
    
    console.log('📧 Email payload:', { ...emailPayload, htmlContent: '[HTML_CONTENT]' })

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify(emailPayload),
    })

    const responseText = await res.text()
    console.log('📧 Brevo API response status:', res.status)
    console.log('📧 Brevo API response:', responseText)

    if (!res.ok) {
      console.error('❌ Brevo API error:', responseText)
      throw new Error(`Failed to send email: ${res.status} ${responseText}`)
    }

    const data = JSON.parse(responseText)
    console.log('✅ Email sent successfully:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('💥 Error in send-user-notification function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
