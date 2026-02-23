import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

// ============================================================================
// BUYER FIT SCORE — Marketplace Buyer Quality Scoring Engine
//
// Scores buyers 0-100 across 4 components:
//   Component 1: Buyer Type        (max 40)
//   Component 2: Platform Signal   (max 30)
//   Component 3: Capital Credibility (max 20)
//   Component 4: Profile Completeness (max 10)
//
// Tiers: 1 (70-100), 2 (45-69), 3 (15-44), 4 (0-14)
// ============================================================================

// --- Configurable keyword list for platform/add-on detection ---
// Maintained here for easy updates without redeploying other code.
const PLATFORM_ADDON_KEYWORDS = [
  'add-on',
  'add on',
  'addon',
  'bolt-on',
  'bolt on',
  'bolton',
  'existing platform',
  'our platform',
  'we currently own',
  'we own a',
  'portfolio company',
  'portco',
  'platform acquisition',
  'tuck-in',
  'tuck in',
  'tuckin',
  'we are looking to add',
  'building a platform in',
  'building a platform',
  'platform strategy',
  'add-on acquisition',
  'bolt-on acquisition',
  'complementary acquisition',
  'our existing',
  'existing portfolio',
];

// --- Free email domains (capital credibility check) ---
const FREE_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
  'ymail.com',
  'live.com',
  'msn.com',
];

// --- Fund size keywords for capital credibility ---
const FUND_SIZE_KEYWORDS = [
  'fund size',
  'aum',
  'assets under management',
  'committed capital',
  'closed fund',
  'fund i',
  'fund ii',
  'fund iii',
  'fund iv',
  'fund v',
  '$m fund',
  '$b fund',
  'million fund',
  'billion fund',
  'lp',
  'limited partner',
];

// ============================================================================
// COMPONENT 1: Buyer Type Score (max 40)
// ============================================================================
function calculateBuyerTypeScore(
  profileBuyerType: string | null,
  remarketingBuyerType: string | null,
): { score: number; buyerTypeUsed: string } {
  // Use profile buyer_type, fallback to remarketing
  const buyerType = profileBuyerType || remarketingBuyerType || '';
  const normalized = buyerType.toLowerCase().replace(/[^a-z_]/g, '');

  // Map both profiles enum values and remarketing enum values
  const scoreMap: Record<string, number> = {
    // profiles table values
    privateequity: 35,
    familyoffice: 30,
    corporate: 28,
    independentsponsor: 15,
    searchfund: 10,
    advisor: 5,
    businessowner: 5,
    individual: 5,
    // remarketing_buyers table values
    pe_firm: 35,
    family_office: 30,
    strategic: 28,
    platform: 28, // Platform company = corporate-level
    independent_sponsor: 15,
    search_fund: 10,
    other: 5,
  };

  const score = scoreMap[normalized] ?? 5;
  return { score, buyerTypeUsed: buyerType || 'unknown' };
}

// ============================================================================
// COMPONENT 2: Platform / Add-On Signal (max 30)
// ============================================================================
interface PlatformSignalResult {
  score: number;
  detected: boolean;
  source: 'message' | 'profile' | null;
  keywordsMatched: string[];
}

function calculatePlatformSignal(
  dealRequestMessage: string | null,
  profileTexts: string[],
): PlatformSignalResult {
  const result: PlatformSignalResult = {
    score: 0,
    detected: false,
    source: null,
    keywordsMatched: [],
  };

  // Check deal request message first (highest priority: +30)
  if (dealRequestMessage) {
    const messageLower = dealRequestMessage.toLowerCase();
    const messageMatches = PLATFORM_ADDON_KEYWORDS.filter((kw) => messageLower.includes(kw));
    if (messageMatches.length > 0) {
      result.score = 30;
      result.detected = true;
      result.source = 'message';
      result.keywordsMatched = messageMatches;
      return result;
    }
  }

  // Check profile-level texts (+25)
  const combinedProfile = profileTexts.filter(Boolean).join(' ').toLowerCase();
  if (combinedProfile) {
    const profileMatches = PLATFORM_ADDON_KEYWORDS.filter((kw) => combinedProfile.includes(kw));
    if (profileMatches.length > 0) {
      result.score = 25;
      result.detected = true;
      result.source = 'profile';
      result.keywordsMatched = profileMatches;
      return result;
    }
  }

  return result;
}

