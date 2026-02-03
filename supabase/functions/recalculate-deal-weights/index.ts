import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
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

    const { universeId } = await req.json();

    console.log(`Analyzing learning history${universeId ? ` for universe ${universeId}` : ' globally'}`);

    // Fetch learning history
    let historyQuery = supabase
      .from('buyer_learning_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (universeId) {
      historyQuery = historyQuery.eq('universe_id', universeId);
    }

    const { data: history, error: historyError } = await historyQuery;

    if (historyError) throw historyError;

    if (!history || history.length < 10) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Not enough data for analysis (minimum 10 decisions required)',
        totalDecisions: history?.length || 0,
        suggestions: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyze patterns
    const approved = history.filter(h => h.action === 'approved');
    const passed = history.filter(h => h.action === 'passed');

    // Category analysis for passed buyers
    const passCategories: Record<string, number> = {};
    const passReasons: Record<string, number> = {};
    
    passed.forEach(p => {
      if (p.pass_category) {
        passCategories[p.pass_category] = (passCategories[p.pass_category] || 0) + 1;
      }
      if (p.pass_reason) {
        passReasons[p.pass_reason] = (passReasons[p.pass_reason] || 0) + 1;
      }
    });

    // Score analysis
    const avgApprovedScores = {
      composite: approved.reduce((sum, a) => sum + (a.composite_score || 0), 0) / (approved.length || 1),
      geography: approved.reduce((sum, a) => sum + (a.geography_score || 0), 0) / (approved.length || 1),
      size: approved.reduce((sum, a) => sum + (a.size_score || 0), 0) / (approved.length || 1),
      service: approved.reduce((sum, a) => sum + (a.service_score || 0), 0) / (approved.length || 1),
      ownerGoals: approved.reduce((sum, a) => sum + (a.owner_goals_score || 0), 0) / (approved.length || 1),
    };

    const avgPassedScores = {
      composite: passed.reduce((sum, p) => sum + (p.composite_score || 0), 0) / (passed.length || 1),
      geography: passed.reduce((sum, p) => sum + (p.geography_score || 0), 0) / (passed.length || 1),
      size: passed.reduce((sum, p) => sum + (p.size_score || 0), 0) / (passed.length || 1),
      service: passed.reduce((sum, p) => sum + (p.service_score || 0), 0) / (passed.length || 1),
      ownerGoals: passed.reduce((sum, p) => sum + (p.owner_goals_score || 0), 0) / (passed.length || 1),
    };

    // Generate suggestions based on score differences
    const suggestions: Array<{
      category: string;
      currentWeight: number;
      suggestedWeight: number;
      reason: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    // Fetch current universe weights if provided
    let currentWeights = { geography: 35, size: 25, service: 25, ownerGoals: 15 };
    if (universeId) {
      const { data: universe } = await supabase
        .from('remarketing_buyer_universes')
        .select('geography_weight, size_weight, service_weight, owner_goals_weight')
        .eq('id', universeId)
        .single();
      
      if (universe) {
        currentWeights = {
          geography: universe.geography_weight || 35,
          size: universe.size_weight || 25,
          service: universe.service_weight || 25,
          ownerGoals: universe.owner_goals_weight || 15,
        };
      }
    }

    // Analyze each category
    const categories = ['geography', 'size', 'service', 'ownerGoals'] as const;
    
    for (const cat of categories) {
      const approvedAvg = avgApprovedScores[cat];
      const passedAvg = avgPassedScores[cat];
      const diff = approvedAvg - passedAvg;

      // If approved buyers score significantly higher in this category, increase weight
      if (diff > 15) {
        const increase = Math.min(10, Math.round(diff / 3));
        suggestions.push({
          category: cat,
          currentWeight: currentWeights[cat],
          suggestedWeight: Math.min(50, currentWeights[cat] + increase),
          reason: `Approved buyers score ${diff.toFixed(0)} points higher in ${cat}. This appears to be a key differentiator.`,
          confidence: diff > 25 ? 'high' : diff > 20 ? 'medium' : 'low',
        });
      }
      // If little difference, might be overweighted
      else if (diff < 5 && currentWeights[cat] > 20) {
        suggestions.push({
          category: cat,
          currentWeight: currentWeights[cat],
          suggestedWeight: Math.max(10, currentWeights[cat] - 5),
          reason: `Little score difference between approved and passed buyers in ${cat} (${diff.toFixed(0)} pts). Consider reducing weight.`,
          confidence: 'low',
        });
      }
    }

    // Analyze pass categories
    const topPassCategories = Object.entries(passCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return new Response(JSON.stringify({
      success: true,
      analysis: {
        totalDecisions: history.length,
        approved: approved.length,
        passed: passed.length,
        approvalRate: ((approved.length / history.length) * 100).toFixed(1),
        avgApprovedScores,
        avgPassedScores,
        topPassCategories: topPassCategories.map(([cat, count]) => ({
          category: cat,
          count,
          percentage: ((count / passed.length) * 100).toFixed(1)
        })),
        topPassReasons: Object.entries(passReasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count }))
      },
      suggestions,
      currentWeights,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in recalculate-deal-weights:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze learning history';
    return new Response(JSON.stringify({ 
      error: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
