import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScoringRule {
  type: 'service_adjustment' | 'geography_adjustment' | 'size_adjustment' | 'disqualify' | 'bonus';
  condition: string;
  adjustment: number; // Points to add/subtract, or 0 for disqualify
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId, instructions } = await req.json();

    if (!dealId || !instructions) {
      return new Response(
        JSON.stringify({ error: 'dealId and instructions are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch deal context
    const { data: deal } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single();

    const systemPrompt = `You are an M&A scoring rule parser. Convert natural language instructions into structured scoring rules.

Available rule types:
1. service_adjustment: Adjust score based on service fit
2. geography_adjustment: Adjust score based on geographic fit
3. size_adjustment: Adjust score based on deal size fit
4. disqualify: Remove buyer from consideration entirely
5. bonus: Add bonus points for specific criteria

Return JSON array only:
[{
  "type": "rule_type",
  "condition": "What must be true for this rule to apply",
  "adjustment": number (-50 to +50, 0 for disqualify),
  "reasoning": "Why this rule exists"
}]

Examples:
- "Prioritize buyers with residential focus" → service_adjustment, +15 if residential services
- "Exclude anyone outside the Northeast" → geography_adjustment, disqualify if not in NE states
- "Give 10 extra points for add-on appetite" → bonus, +10 if has add-on focus`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Parse these scoring instructions into structured rules:\n\n"${instructions}"\n\n${deal ? `Deal context: ${JSON.stringify(deal)}` : ''}`
          }
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const content = result.content?.[0]?.text || '';

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const rules: ScoringRule[] = JSON.parse(jsonMatch[0]);
      
      // Validate rules
      const validatedRules = rules.filter(rule => 
        ['service_adjustment', 'geography_adjustment', 'size_adjustment', 'disqualify', 'bonus'].includes(rule.type) &&
        typeof rule.adjustment === 'number' &&
        rule.adjustment >= -50 && rule.adjustment <= 50
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          rules: validatedRules,
          originalInstructions: instructions
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Failed to parse instructions into rules' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in parse-scoring-instructions:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
