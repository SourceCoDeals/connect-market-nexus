
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

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY environment variable is not set");
    }

    let subject: string
    let htmlContent: string
    let textContent: string

    switch (type) {
      case 'approval':
        subject = '✅ Your account has been approved!'
        htmlContent = `
          <h1>Welcome, ${user.first_name}!</h1>
          <p>Great news! Your account has been approved and you now have access to our marketplace.</p>
          <p><strong>Your account details:</strong></p>
          <ul>
            <li>Name: ${user.first_name} ${user.last_name}</li>
            <li>Email: ${user.email}</li>
            <li>Company: ${user.company || 'Not specified'}</li>
          </ul>
          <p>You can now browse and connect with business opportunities.</p>
          <p><a href="https://market.sourcecodeals.com/marketplace" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Access Marketplace</a></p>
          <p>Welcome aboard!</p>
          <p>— The SourceCo Team</p>
        `
        textContent = `Welcome, ${user.first_name}!\n\nGreat news! Your account has been approved and you now have access to our marketplace.\n\nYour account details:\n- Name: ${user.first_name} ${user.last_name}\n- Email: ${user.email}\n- Company: ${user.company || 'Not specified'}\n\nYou can now browse and connect with business opportunities.\n\nAccess the marketplace: https://market.sourcecodeals.com/marketplace\n\nWelcome aboard!\n\n— The SourceCo Team`
        break
        
      case 'rejection':
        subject = '❌ Account Application Update'
        htmlContent = `
          <h1>Hi ${user.first_name},</h1>
          <p>Thank you for your interest in our marketplace.</p>
          <p>After careful review, we are unable to approve your account at this time.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>If you have any questions or would like to discuss this further, please reply to this email.</p>
          <p>— The SourceCo Team</p>
        `
        textContent = `Hi ${user.first_name},\n\nThank you for your interest in our marketplace.\n\nAfter careful review, we are unable to approve your account at this time.\n\n${reason ? `Reason: ${reason}\n\n` : ''}If you have any questions or would like to discuss this further, please reply to this email.\n\n— The SourceCo Team`
        break
        
      default:
        throw new Error('Invalid notification type')
    }

    console.log('Preparing to send email with Brevo...')
    
    const brevoPayload = {
      sender: {
        name: "SourceCo Marketplace",
        email: "noreply@sourcecodeals.com"
      },
      to: [{ email: user.email, name: `${user.first_name} ${user.last_name}` }],
      subject,
      htmlContent,
      textContent,
      replyTo: {
        email: "support@sourcecodeals.com",
        name: "SourceCo Support"
      }
    };

    console.log('Brevo email payload:', JSON.stringify(brevoPayload, null, 2))

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(brevoPayload)
    });

    if (!res.ok) {
      const errorText = await res.text()
      console.error("Error sending email via Brevo:", errorText);
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
