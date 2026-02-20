import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * SELLER INTEREST SCORING METHODOLOGY
 *
 * This function analyzes deal data to determine seller motivation and interest level.
 * The score (0-100) indicates how motivated and ready the seller is to transact.
 *
 * SCORING CRITERIA (each contributes to final score):
 *
 * 1. STATED MOTIVATION (0-25 points)
 *    - Retirement: +25 (highly motivated, clear timeline)
 *    - Health issues: +25 (urgent need to sell)
 *    - Partnership dispute: +20 (motivated to exit)
 *    - Growth capital needed: +15 (wants deal, but selective)
 *    - Strategic sale: +10 (exploring options)
 *    - Unsolicited/fishing: +5 (low motivation)
 *    - No clear motivation: +0
 *
 * 2. TIMELINE URGENCY (0-20 points)
 *    - "ASAP" / "Immediately": +20
 *    - Within 6 months: +15
 *    - Within 12 months: +10
 *    - 1-2 years: +5
 *    - No timeline / "when right buyer": +0
 *
 * 3. ENGAGEMENT SIGNALS (0-20 points)
 *    - Responded quickly to outreach: +5
 *    - Provided detailed financials: +5
 *    - Multiple calls/meetings: +5
 *    - Introduced to management team: +5
 *    - Signed NDA/engagement letter: +5 (capped at 20)
 *
 * 4. DEAL READINESS (0-20 points)
 *    - Has CIM/teaser prepared: +5
 *    - Financial statements audited: +5
 *    - Working with advisor/broker: +5
 *    - Clear asking price/expectations: +5
 *
 * 5. NEGATIVE SIGNALS (deductions)
 *    - "Just exploring": -10
 *    - "Not in a rush": -10
 *    - "High asking price with no flexibility": -10
 *    - "Rejected multiple offers": -15
 *    - "Pulled deal before": -20
 *
 * 6. SELLER FLEXIBILITY (0-15 points)
 *    - Flexible on price: +5
 *    - Flexible on structure (earnout, seller note): +5
 *    - Willing to stay on post-close: +5
 */

