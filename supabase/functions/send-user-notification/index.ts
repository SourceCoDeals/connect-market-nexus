
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    console.log('Received request body:', requestBody)
    
    // Handle both old and new payload formats for backward compatibility
    let user, type, reason
    if (requestBody.user && requestBody.type) {
      // Old format
      user = requestBody.user
      type = requestBody.type
      reason = requestBody.reason
    } else {
      // New format from use-admin-email.ts
      const { userEmail, firstName, lastName, type: requestType, reason: requestReason } = requestBody
      user = {
        email: userEmail,
        first_name: firstName,
        last_name: lastName
      }
      type = requestType === 'approved' ? 'approval' : requestType === 'rejected' ? 'rejection' : requestType
      reason = requestReason
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not set')
    }

    let subject: string
    let htmlContent: string

    switch (type) {
      case 'approval':
        subject = '🎉 Welcome to SourceCodeals - Your Account is Approved!'
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Approved - SourceCodeals</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to SourceCodeals!</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Great news, ${user.first_name}!</h2>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Your account has been approved by our admin team. You now have full access to our marketplace of business opportunities.
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin-top: 0; color: #495057;">What you can do now:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">📈 Browse thousands of business listings</li>
                  <li style="margin-bottom: 8px;">💼 Save interesting opportunities to your favorites</li>
                  <li style="margin-bottom: 8px;">🤝 Request connections with business owners</li>
                  <li style="margin-bottom: 8px;">📊 Access detailed financial information</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://vhzipqarkmmfuqadefep.supabase.co'}/login" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: transform 0.2s;">
                  🚀 Start Exploring Now
                </a>
              </div>
              
              <div style="border-top: 1px solid #e1e5e9; padding-top: 20px; margin-top: 30px;">
                <h4 style="color: #495057; margin-bottom: 15px;">Your Account Details:</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; font-size: 14px;">
                  <strong>Email:</strong> ${user.email}<br>
                  <strong>Company:</strong> ${user.company || 'Not specified'}<br>
                  <strong>Buyer Type:</strong> ${user.buyer_type || 'Not specified'}
                </div>
              </div>
              
              <p style="margin-top: 25px; font-size: 14px; color: #6c757d;">
                If you have any questions or need assistance getting started, don't hesitate to reach out to our support team.
              </p>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9;">
                <p style="margin: 0; font-size: 14px; color: #6c757d;">
                  Welcome to the SourceCodeals community!<br>
                  <strong>The SourceCodeals Team</strong>
                </p>
              </div>
            </div>
          </body>
          </html>
        `
        break
        
      case 'rejection':
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
              <h2 style="color: #333; margin-top: 0;">Hello ${user.first_name},</h2>
              
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
        
      default:
        throw new Error('Invalid notification type')
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'SourceCodeals <noreply@sourcecodeals.com>',
        to: [user.email],
        subject: subject,
        html: htmlContent,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Resend API error:', errorText)
      throw new Error(`Failed to send email: ${res.status} ${errorText}`)
    }

    const data = await res.json()
    console.log('Email sent successfully:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in send-user-notification function:', error)
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
