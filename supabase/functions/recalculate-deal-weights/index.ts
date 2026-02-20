import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Recalculate Deal Weights
 * 
 * Analyzes approve/pass/remove patterns for a deal to produce adaptive weight multipliers.
 * These multipliers adjust the scoring weights for future scoring runs.
 * 
 * Input: { listingId, universeId }
 * Output: { adjustments: { geography_weight_mult, size_weight_mult, services_weight_mult }, stats }
 */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const { listingId, universeId } = await req.json();
    if (!listingId) {
      return new Response(
        JSON.stringify({ error: "listingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all scored buyers with their decisions
    const query = supabase
      .from("remarketing_scores")
      .select("buyer_id, composite_score, geography_score, size_score, service_score, status, pass_category, pass_reason, is_disqualified")
      .eq("listing_id", listingId);

    if (universeId) {
      query.eq("universe_id", universeId);
    }

    const { data: scores, error: scoresError } = await query;
    if (scoresError) throw scoresError;
    if (!scores || scores.length === 0) {
      return new Response(
        JSON.stringify({ success: true, adjustments: null, message: "No scores to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also fetch learning history for this deal
    const { data: history } = await supabase
      .from("buyer_learning_history")
      .select("action, pass_category, geography_score, size_score, service_score")
      .eq("listing_id", listingId);

    // Analyze patterns
    const approved = scores.filter((s: any) => s.status === "approved");
    const passed = scores.filter((s: any) => s.status === "passed" || s.status === "not_a_fit");
    const totalDecisions = approved.length + passed.length;

    if (totalDecisions < 3) {
      return new Response(
        JSON.stringify({ success: true, adjustments: null, message: "Not enough decisions yet (need 3+)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count pass categories
    const passCategories: Record<string, number> = {};
    for (const p of passed) {
      const cat = p.pass_category || "other";
      passCategories[cat] = (passCategories[cat] || 0) + 1;
    }
    // Also count from learning history
    for (const h of (history || [])) {
      if (h.action === "passed" && h.pass_category) {
        passCategories[h.pass_category] = (passCategories[h.pass_category] || 0) + 1;
      }
    }

    // Calculate weight multipliers (range: 0.6 - 1.4)
    // If a category is the primary rejection reason, INCREASE its weight (it matters more)
    // If a category is never the rejection reason but scores are low on approved buyers, DECREASE its weight
    const totalPasses = passed.length || 1;

    const geoPassRate = (passCategories["geography"] || 0) / totalPasses;
    const sizePassRate = (passCategories["size"] || 0) / totalPasses;
    const servicePassRate = (passCategories["service"] || passCategories["services"] || 0) / totalPasses;

    // Multiplier logic: high pass rate for a category → increase its weight
    const geography_weight_mult = Math.max(0.6, Math.min(1.4, 1.0 + (geoPassRate - 0.15) * 2));
    const size_weight_mult = Math.max(0.6, Math.min(1.4, 1.0 + (sizePassRate - 0.15) * 2));
    const services_weight_mult = Math.max(0.6, Math.min(1.4, 1.0 + (servicePassRate - 0.15) * 2));

    // Calculate average scores on approved vs passed for diagnostics
    const avgApprovedScore = approved.length > 0
      ? Math.round(approved.reduce((s: number, r: any) => s + (r.composite_score || 0), 0) / approved.length)
      : 0;
    const avgPassedScore = passed.length > 0
      ? Math.round(passed.reduce((s: number, r: any) => s + (r.composite_score || 0), 0) / passed.length)
      : 0;

    const adjustments = {
      geography_weight_mult: Math.round(geography_weight_mult * 100) / 100,
      size_weight_mult: Math.round(size_weight_mult * 100) / 100,
      services_weight_mult: Math.round(services_weight_mult * 100) / 100,
      approved_count: approved.length,
      rejected_count: passed.length,
      passed_geography: passCategories["geography"] || 0,
      passed_size: passCategories["size"] || 0,
      passed_services: passCategories["service"] || passCategories["services"] || 0,
      last_calculated_at: new Date().toISOString(),
    };

    // Upsert to deal_scoring_adjustments
    const { error: upsertError } = await supabase
      .from("deal_scoring_adjustments")
      .upsert({
        deal_id: listingId,
        ...adjustments,
      }, { onConflict: "deal_id" });

    if (upsertError) {
      console.error("Failed to save weight adjustments:", upsertError);
    }

    const stats = {
      totalScored: scores.length,
      totalDecisions,
      approved: approved.length,
      passed: passed.length,
      avgApprovedScore,
      avgPassedScore,
      passCategories,
    };

    console.log(`[recalculate-deal-weights] Deal ${listingId}: ${JSON.stringify(stats)}`);

    return new Response(
      JSON.stringify({ success: true, adjustments, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[recalculate-deal-weights] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