const SELLER_INTEREST_PROMPT = `You are an M&A analyst evaluating seller motivation and interest level for a potential acquisition target.

Analyze the provided deal information and score the seller's interest/motivation on a 0-100 scale.

SCORING FRAMEWORK:

1. STATED MOTIVATION (0-25 points):
   - Retirement (age 60+, succession needed): 25 points
   - Health/personal issues requiring exit: 25 points
   - Partnership dispute/buyout: 20 points
   - Need growth capital/strategic partner: 15 points
   - Exploring strategic options: 10 points
   - Unsolicited inquiry/just curious: 5 points
   - No clear motivation stated: 0 points

2. TIMELINE URGENCY (0-20 points):
   - Wants to close ASAP/within 3 months: 20 points
   - Within 6 months: 15 points
   - Within 12 months: 10 points
   - 1-2 years: 5 points
   - No timeline/"when right buyer comes": 0 points

3. ENGAGEMENT LEVEL (0-20 points):
   - Quick response to outreach: +5
   - Shared detailed financials willingly: +5
   - Had multiple calls/meetings: +5
   - Introduced management team: +5
   - Signed NDA or engagement letter: +5

4. DEAL READINESS (0-20 points):
   - Has prepared CIM/teaser: +5
   - Audited or reviewed financials: +5
   - Working with advisor/investment banker: +5
   - Has clear price expectations: +5

5. FLEXIBILITY SIGNALS (0-15 points):
   - Price flexibility indicated: +5
   - Open to earnout/seller note: +5
   - Willing to stay on post-close: +5

NEGATIVE ADJUSTMENTS (deduct from total):
   - "Just exploring options": -10
   - "Not in any rush": -10
   - Unrealistic price expectations: -10
   - Previously rejected offers: -15
   - Pulled deal from market before: -20
   - Demanding all-cash, no flexibility: -10

Analyze ALL available information including:
- Owner notes and stated goals
- Meeting/call notes
- Timeline preferences
- Financial disclosure level
- Deal history if mentioned
- Transition preferences
- Any red flags or concerns`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dealId } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: 'Missing dealId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch deal with all relevant fields
    const { data: deal, error: dealError } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        internal_company_name,
        owner_notes,
        internal_notes,
        general_notes,
        owner_goals,
        seller_motivation,
        timeline_preference,
        seller_involvement_preference,
        transaction_preferences,
        revenue,
        ebitda,
        enriched_at,
        seller_interest_score,
        seller_interest_analyzed_at
      `)
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compile all notes and context
    const allNotes = [
      deal.owner_notes,
      deal.internal_notes,
      deal.general_notes,
      deal.owner_goals,
      deal.seller_motivation,
      deal.timeline_preference,
      deal.seller_involvement_preference,
      deal.transaction_preferences ? JSON.stringify(deal.transaction_preferences) : null,
    ].filter(Boolean).join('\n\n---\n\n');

    if (!allNotes || allNotes.length < 20) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient data to analyze seller interest. Add owner notes or seller motivation information.',
          fieldsNeeded: ['owner_notes', 'owner_goals', 'seller_motivation', 'timeline_preference']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing seller interest for deal ${dealId}: ${deal.internal_company_name || deal.title}`);

    // Build context for AI
    const dealContext = `
DEAL: ${deal.internal_company_name || deal.title}
REVENUE: ${deal.revenue ? `$${(deal.revenue / 1000000).toFixed(1)}M` : 'Not disclosed'}
EBITDA: ${deal.ebitda ? `$${(deal.ebitda / 1000000).toFixed(1)}M` : 'Not disclosed'}

SELLER INFORMATION AND NOTES:
${allNotes}
`;

    // Call AI for scoring
    const aiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(geminiApiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: SELLER_INTEREST_PROMPT },
          { role: 'user', content: `Analyze this deal and provide a seller interest score:\n\n${dealContext}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'score_seller_interest',
            description: 'Score the seller interest/motivation level based on available information',
            parameters: {
              type: 'object',
              properties: {
                seller_interest_score: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 100,
                  description: 'Overall seller interest/motivation score (0-100)'
                },
                confidence: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Confidence level in this score based on available data'
                },
                motivation_category: {
                  type: 'string',
                  enum: ['retirement', 'health', 'partnership_dispute', 'growth_capital', 'strategic', 'unsolicited', 'unknown'],
                  description: 'Primary motivation category'
                },
                timeline_urgency: {
                  type: 'string',
                  enum: ['immediate', '6_months', '12_months', '1_2_years', 'flexible', 'unknown'],
                  description: 'Estimated timeline urgency'
                },
                engagement_level: {
                  type: 'string',
                  enum: ['highly_engaged', 'moderately_engaged', 'limited_engagement', 'unknown'],
                  description: 'Level of seller engagement observed'
                },
                key_signals: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Key positive signals observed (max 5)'
                },
                red_flags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Red flags or concerns (max 5)'
                },
                score_breakdown: {
                  type: 'object',
                  properties: {
                    motivation_points: { type: 'integer', description: 'Points from motivation (0-25)' },
                    timeline_points: { type: 'integer', description: 'Points from timeline (0-20)' },
                    engagement_points: { type: 'integer', description: 'Points from engagement (0-20)' },
                    readiness_points: { type: 'integer', description: 'Points from deal readiness (0-20)' },
                    flexibility_points: { type: 'integer', description: 'Points from flexibility (0-15)' },
                    deductions: { type: 'integer', description: 'Negative adjustments' }
                  },
                  description: 'Breakdown of score components'
                },
                analysis_summary: {
                  type: 'string',
                  description: 'Brief 2-3 sentence summary of seller interest assessment'
                }
              },
              required: ['seller_interest_score', 'confidence', 'analysis_summary']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'score_seller_interest' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI response error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log('Seller interest analysis result:', result);

    // Update the listing with the score
    const { error: updateError } = await supabase
      .from('listings')
      .update({
        seller_interest_score: result.seller_interest_score,
        seller_interest_confidence: result.confidence,
        seller_interest_notes: {
          motivation_category: result.motivation_category,
          timeline_urgency: result.timeline_urgency,
          engagement_level: result.engagement_level,
          key_signals: result.key_signals,
          red_flags: result.red_flags,
          score_breakdown: result.score_breakdown,
          analysis_summary: result.analysis_summary,
        },
        seller_interest_analyzed_at: new Date().toISOString(),
      })
      .eq('id', dealId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        dealId,
        score: result.seller_interest_score,
        confidence: result.confidence,
        motivation_category: result.motivation_category,
        timeline_urgency: result.timeline_urgency,
        engagement_level: result.engagement_level,
        key_signals: result.key_signals,
        red_flags: result.red_flags,
        score_breakdown: result.score_breakdown,
        analysis_summary: result.analysis_summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-seller-interest:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
