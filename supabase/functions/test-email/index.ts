
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
    console.log('🧪 Test email endpoint called')
    
    const { email } = await req.json()
    
    if (!email) {
      throw new Error('Email is required')
    }

    console.log('🧪 Testing email delivery to:', email)

    // Call the send-user-notification function
    const notificationResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-user-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        type: 'test',
        userEmail: email,
        firstName: 'Test',
        lastName: 'User'
      })
    })

    const notificationResult = await notificationResponse.text()
    console.log('🧪 Notification response:', notificationResult)

    if (!notificationResponse.ok) {
      throw new Error(`Email test failed: ${notificationResult}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test email sent successfully',
        details: notificationResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('🧪 Test email error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