// ============================================================================
// COMPONENT 3: Capital Credibility (max 20)
// ============================================================================
function calculateCapitalCredibility(profile: any): number {
  let score = 0;

  // 1. Professional email domain (+5)
  const email = (profile.email || '').toLowerCase();
  const emailDomain = email.split('@')[1] || '';
  if (emailDomain && !FREE_EMAIL_DOMAINS.includes(emailDomain)) {
    score += 5;
  }

  // 2. Company website provided (+3)
  const website = profile.website || profile.buyer_org_url || '';
  if (website.trim()) {
    score += 3;
  }

  // 3. Fund size or AUM mentioned (+5)
  const textsToScan = [
    profile.ideal_target_description || '',
    profile.mandate_blurb || '',
    profile.bio || '',
    profile.fund_size || '',
    profile.aum || '',
  ]
    .join(' ')
    .toLowerCase();

  const hasFundSignal = FUND_SIZE_KEYWORDS.some((kw) => textsToScan.includes(kw));
  // Also check if fund_size or aum fields have actual values
  if (hasFundSignal || profile.fund_size || profile.aum) {
    score += 5;
  }

  // 4. Active acquisition strategy (+4)
  // Check deployment_timing, corpdev_intent, or similar signals
  const activeSignals = [
    profile.deployment_timing,
    profile.corpdev_intent,
    profile.deal_intent,
  ].filter(Boolean);
  if (activeSignals.length > 0) {
    score += 4;
  }

  // 5. Multiple investment criteria specified (+3)
  const criteriaFields = [
    profile.business_categories,
    profile.target_locations,
    profile.geographic_focus,
    profile.industry_expertise,
    profile.include_keywords,
  ].filter((f) => {
    if (Array.isArray(f)) return f.length > 0;
    return f && String(f).trim() !== '';
  });
  if (criteriaFields.length >= 2) {
    score += 3;
  }

  return Math.min(20, score);
}

// ============================================================================
// COMPONENT 4: Profile Completeness (max 10)
// ============================================================================
function calculateProfileCompleteness(profile: any): number {
  let score = 0;

  // 1. Investment criteria / target description filled (+3)
  const targetDesc = profile.ideal_target_description || '';
  if (targetDesc.length > 50) {
    score += 3;
  }

  // 2. Industry/category preferences selected (+2)
  const categories = profile.business_categories;
  if (Array.isArray(categories) && categories.length > 0) {
    score += 2;
  }

  // 3. Geographic focus provided (+2)
  const geoFocus = profile.target_locations || profile.geographic_focus;
  if (
    geoFocus &&
    (Array.isArray(geoFocus) ? geoFocus.length > 0 : String(geoFocus).trim() !== '')
  ) {
    score += 2;
  }

  // 4. Phone number provided (+1)
  if (profile.phone_number || profile.phone) {
    score += 1;
  }

  // 5. LinkedIn profile provided (+1)
  if (profile.linkedin_profile) {
    score += 1;
  }

  // 6. Deal size range specified (+1)
  if (profile.target_deal_size_min && profile.target_deal_size_max) {
    score += 1;
  } else if (profile.revenue_range_min && profile.revenue_range_max) {
    score += 1;
  }

  return Math.min(10, score);
}

