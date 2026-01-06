import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Scheduled job that syncs any missing profiles from auth.users.raw_user_meta_data
 * This is a safety net in case the database trigger fails to create a profile
 * 
 * Run via cron: daily or hourly depending on volume
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting sync-missing-profiles job...');
    
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

    // Find auth users without profiles
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });

    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw authError;
    }

    console.log(`📊 Found ${authUsers.users.length} total auth users`);

    // Get all existing profile IDs
    const { data: existingProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const existingProfileIds = new Set(existingProfiles?.map(p => p.id) || []);
    console.log(`📊 Found ${existingProfileIds.size} existing profiles`);

    // Find users without profiles
    const orphanedUsers = authUsers.users.filter(u => !existingProfileIds.has(u.id));
    console.log(`⚠️ Found ${orphanedUsers.length} auth users without profiles`);

    let createdCount = 0;
    let errorCount = 0;

    // Helper to safely parse arrays from metadata
    const parseArray = (val: unknown): unknown[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.startsWith('[')) {
        try { return JSON.parse(val); } catch { return []; }
      }
      return [];
    };

    // Create missing profiles
    for (const user of orphanedUsers) {
      const meta = user.user_metadata || {};
      
      try {
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email || '',
            first_name: meta.first_name || meta.firstName || 'Unknown',
            last_name: meta.last_name || meta.lastName || 'User',
            company: meta.company || '',
            buyer_type: meta.buyer_type || meta.buyerType || 'individual',
            website: meta.website || '',
            linkedin_profile: meta.linkedin_profile || meta.linkedinProfile || '',
            phone_number: meta.phone_number || meta.phoneNumber || '',
            job_title: meta.job_title || meta.jobTitle || '',
            // Key arrays from signup
            business_categories: parseArray(meta.business_categories || meta.businessCategories),
            target_locations: parseArray(meta.target_locations || meta.targetLocations),
            investment_size: parseArray(meta.investment_size || meta.investmentSize),
            geographic_focus: parseArray(meta.geographic_focus || meta.geographicFocus),
            industry_expertise: parseArray(meta.industry_expertise || meta.industryExpertise),
            deal_sourcing_methods: parseArray(meta.deal_sourcing_methods || meta.dealSourcingMethods),
            // Step 3 fields
            referral_source: meta.referral_source || meta.referralSource || null,
            referral_source_detail: meta.referral_source_detail || meta.referralSourceDetail || null,
            target_acquisition_volume: meta.target_acquisition_volume || meta.targetAcquisitionVolume || null,
            // String fields
            ideal_target_description: meta.ideal_target_description || meta.idealTargetDescription || '',
            revenue_range_min: meta.revenue_range_min || meta.revenueRangeMin || '',
            revenue_range_max: meta.revenue_range_max || meta.revenueRangeMax || '',
            approval_status: 'pending',
            email_verified: !!user.email_confirmed_at,
          }, { onConflict: 'id' });

        if (insertError) {
          console.error(`Failed to create profile for ${user.email}:`, insertError);
          errorCount++;
        } else {
          console.log(`✅ Created profile for ${user.email}`);
          createdCount++;
        }
      } catch (err) {
        console.error(`Exception creating profile for ${user.email}:`, err);
        errorCount++;
      }
    }

    // Also check for profiles with missing Step 3 fields that have data in auth metadata
    const { data: profilesWithMissingFields, error: missingError } = await supabaseAdmin
      .from('profiles')
      .select('id, referral_source, deal_sourcing_methods, target_acquisition_volume')
      .is('referral_source', null);

    if (!missingError && profilesWithMissingFields) {
      console.log(`📊 Found ${profilesWithMissingFields.length} profiles with potentially missing Step 3 fields`);
      
      let updatedCount = 0;
      
      for (const profile of profilesWithMissingFields) {
        // Get the auth user for this profile
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        
        if (userError || !userData.user) continue;
        
        const meta = userData.user.user_metadata || {};
        const referralSource = meta.referral_source || meta.referralSource;
        
        // Only update if auth metadata has a value
        if (referralSource) {
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              referral_source: meta.referral_source || meta.referralSource || null,
              referral_source_detail: meta.referral_source_detail || meta.referralSourceDetail || null,
              deal_sourcing_methods: parseArray(meta.deal_sourcing_methods || meta.dealSourcingMethods),
              target_acquisition_volume: meta.target_acquisition_volume || meta.targetAcquisitionVolume || null,
            })
            .eq('id', profile.id);

          if (!updateError) {
            console.log(`✅ Updated Step 3 fields for profile ${profile.id}`);
            updatedCount++;
          }
        }
      }
      
      console.log(`📊 Updated ${updatedCount} profiles with Step 3 fields from auth metadata`);
    }

    const result = {
      success: true,
      orphanedUsersFound: orphanedUsers.length,
      profilesCreated: createdCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Sync job completed:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in sync-missing-profiles function:', error);
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
