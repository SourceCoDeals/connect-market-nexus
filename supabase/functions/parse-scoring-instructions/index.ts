import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

interface ParsedRule {
  type: 'service_adjustment' | 'geography_adjustment' | 'size_adjustment' | 'owner_goals_adjustment' | 'disqualify' | 'bonus';
  condition: string;
  target: string;
  action: 'bonus' | 'penalty' | 'disqualify';
  points: number;
  reasoning: string;
}

interface ParsedInstructions {
  rules: ParsedRule[];
  summary: string;
  keywords: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { dealId, instructions, industryType } = await req.json();

    if (!dealId || !instructions) {
      return new Response(JSON.stringify({ error: 'dealId and instructions are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the natural language instructions using OpenAI
    const systemPrompt = `You are an M&A scoring system expert. Parse natural language instructions into structured scoring rules.

The user is providing deal-specific scoring customizations for a ${industryType || 'business services'} deal.

Common instruction patterns and how to parse them:

1. "No DRP relationships" or "doesn't have DRP" → Service adjustment that REWARDS buyers who don't require DRP
2. "Quick close needed" or "fast timeline" → Owner goals adjustment prioritizing quick close buyers
3. "Owner wants to stay" or "rollover equity" → Owner goals adjustment for equity rollover buyers
4. "Single location" or "small shop" → Size adjustment being lenient on single location
5. "Specific geography only" → Geography adjustment for specific states/regions

Output a JSON object with:
{
  "rules": [
    {
      "type": "service_adjustment" | "geography_adjustment" | "size_adjustment" | "owner_goals_adjustment" | "disqualify" | "bonus",
      "condition": "describes when this rule applies (e.g., 'buyer_prefers_drp', 'buyer_comfortable_without_drp')",
      "target": "what to look for (e.g., 'DRP', 'quick_close', 'equity_rollover')",
      "action": "bonus" | "penalty" | "disqualify",
      "points": number between -30 and +30,
      "reasoning": "short explanation shown to user"
    }
  ],
  "summary": "Brief 1-sentence summary of the custom scoring",
  "keywords": ["list", "of", "key", "terms", "to", "match"]
}

Be specific about conditions. Extract all relevant rules from the instructions.`;

    console.log(`Parsing instructions for deal ${dealId}: "${instructions}"`);

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          { role: 'user', content: instructions + '\n\nReturn ONLY a valid JSON object.' }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const parsedContent = data.content?.[0]?.text;
    
    let parsed: ParsedInstructions;
    try {
      const jsonMatch = parsedContent.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(parsedContent);
    } catch (e) {
      console.error('Failed to parse Claude response:', parsedContent);
      throw new Error('Failed to parse AI response');
    }

    console.log(`Parsed ${parsed.rules?.length || 0} rules:`, JSON.stringify(parsed, null, 2));

    // Upsert the parsed instructions to deal_scoring_adjustments
    const { error: upsertError } = await supabase
      .from('deal_scoring_adjustments')
      .upsert({
        deal_id: dealId,
        custom_instructions: instructions,
        parsed_instructions: parsed,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'deal_id'
      });

    if (upsertError) {
      console.error('Failed to save parsed instructions:', upsertError);
      throw new Error('Failed to save parsed instructions');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      parsed,
      message: `Parsed ${parsed.rules?.length || 0} scoring rules`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in parse-scoring-instructions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