// ============================================================================
// TIER DETERMINATION
// ============================================================================
function determineTier(totalScore: number): number {
  if (totalScore >= 70) return 1;
  if (totalScore >= 45) return 2;
  if (totalScore >= 15) return 3;
  return 4;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check: require admin
    const auth = await requireAdmin(req, supabase);
    if (!auth.isAdmin) {
      return new Response(JSON.stringify({ error: auth.error || 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { profile_id, deal_request_message, connection_request_id, calculate_all } = body;

    // --- Batch mode: score all unscored or all buyers ---
    if (calculate_all) {
      let query = supabase.from('profiles').select('id').eq('role', 'buyer').is('deleted_at', null);

      if (calculate_all === 'unscored') {
        query = query.is('buyer_fit_score', null);
      }

      const { data: profileIds, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .limit(500);

      if (fetchError) throw new Error('Failed to fetch profiles: ' + fetchError.message);

      let scored = 0;
      let errors = 0;

      for (const row of profileIds || []) {
        try {
          await scoreProfile(supabase, row.id, null, null);
          scored++;
        } catch (e) {
          console.error(`Error scoring profile ${row.id}:`, e);
          errors++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Scored ${scored} buyers${errors > 0 ? `, ${errors} errors` : ''}`,
          scored,
          errors,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Single profile mode ---
    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'Must provide profile_id or calculate_all' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await scoreProfile(
      supabase,
      profile_id,
      deal_request_message || null,
      connection_request_id || null,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Calculate buyer fit score error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

// ============================================================================
// CORE SCORING FUNCTION
// ============================================================================
async function scoreProfile(
  supabase: any,
  profileId: string,
  dealRequestMessage: string | null,
  connectionRequestId: string | null,
) {
  // STEP 1: Fetch buyer data from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      `id, email, buyer_type, phone_number, website, buyer_org_url,
       linkedin_profile, ideal_target_description, mandate_blurb, bio,
       business_categories, target_locations, geographic_focus,
       target_deal_size_min, target_deal_size_max,
       revenue_range_min, revenue_range_max,
       fund_size, aum, deployment_timing, corpdev_intent, deal_intent,
       industry_expertise, include_keywords,
       admin_tier_override, admin_override_note`,
    )
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  // Fetch remarketing buyer data (linked via marketplace_firm_id or email)
  let remarketingBuyer: any = null;
  const { data: rmBuyers } = await supabase
    .from('remarketing_buyers')
    .select('id, buyer_type, thesis_summary, company_website, pe_firm_name')
    .or(`primary_contact_email.eq.${profile.email},marketplace_firm_id.not.is.null`)
    .limit(1);

  if (rmBuyers && rmBuyers.length > 0) {
    remarketingBuyer = rmBuyers[0];
  }

  // If connection_request_id provided but no message, fetch the message
  if (connectionRequestId && !dealRequestMessage) {
    const { data: cr } = await supabase
      .from('connection_requests')
      .select('user_message')
      .eq('id', connectionRequestId)
      .single();
    if (cr?.user_message) {
      dealRequestMessage = cr.user_message;
    }
  }

  // STEP 2: Component 1 — Buyer Type (max 40)
  const comp1 = calculateBuyerTypeScore(profile.buyer_type, remarketingBuyer?.buyer_type);

  // STEP 3: Component 2 — Platform Signal (max 30)
  const profileTexts = [
    profile.ideal_target_description,
    profile.mandate_blurb,
    profile.bio,
    remarketingBuyer?.thesis_summary,
  ].filter(Boolean);

  const comp2 = calculatePlatformSignal(dealRequestMessage, profileTexts);

  // STEP 4: Component 3 — Capital Credibility (max 20)
  const comp3Score = calculateCapitalCredibility(profile);

  // STEP 5: Component 4 — Profile Completeness (max 10)
  const comp4Score = calculateProfileCompleteness(profile);

  // STEP 6: Calculate total and tier
  const totalScore = comp1.score + comp2.score + comp3Score + comp4Score;
  const tier = determineTier(totalScore);

  // Apply admin override if set
  const effectiveTier = profile.admin_tier_override != null ? profile.admin_tier_override : tier;

  // STEP 7: Write back to profiles (always the profile-based score)
  const now = new Date().toISOString();

  // For profile-only scoring (no deal message), update profiles
  if (!connectionRequestId) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        buyer_fit_score: totalScore,
        buyer_fit_tier: effectiveTier,
        platform_signal_detected: comp2.detected,
        platform_signal_source: comp2.source,
        buyer_fit_score_last_calculated: now,
      })
      .eq('id', profileId);

    if (updateError) {
      console.error(`Failed to update profile ${profileId}:`, updateError);
    }

    // Also update remarketing_buyers if linked
    if (remarketingBuyer) {
      await supabase
        .from('remarketing_buyers')
        .update({
          buyer_fit_score: totalScore,
          buyer_fit_tier: effectiveTier,
          platform_signal_detected: comp2.detected,
        })
        .eq('id', remarketingBuyer.id);
    }
  }

  // For deal-specific scoring, update the connection_request record
  if (connectionRequestId) {
    await supabase
      .from('connection_requests')
      .update({
        deal_specific_buyer_score: totalScore,
        deal_specific_buyer_tier: effectiveTier,
        deal_specific_platform_signal: comp2.detected,
        deal_specific_platform_keywords:
          comp2.keywordsMatched.length > 0 ? comp2.keywordsMatched : null,
      })
      .eq('id', connectionRequestId);
  }

  return {
    profile_id: profileId,
    total_score: totalScore,
    tier: effectiveTier,
    algorithmic_tier: tier,
    admin_override: profile.admin_tier_override,
    component_breakdown: {
      buyer_type: comp1.score,
      platform_signal: comp2.score,
      capital_credibility: comp3Score,
      profile_completeness: comp4Score,
    },
    platform_signal_detected: comp2.detected,
    platform_signal_source: comp2.source,
    platform_keywords_matched: comp2.keywordsMatched,
    buyer_type_used: comp1.buyerTypeUsed,
    calculated_at: now,
  };
}
