import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

interface ScoringRule {
  type: 'service_adjustment' | 'geography_adjustment' | 'size_adjustment' | 'disqualify' | 'bonus';
  condition: string;
  adjustment: number;
  reasoning: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const { dealId, instructions } = await req.json();

    if (!dealId || !instructions) {
      return new Response(
        JSON.stringify({ error: 'dealId and instructions are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured — returning keyword-based fallback rules');
      const fallbackRules = parseInstructionsKeywordFallback(instructions);
      return new Response(
        JSON.stringify({ success: true, rules: fallbackRules, originalInstructions: instructions, method: 'keyword_fallback' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: deal } = await supabase
      .from('listings')
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

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(GEMINI_API_KEY),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Parse these scoring instructions into structured rules:\n\n"${instructions}"\n\n${deal ? `Deal context: ${JSON.stringify(deal)}` : ''}`
          }
        ],
        temperature: 0,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      const fallbackRules = parseInstructionsKeywordFallback(instructions);
      return new Response(
        JSON.stringify({ success: true, rules: fallbackRules, originalInstructions: instructions, method: 'keyword_fallback' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const rules: ScoringRule[] = JSON.parse(jsonMatch[0]);
      
      const validatedRules = rules.filter(rule => 
        ['service_adjustment', 'geography_adjustment', 'size_adjustment', 'disqualify', 'bonus'].includes(rule.type) &&
        typeof rule.adjustment === 'number' &&
        rule.adjustment >= -50 && rule.adjustment <= 50
      );

      return new Response(
        JSON.stringify({ success: true, rules: validatedRules, originalInstructions: instructions }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Failed to parse instructions into rules' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in parse-scoring-instructions:', error);
    try {
      const { instructions: rawInstructions } = await req.clone().json().catch(() => ({ instructions: '' }));
      if (rawInstructions) {
        const fallbackRules = parseInstructionsKeywordFallback(rawInstructions);
        return new Response(
          JSON.stringify({ success: true, rules: fallbackRules, originalInstructions: rawInstructions, method: 'keyword_fallback' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch { /* ignore fallback errors */ }
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseInstructionsKeywordFallback(instructions: string): ScoringRule[] {
  const rules: ScoringRule[] = [];
  const lower = instructions.toLowerCase();

  if (lower.includes('quick close') || lower.includes('fast close') || lower.includes('60 day')) {
    rules.push({ type: 'bonus', condition: 'Buyer has fast close track record', adjustment: 10, reasoning: 'Quick close preference detected' });
  }
  if (lower.includes('owner wants to stay') || lower.includes('equity rollover') || lower.includes('owner transition')) {
    rules.push({ type: 'bonus', condition: 'Buyer supports owner transitions and equity rollovers', adjustment: 10, reasoning: 'Owner continuity preference detected' });
  }
  if (lower.includes('key employee') || lower.includes('retain management') || lower.includes('retain team')) {
    rules.push({ type: 'bonus', condition: 'Buyer retains existing management teams', adjustment: 8, reasoning: 'Employee retention preference detected' });
  }
  const excludeMatch = lower.match(/(?:no|exclude|avoid|not)\s+(pe|private equity|strategic|family office|drp)/);
  if (excludeMatch) {
    rules.push({ type: 'disqualify', condition: `Buyer is ${excludeMatch[1]}`, adjustment: 0, reasoning: `Exclusion of ${excludeMatch[1]} buyers detected` });
  }
  const prioritizeMatch = lower.match(/(?:prioritize|prefer|focus on|boost)\s+(.+?)(?:\.|$)/);
  if (prioritizeMatch) {
    rules.push({ type: 'bonus', condition: prioritizeMatch[1].trim(), adjustment: 10, reasoning: `Priority preference: ${prioritizeMatch[1].trim()}` });
  }

  return rules;
}