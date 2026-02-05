import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  ANTHROPIC_API_URL, 
  getAnthropicHeaders, 
  DEFAULT_CLAUDE_FAST_MODEL,
  toAnthropicTool,
  parseAnthropicToolResponse
} from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClarifyQuestion {
  id: string;
  question: string;
  type: 'select' | 'multiSelect' | 'text';
  options?: string[];
  placeholder?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry_name, industry_description } = await req.json();
    
    if (!industry_name) {
      return new Response(
        JSON.stringify({ error: 'industry_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context string from description if provided
    const descriptionContext = industry_description 
      ? `\n\nUser provided description: "${industry_description}"`
      : '';

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

const systemPrompt = `You are an M&A industry expert helping clarify the scope of an industry research guide.

Given an industry name, generate 3-4 targeted clarifying questions to ensure the guide covers exactly the right segment and scope.

Questions should:
1. Disambiguate sub-segments if the industry has multiple (e.g., "residential vs commercial", "water damage vs mold") - ALWAYS use type "multiSelect" for this question since buyers often focus on multiple segments
2. Ask for 1-2 example companies or websites to calibrate the scope (text input)
3. Confirm primary geographic focus - use type "multiSelect" since buyers may target multiple regions
4. Ask an open-ended question: "Is there anything else about this industry that would be helpful for our research?" (text input)

IMPORTANT: For questions about segments/types and geography, ALWAYS use type "multiSelect" (not "select") since users typically target multiple options.

DO NOT ask about revenue ranges or company sizes - we cover all sizes.
DO NOT ask about regulatory or licensing considerations - keep it general.

Return questions as JSON matching this schema exactly.`;

    const tool = toAnthropicTool({
      type: "function",
      function: {
        name: "generate_questions",
        description: "Generate clarifying questions for industry research",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { 
                    type: "string",
                    description: "Unique identifier like 'segment', 'examples', 'geography', 'size'" 
                  },
                  question: { 
                    type: "string",
                    description: "The question text to display"
                  },
                  type: { 
                    type: "string", 
                    enum: ["select", "multiSelect", "text"],
                    description: "select for single choice, multiSelect for multiple, text for free-form"
                  },
                  options: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Options for select/multiSelect types"
                  },
                  placeholder: {
                    type: "string",
                    description: "Placeholder text for text inputs"
                  }
                },
                required: ["id", "question", "type"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const requestBody = JSON.stringify({
      model: DEFAULT_CLAUDE_FAST_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: "user", content: `Generate clarifying questions for the industry: "${industry_name}"${descriptionContext}` }
      ],
      tools: [tool],
      tool_choice: { type: "tool", name: "generate_questions" }
    });

    // Retry logic for Anthropic API rate limits
    const MAX_RETRIES = 3;
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: getAnthropicHeaders(ANTHROPIC_API_KEY),
        body: requestBody,
      });

      if (response.status !== 429 && response.status !== 529) break;

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.log(`[clarify-industry] Rate limited (${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (!response!.ok) {
      if (response!.status === 429 || response!.status === 529) {
        return new Response(
          JSON.stringify({ error: "AI service busy. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response!.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const text = await response!.text();
      console.error("AI API error:", response!.status, text);
      throw new Error(`AI API error: ${response!.status}`);
    }

    const result = await response!.json();
    const extracted = parseAnthropicToolResponse(result) as { questions?: ClarifyQuestion[] } | null;
    
    let questions: ClarifyQuestion[] = extracted?.questions || [];

    // Ensure we always have meaningful questions
    if (questions.length === 0) {
      questions = getDefaultQuestions(industry_name);
    }

    // Always include example companies question if not present
    if (!questions.find(q => q.id === 'examples')) {
      questions.push({
        id: 'examples',
        question: `Name 1-2 example companies in the ${industry_name} space you would consider "good targets"`,
        type: 'text',
        placeholder: 'e.g., ServiceMaster, Belfor Holdings'
      });
    }

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Clarify industry error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getDefaultQuestions(industryName: string): ClarifyQuestion[] {
  return [
    {
      id: 'segment',
      question: `Which segment of ${industryName} are you targeting?`,
      type: 'multiSelect',
      options: [
        'Full-service (all segments)',
        'Residential focused',
        'Commercial focused',
        'Specialty/niche services'
      ]
    },
    {
      id: 'examples',
      question: `Name 1-2 example companies you would consider "good targets"`,
      type: 'text',
      placeholder: 'e.g., Company A, Company B, or website URLs'
    },
    {
      id: 'geography',
      question: 'What is the primary geographic focus?',
      type: 'multiSelect',
      options: [
        'National (all US)',
        'Regional - Northeast',
        'Regional - Southeast', 
        'Regional - Midwest',
        'Regional - Southwest',
        'Regional - West Coast',
        'Specific states only'
      ]
    },
    {
      id: 'additional_context',
      question: 'Is there anything else about this industry that would be helpful for our research?',
      type: 'text',
      placeholder: 'e.g., key trends, important distinctions, specific focus areas...'
    }
  ];
}
