import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeightSuggestion {
  dimension: 'geography' | 'size' | 'service' | 'owner_goals';
  currentWeight: number;
  suggestedWeight: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: number;
}

interface PatternAnalysis {
  suggestions: WeightSuggestion[];
  insights: string[];
  approvalRateByTier: Record<string, number>;
  topPassReasons: Array<{ category: string; count: number; percentage: number }>;
  totalDecisions: number;
  analysisDate: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { universeId } = await req.json();

    if (!universeId) {
      throw new Error("universeId is required");
    }

    console.log(`Analyzing scoring patterns for universe: ${universeId}`);

    // Fetch universe configuration
    const { data: universe, error: universeError } = await supabase
      .from("remarketing_buyer_universes")
      .select("*")
      .eq("id", universeId)
      .single();

    if (universeError || !universe) {
      throw new Error("Universe not found");
    }

    // Fetch learning history for this universe
    const { data: learningHistory, error: historyError } = await supabase
      .from("buyer_learning_history")
      .select("*")
      .eq("universe_id", universeId)
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error("Failed to fetch learning history:", historyError);
      throw new Error("Failed to fetch learning history");
    }

    const history = learningHistory || [];
    console.log(`Found ${history.length} learning history entries`);

    // If not enough data, return early
    if (history.length < 5) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          insights: ["Not enough decision data yet. Make at least 5 approval/pass decisions to see suggestions."],
          approvalRateByTier: {},
          topPassReasons: [],
          totalDecisions: history.length,
          analysisDate: new Date().toISOString(),
        } as PatternAnalysis),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate statistics
    const approved = history.filter(h => h.action === 'approved');
    const passed = history.filter(h => h.action === 'passed');
    const approvalRate = history.length > 0 ? approved.length / history.length : 0;

    // Analyze score dimensions for approved vs passed
    const avgApprovedScores = {
      geography: calculateAvg(approved, 'geography_score'),
      size: calculateAvg(approved, 'size_score'),
      service: calculateAvg(approved, 'service_score'),
      owner_goals: calculateAvg(approved, 'owner_goals_score'),
      composite: calculateAvg(approved, 'composite_score'),
    };

    const avgPassedScores = {
      geography: calculateAvg(passed, 'geography_score'),
      size: calculateAvg(passed, 'size_score'),
      service: calculateAvg(passed, 'service_score'),
      owner_goals: calculateAvg(passed, 'owner_goals_score'),
      composite: calculateAvg(passed, 'composite_score'),
    };

    // Calculate pass rates by dimension (which dimensions cause the most passes)
    const passReasonCounts: Record<string, number> = {};
    for (const p of passed) {
      const category = p.pass_category || 'other';
      passReasonCounts[category] = (passReasonCounts[category] || 0) + 1;
    }

    const topPassReasons = Object.entries(passReasonCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / passed.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate approval rate by tier
    const tierCounts: Record<string, { approved: number; total: number }> = {};
    for (const h of history) {
      // Determine tier from composite score
      const score = h.composite_score || 0;
      let tier = 'D';
      if (score >= 85) tier = 'A';
      else if (score >= 70) tier = 'B';
      else if (score >= 55) tier = 'C';
      
      if (!tierCounts[tier]) {
        tierCounts[tier] = { approved: 0, total: 0 };
      }
      tierCounts[tier].total++;
      if (h.action === 'approved') {
        tierCounts[tier].approved++;
      }
    }

    const approvalRateByTier: Record<string, number> = {};
    for (const [tier, counts] of Object.entries(tierCounts)) {
      approvalRateByTier[tier] = counts.total > 0 
        ? Math.round((counts.approved / counts.total) * 100) 
        : 0;
    }

    // Generate weight suggestions
    const suggestions: WeightSuggestion[] = [];
    const insights: string[] = [];

    const currentWeights = {
      geography: universe.geography_weight || 25,
      size: universe.size_weight || 25,
      service: universe.service_weight || 25,
      owner_goals: universe.owner_goals_weight || 25,
    };

    // Analyze each dimension
    const dimensions: Array<'geography' | 'size' | 'service' | 'owner_goals'> = 
      ['geography', 'size', 'service', 'owner_goals'];

    for (const dim of dimensions) {
      const approvedAvg = avgApprovedScores[dim];
      const passedAvg = avgPassedScores[dim];
      const currentWeight = currentWeights[dim];
      const scoreDiff = approvedAvg - passedAvg;

      // If approved scores are significantly higher in this dimension, it's important
      if (scoreDiff > 15 && approvedAvg > 70) {
        // This dimension is a strong predictor of approval - maybe increase weight
        if (currentWeight < 35) {
          suggestions.push({
            dimension: dim,
            currentWeight,
            suggestedWeight: Math.min(40, currentWeight + 5),
            reason: `Approved buyers score ${Math.round(scoreDiff)}pts higher on ${formatDimension(dim)}. Consider increasing weight.`,
            confidence: scoreDiff > 25 ? 'high' : 'medium',
            dataPoints: history.length,
          });
        }
      } else if (scoreDiff < 5 && passedAvg > 60) {
        // This dimension doesn't differentiate - maybe decrease weight
        if (currentWeight > 20) {
          suggestions.push({
            dimension: dim,
            currentWeight,
            suggestedWeight: Math.max(15, currentWeight - 5),
            reason: `${formatDimension(dim)} scores are similar for approved and passed buyers (${Math.round(approvedAvg)} vs ${Math.round(passedAvg)}). Consider reducing weight.`,
            confidence: 'medium',
            dataPoints: history.length,
          });
        }
      }
    }

    // Generate insights
    if (approvalRate > 0.7) {
      insights.push(`High approval rate (${Math.round(approvalRate * 100)}%) suggests scoring is well-calibrated or criteria may be too lenient.`);
    } else if (approvalRate < 0.3) {
      insights.push(`Low approval rate (${Math.round(approvalRate * 100)}%) suggests scoring criteria may be too strict or buyer data quality is low.`);
    }

    if (topPassReasons.length > 0 && topPassReasons[0].percentage > 40) {
      insights.push(`${topPassReasons[0].category.replace(/_/g, ' ')} is the top pass reason (${topPassReasons[0].percentage}%). Consider adjusting ${topPassReasons[0].category} criteria.`);
    }

    const tierAApproval = approvalRateByTier['A'] || 0;
    const tierBApproval = approvalRateByTier['B'] || 0;
    if (tierAApproval < 50 && tierBApproval > tierAApproval) {
      insights.push(`Tier B buyers have higher approval rate than Tier A. Consider reviewing tier thresholds.`);
    }

    if (avgApprovedScores.composite < 70) {
      insights.push(`Average approved score is ${Math.round(avgApprovedScores.composite)}. You may be approving lower-quality matches.`);
    }

    const analysis: PatternAnalysis = {
      suggestions,
      insights,
      approvalRateByTier,
      topPassReasons,
      totalDecisions: history.length,
      analysisDate: new Date().toISOString(),
    };

    console.log(`Analysis complete: ${suggestions.length} suggestions, ${insights.length} insights`);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pattern analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateAvg(items: any[], field: string): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
  return sum / items.length;
}

function formatDimension(dim: string): string {
  const labels: Record<string, string> = {
    geography: 'Geography',
    size: 'Size/Revenue',
    service: 'Service Match',
    owner_goals: 'Owner Goals',
  };
  return labels[dim] || dim;
}
