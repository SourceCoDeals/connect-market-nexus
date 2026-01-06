import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  phoneNumber?: string;
  buyerType: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse request body
    const { email, firstName, lastName, company, phoneNumber, buyerType }: CreateUserRequest = await req.json()

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        company,
        phone_number: phoneNumber,
        source: 'inbound_lead_conversion'
      }
    })

    if (authError) {
      console.error('Auth user creation error:', authError)
      throw authError
    }

    console.log('Created auth user:', authUser.user.id)

    // Create profile using upsert to handle potential conflicts with trigger
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        company: company || '',
        phone_number: phoneNumber || '',
        buyer_type: buyerType,
        website: '',
        linkedin_profile: '',
        approval_status: 'approved'
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      throw profileError
    }

    console.log('Created profile for user:', authUser.user.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authUser.user.id 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in create-lead-user function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})