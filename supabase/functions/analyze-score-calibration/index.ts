import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalibrationAnalysis {
  overridePatterns: {
    industry: string;
    avgDelta: number;
    sampleSize: number;
    recommendation: string;
  }[];
  outcomeAccuracy: {
    closedDealsAvgScore: number;
    withdrawnDealsAvgScore: number;
    scoreCorrelation: string;
  };
  feedbackPatterns: {
    topPassReasons: { reason: string; count: number; avgScore: number }[];
    approvalRateByScoreRange: { range: string; rate: number }[];
  };
  weightRecommendations: {
    currentWeights: { size: number; quality: number; completeness: number; motivation: number };
    suggestedWeights: { size: number; quality: number; completeness: number; motivation: number };
    confidence: string;
    reasoning: string;
  };
  industryAdjustments: {
    industry: string;
    currentAdjustment: number;
    suggestedAdjustment: number;
    confidence: string;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { applyRecommendations = false } = body;

    console.log('Starting score calibration analysis...');

    // ===== 1. ANALYZE OVERRIDE PATTERNS =====
    const { data: overrideData } = await supabase
      .from('score_override_history')
      .select('*')
      .order('created_at', { ascending: false });

    const overridesByIndustry = new Map<string, { deltas: number[]; ebitdas: number[] }>();

    for (const override of (overrideData || [])) {
      const industry = override.listing_industry || 'Unknown';
      if (!overridesByIndustry.has(industry)) {
        overridesByIndustry.set(industry, { deltas: [], ebitdas: [] });
      }
      const data = overridesByIndustry.get(industry)!;
      data.deltas.push(override.delta);
      if (override.listing_ebitda) data.ebitdas.push(override.listing_ebitda);
    }

    const overridePatterns = Array.from(overridesByIndustry.entries())
      .filter(([_, data]) => data.deltas.length >= 3)
      .map(([industry, data]) => {
        const avgDelta = data.deltas.reduce((a, b) => a + b, 0) / data.deltas.length;
        let recommendation = 'No change needed';

        if (avgDelta > 5) {
          recommendation = `Consider +${Math.round(avgDelta)} industry adjustment (scores too low)`;
        } else if (avgDelta < -5) {
          recommendation = `Consider ${Math.round(avgDelta)} industry adjustment (scores too high)`;
        }

        return {
          industry,
          avgDelta: Math.round(avgDelta * 10) / 10,
          sampleSize: data.deltas.length,
          recommendation,
        };
      })
      .sort((a, b) => Math.abs(b.avgDelta) - Math.abs(a.avgDelta));

    // ===== 2. ANALYZE OUTCOME ACCURACY =====
    const { data: outcomeData } = await supabase
      .from('deal_outcomes')
      .select('*');

    const closedDeals = (outcomeData || []).filter(d => d.outcome_type === 'closed');
    const withdrawnDeals = (outcomeData || []).filter(d => d.outcome_type === 'withdrawn');

    const closedAvgScore = closedDeals.length > 0
      ? closedDeals.reduce((sum, d) => sum + (d.deal_score_at_close || 0), 0) / closedDeals.length
      : 0;
    const withdrawnAvgScore = withdrawnDeals.length > 0
      ? withdrawnDeals.reduce((sum, d) => sum + (d.deal_score_at_close || 0), 0) / withdrawnDeals.length
      : 0;

    let scoreCorrelation = 'Insufficient data';
    if (closedDeals.length >= 5 && withdrawnDeals.length >= 5) {
      if (closedAvgScore > withdrawnAvgScore + 10) {
        scoreCorrelation = 'Strong positive correlation - higher scores close more often';
      } else if (closedAvgScore > withdrawnAvgScore) {
        scoreCorrelation = 'Weak positive correlation';
      } else {
        scoreCorrelation = 'No correlation detected - may need recalibration';
      }
    }

    const outcomeAccuracy = {
      closedDealsAvgScore: Math.round(closedAvgScore),
      withdrawnDealsAvgScore: Math.round(withdrawnAvgScore),
      scoreCorrelation,
    };

    // ===== 3. ANALYZE BUYER FEEDBACK =====
    const { data: feedbackData } = await supabase
      .from('score_feedback')
      .select('*');

    // Group by pass category
    const passCounts = new Map<string, { count: number; scores: number[] }>();
    const approvalsByRange = new Map<string, { approved: number; total: number }>();

    for (const feedback of (feedbackData || [])) {
      // Pass reasons
      if (feedback.action === 'passed' && feedback.pass_category) {
        if (!passCounts.has(feedback.pass_category)) {
          passCounts.set(feedback.pass_category, { count: 0, scores: [] });
        }
        const data = passCounts.get(feedback.pass_category)!;
        data.count++;
        if (feedback.deal_score_at_feedback) data.scores.push(feedback.deal_score_at_feedback);
      }

      // Approval rate by score range
      if (feedback.deal_score_at_feedback) {
        const score = feedback.deal_score_at_feedback;
        let range = '0-40';
        if (score >= 80) range = '80-100';
        else if (score >= 60) range = '60-79';
        else if (score >= 40) range = '40-59';

        if (!approvalsByRange.has(range)) {
          approvalsByRange.set(range, { approved: 0, total: 0 });
        }
        const data = approvalsByRange.get(range)!;
        data.total++;
        if (feedback.action === 'approved' || feedback.action === 'interested') {
          data.approved++;
        }
      }
    }

    const topPassReasons = Array.from(passCounts.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        avgScore: data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const approvalRateByScoreRange = Array.from(approvalsByRange.entries())
      .map(([range, data]) => ({
        range,
        rate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
      }))
      .sort((a, b) => {
        const order = ['80-100', '60-79', '40-59', '0-40'];
        return order.indexOf(a.range) - order.indexOf(b.range);
      });

    const feedbackPatterns = {
      topPassReasons,
      approvalRateByScoreRange,
    };

    // ===== 4. GENERATE WEIGHT RECOMMENDATIONS =====
    const currentWeights = { size: 65, quality: 20, completeness: 8, motivation: 7 };
    let suggestedWeights = { ...currentWeights };
    let confidence = 'low';
    let reasoning = 'Insufficient data for recommendations';

    const totalOverrides = overrideData?.length || 0;
    const totalOutcomes = outcomeData?.length || 0;
    const totalFeedback = feedbackData?.length || 0;

    if (totalOverrides >= 10 || totalOutcomes >= 5 || totalFeedback >= 20) {
      confidence = totalOverrides >= 30 || totalOutcomes >= 15 ? 'high' : 'medium';

      // Analyze patterns to suggest weight changes
      const avgOverrideDelta = overrideData && overrideData.length > 0
        ? overrideData.reduce((sum, o) => sum + o.delta, 0) / overrideData.length
        : 0;

      if (avgOverrideDelta > 8) {
        // Scores consistently too low - might need to reduce size weight dominance
        suggestedWeights = { size: 60, quality: 22, completeness: 10, motivation: 8 };
        reasoning = `Average override delta is +${avgOverrideDelta.toFixed(1)}. Scores may be too conservative. Consider reducing size weight slightly.`;
      } else if (avgOverrideDelta < -8) {
        // Scores consistently too high - increase size weight
        suggestedWeights = { size: 70, quality: 18, completeness: 7, motivation: 5 };
        reasoning = `Average override delta is ${avgOverrideDelta.toFixed(1)}. Scores may be too generous. Consider increasing size weight.`;
      } else {
        reasoning = `Average override delta is ${avgOverrideDelta.toFixed(1)}. Current weights appear well-calibrated.`;
      }
    }

    const weightRecommendations = {
      currentWeights,
      suggestedWeights,
      confidence,
      reasoning,
    };

    // ===== 5. GENERATE INDUSTRY ADJUSTMENTS =====
    const { data: currentAdjustments } = await supabase
      .from('industry_score_adjustments')
      .select('*');

    const industryAdjustments = overridePatterns
      .filter(p => Math.abs(p.avgDelta) >= 3 && p.sampleSize >= 3)
      .map(pattern => {
        const existing = currentAdjustments?.find(a => a.industry === pattern.industry);
        return {
          industry: pattern.industry,
          currentAdjustment: existing?.score_adjustment || 0,
          suggestedAdjustment: Math.round(pattern.avgDelta),
          confidence: pattern.sampleSize >= 10 ? 'high' : pattern.sampleSize >= 5 ? 'medium' : 'low',
        };
      });

    // ===== 6. OPTIONALLY APPLY RECOMMENDATIONS =====
    if (applyRecommendations && confidence !== 'low') {
      console.log('Applying calibration recommendations...');

      // Update industry adjustments
      for (const adj of industryAdjustments) {
        if (adj.confidence !== 'low') {
          await supabase
            .from('industry_score_adjustments')
            .upsert({
              industry: adj.industry,
              score_adjustment: adj.suggestedAdjustment,
              avg_override_delta: adj.suggestedAdjustment,
              sample_size: overridePatterns.find(p => p.industry === adj.industry)?.sampleSize || 0,
              confidence: adj.confidence,
              last_calculated_at: new Date().toISOString(),
              manually_set: false,
            }, { onConflict: 'industry' });
        }
      }

      // Record calibration run
      await supabase
        .from('score_calibration_runs')
        .insert({
          run_by: user.id,
          analysis_start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          analysis_end_date: new Date().toISOString().split('T')[0],
          total_deals_analyzed: totalOverrides + totalOutcomes + totalFeedback,
          deals_with_outcomes: totalOutcomes,
          deals_with_overrides: totalOverrides,
          deals_with_feedback: totalFeedback,
          avg_override_delta: overrideData && overrideData.length > 0
            ? overrideData.reduce((sum, o) => sum + o.delta, 0) / overrideData.length
            : null,
          weight_recommendations: weightRecommendations,
          industry_recommendations: industryAdjustments,
          applied: true,
          applied_at: new Date().toISOString(),
        });
    }

    const analysis: CalibrationAnalysis = {
      overridePatterns,
      outcomeAccuracy,
      feedbackPatterns,
      weightRecommendations,
      industryAdjustments,
    };

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        dataSummary: {
          totalOverrides: totalOverrides,
          totalOutcomes: totalOutcomes,
          totalFeedback: totalFeedback,
          dataQuality: totalOverrides >= 30 ? 'good' : totalOverrides >= 10 ? 'moderate' : 'limited',
        },
        applied: applyRecommendations && confidence !== 'low',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Calibration analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
