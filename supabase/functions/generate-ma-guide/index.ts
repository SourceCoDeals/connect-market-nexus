import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phase definitions for the 12-phase SSE streaming generator
const GENERATION_PHASES = [
  { id: '1a', name: 'Industry Definition', focus: 'NAICS codes, market size, industry segmentation' },
  { id: '1b', name: 'Terminology & Business Models', focus: 'Glossary, revenue models, operational structures' },
  { id: '1c', name: 'Industry Economics', focus: 'P&L benchmarks, unit economics, margin drivers' },
  { id: '1d', name: 'Ecosystem & Competitive Landscape', focus: 'Customers, suppliers, active acquirers, consolidation trends' },
  { id: '2a', name: 'Financial Attractiveness', focus: 'EBITDA categories, margin quality, revenue mix' },
  { id: '2b', name: 'Operational Attractiveness', focus: 'KPIs, management quality, technology systems' },
  { id: '2c', name: 'Strategic & Geographic', focus: 'Market tiers, geographic preferences, deal killers' },
  { id: '3a', name: 'Seller Evaluation Scorecards', focus: 'Scoring matrix, evaluation rubrics' },
  { id: '3b', name: 'Buyer Fit Criteria Summary', focus: 'Size/Service/Geography/Buyer Types - CRITICAL' },
  { id: '3c', name: 'Example Evaluation', focus: 'Worked example with scoring rationale' },
  { id: '4a', name: 'Structured Criteria Output', focus: 'Machine-parseable format for extraction' },
  { id: '4b', name: 'Quality Validation', focus: 'Completeness check and gap identification' },
];

interface QualityResult {
  passed: boolean;
  score: number;
  wordCount: number;
  tableCount: number;
  placeholderCount: number;
  hasCriteria: boolean;
  hasBuyerTypes: boolean;
  hasPrimaryFocus: boolean;
  missingElements: string[];
}

interface ExtractedCriteria {
  size_criteria: {
    revenue_min?: number;
    revenue_max?: number;
    ebitda_min?: number;
    ebitda_max?: number;
    locations_min?: number;
    locations_max?: number;
  };
  geography_criteria: {
    target_states?: string[];
    target_regions?: string[];
    coverage?: string;
  };
  service_criteria: {
    primary_focus?: string[];
    required_services?: string[];
    preferred_services?: string[];
    excluded_services?: string[];
    business_model?: string;
  };
  buyer_types_criteria: {
    include_pe_firms?: boolean;
    include_platforms?: boolean;
    include_strategic?: boolean;
    include_family_office?: boolean;
  };
}

// Quality validation function
function validateQuality(content: string): QualityResult {
  const wordCount = content.split(/\s+/).length;
  const tableCount = (content.match(/<table|^\|.*\|$/gm) || []).length;
  const placeholderPatterns = /\[X\]|\$\[X\]|X\.X|TBD|PLACEHOLDER|\[VALUE\]|\[INSERT\]/gi;
  const placeholderCount = (content.match(placeholderPatterns) || []).length;
  
  const hasCriteria = content.toLowerCase().includes('size criteria') || 
                      content.toLowerCase().includes('revenue') ||
                      content.toLowerCase().includes('ebitda');
  const hasBuyerTypes = content.toLowerCase().includes('buyer type') ||
                        content.toLowerCase().includes('pe firm') ||
                        content.toLowerCase().includes('platform');
  const hasPrimaryFocus = content.toLowerCase().includes('primary focus') ||
                          content.toLowerCase().includes('core service') ||
                          content.toLowerCase().includes('primary service');
  
  const missingElements: string[] = [];
  if (wordCount < 17500) missingElements.push('Word count below 17,500 target');
  if (tableCount < 10) missingElements.push('Need more data tables');
  if (placeholderCount > 10) missingElements.push('Too many placeholders remaining');
  if (!hasCriteria) missingElements.push('Missing size/financial criteria section');
  if (!hasBuyerTypes) missingElements.push('Missing buyer types section');
  if (!hasPrimaryFocus) missingElements.push('Missing primary focus definition');
  
  // Calculate weighted score
  let score = 0;
  score += Math.min(40, (wordCount / 21000) * 40); // Up to 40 points for word count
  score += Math.min(20, (tableCount / 14) * 20); // Up to 20 points for tables
  score += Math.max(0, 15 - (placeholderCount * 2)); // 15 points minus penalties for placeholders
  score += hasCriteria ? 10 : 0;
  score += hasBuyerTypes ? 8 : 0;
  score += hasPrimaryFocus ? 7 : 0;
  
  const passed = score >= 70 && hasPrimaryFocus && hasCriteria;
  
  return {
    passed,
    score: Math.round(score),
    wordCount,
    tableCount,
    placeholderCount,
    hasCriteria,
    hasBuyerTypes,
    hasPrimaryFocus,
    missingElements
  };
}

// Build context string from clarification answers
function buildClarificationContext(context: any): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  const parts: string[] = [];
  
  if (context.segments?.length > 0) {
    parts.push(`FOCUS SEGMENTS: ${context.segments.join(', ')}`);
  }
  if (context.example_companies) {
    parts.push(`EXAMPLE COMPANIES (for calibration): ${context.example_companies}`);
  }
  if (context.geography_focus) {
    parts.push(`GEOGRAPHIC FOCUS: ${context.geography_focus}`);
  }
  if (context.revenue_range) {
    parts.push(`TARGET SIZE: ${context.revenue_range} revenue`);
  }

  // Include any other custom answers
  Object.entries(context).forEach(([key, value]) => {
    if (!['segments', 'example_companies', 'geography_focus', 'revenue_range'].includes(key) && value) {
      const label = key.replace(/_/g, ' ').toUpperCase();
      parts.push(`${label}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }
  });

  if (parts.length === 0) return '';

  return `\n\nIMPORTANT CONTEXT FROM USER:\n${parts.join('\n')}\n\nUse these details to calibrate your understanding of the industry scale, service offerings, and market positioning. The example companies help establish the target profile - research what makes companies like these attractive acquisition targets.`;
}

// Generate phase content using AI
async function generatePhaseContent(
  phase: typeof GENERATION_PHASES[0],
  industryName: string,
  existingContent: string,
  apiKey: string,
  clarificationContext?: any
): Promise<string> {
  const contextStr = buildClarificationContext(clarificationContext);
  
  const systemPrompt = `You are an expert M&A advisor creating comprehensive industry research guides.
Generate detailed, actionable content for the specified phase of an M&A guide.
Use proper HTML formatting with h2, h3, h4 headings, tables, and bullet points.
Include specific numbers, ranges, and concrete examples wherever possible.
Target 2,000-3,000 words per phase.
Do NOT use placeholders like [X] or TBD - use realistic example values.${contextStr}`;

  const phasePrompts: Record<string, string> = {
    '1a': `## PHASE 1A: INDUSTRY DEFINITION

Generate comprehensive content for "${industryName}" covering:
1. NAICS codes and industry classification
2. Total addressable market size with breakdowns
3. Industry segmentation (by service, geography, customer type)
4. Key industry associations and trade groups
5. Regulatory environment overview

Include at least 2 data tables.`,

    '1b': `## PHASE 1B: TERMINOLOGY & BUSINESS MODELS

For "${industryName}", create:
1. Comprehensive glossary of industry-specific terms (30+ terms)
2. Common business model variants
3. Revenue model breakdowns (recurring vs. project vs. service)
4. Operational structure patterns
5. Key differentiators between business types

Format the glossary as a definition list.`,

    '1c': `## PHASE 1C: INDUSTRY ECONOMICS

For "${industryName}", detail:
1. Typical P&L structure with benchmarks
2. Unit economics by business size
3. Margin drivers and detractors
4. Working capital requirements
5. CapEx patterns and equipment needs
6. Labor economics and wage trends

Include a benchmark P&L table.`,

    '1d': `## PHASE 1D: ECOSYSTEM & COMPETITIVE LANDSCAPE

For "${industryName}", cover:
1. Customer segments and buying patterns
2. Supplier landscape and key vendors
3. Active acquirers (PE firms, platforms, strategics)
4. Recent transaction activity and multiples
5. Consolidation trends and drivers
6. Market concentration analysis

Include a table of recent transactions if applicable.`,

    '2a': `## PHASE 2A: FINANCIAL ATTRACTIVENESS CRITERIA

For "${industryName}", define:
1. EBITDA attractiveness tiers (A/B/C/D)
2. Revenue quality indicators
3. Margin quality assessment framework
4. Revenue mix optimization targets
5. Financial red flags and deal killers
6. Valuation multiple drivers

Create a scoring rubric table.`,

    '2b': `## PHASE 2B: OPERATIONAL ATTRACTIVENESS CRITERIA

For "${industryName}", specify:
1. Key operational KPIs and benchmarks
2. Management team evaluation criteria
3. Technology and systems requirements
4. Customer concentration thresholds
5. Employee metrics and retention
6. Quality and safety indicators

Include KPI benchmark tables.`,

    '2c': `## PHASE 2C: STRATEGIC & GEOGRAPHIC CRITERIA

For "${industryName}", outline:
1. Geographic market tier definitions (Tier 1/2/3)
2. Regional preference frameworks
3. Market density requirements
4. Strategic fit factors
5. Absolute deal killers checklist
6. Growth market identification

Create a geographic scoring matrix.`,

    '3a': `## PHASE 3A: SELLER EVALUATION SCORECARDS

For "${industryName}", create:
1. Comprehensive scoring matrix (0-100 scale)
2. Category weights and rationale
3. Individual factor rubrics
4. Scoring examples and edge cases
5. Threshold definitions (pass/fail)
6. Adjustment factors

Include complete scorecard template.`,

    '3b': `## PHASE 3B: BUYER FIT CRITERIA SUMMARY (CRITICAL)

For "${industryName}", define the complete buyer universe criteria:

### SIZE CRITERIA
- Revenue ranges: minimum, maximum, sweet spot
- EBITDA ranges: minimum, maximum, with rationale
- Location count requirements by buyer type
- Employee count considerations

### SERVICE CRITERIA
- **PRIMARY FOCUS**: The core service lines that buyers MUST target (this is critical for scoring)
- Required services for consideration
- Preferred services that add value
- Excluded services (deal breakers)
- Business model requirements

### GEOGRAPHY CRITERIA
- Target regions and states with priority rankings
- Coverage type preferences (local/regional/national)
- HQ location requirements
- Expansion adjacency preferences

### BUYER TYPES
- PE Firm fit characteristics
- Platform company requirements
- Strategic acquirer profiles
- Family office considerations

Be SPECIFIC with numbers and ranges, not vague.`,

    '3c': `## PHASE 3C: EXAMPLE EVALUATION

For "${industryName}", create a worked example:
1. Sample target company profile
2. Complete scoring walkthrough
3. Category-by-category analysis
4. Final recommendation with rationale
5. Key discussion points
6. Risk assessment summary

Show the math and reasoning.`,

    '4a': `## PHASE 4A: STRUCTURED CRITERIA OUTPUT

Generate machine-parseable criteria in this exact format:

---BEGIN CRITERIA---
SIZE_CRITERIA:
- revenue_min: [number in dollars]
- revenue_max: [number in dollars]
- ebitda_min: [number in dollars]
- ebitda_max: [number in dollars]
- locations_min: [number]
- locations_max: [number]

SERVICE_CRITERIA:
- primary_focus: [comma-separated list of core services - REQUIRED]
- required_services: [comma-separated list]
- preferred_services: [comma-separated list]
- excluded_services: [comma-separated list]
- business_model: [description]

GEOGRAPHY_CRITERIA:
- target_states: [comma-separated list]
- target_regions: [comma-separated list]
- coverage: [local|regional|national]

BUYER_TYPES:
- include_pe_firms: [true|false]
- include_platforms: [true|false]
- include_strategic: [true|false]
- include_family_office: [true|false]
---END CRITERIA---

Use actual values based on the industry analysis.`,

    '4b': `## PHASE 4B: QUALITY VALIDATION

Perform a final quality check:
1. Verify all criteria sections are populated
2. Check for any remaining placeholders
3. Confirm primary_focus is defined
4. Validate number ranges are realistic
5. Ensure buyer types are configured

Provide a validation summary.`
  };

  const userPrompt = phasePrompts[phase.id] || `Generate content for ${phase.name}: ${phase.focus}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 5500
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Phase ${phase.id} generation failed:`, response.status, text);
    throw new Error(`Failed to generate phase ${phase.id}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

// Extract criteria from generated content using AI
async function extractCriteria(content: string, apiKey: string): Promise<ExtractedCriteria> {
  // First try regex extraction
  const criteriaMatch = content.match(/---BEGIN CRITERIA---([\s\S]*?)---END CRITERIA---/);
  if (criteriaMatch) {
    return parseCriteriaBlock(criteriaMatch[1]);
  }

  // Fallback to AI extraction with tool calling
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { 
          role: "system", 
          content: "Extract structured buyer universe criteria from the provided M&A guide content." 
        },
        { 
          role: "user", 
          content: `Extract criteria from this M&A guide:\n\n${content.slice(-15000)}` 
        }
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_criteria",
          description: "Extract structured buyer fit criteria",
          parameters: {
            type: "object",
            properties: {
              size_criteria: {
                type: "object",
                properties: {
                  revenue_min: { type: "number" },
                  revenue_max: { type: "number" },
                  ebitda_min: { type: "number" },
                  ebitda_max: { type: "number" },
                  locations_min: { type: "number" },
                  locations_max: { type: "number" }
                }
              },
              geography_criteria: {
                type: "object",
                properties: {
                  target_states: { type: "array", items: { type: "string" } },
                  target_regions: { type: "array", items: { type: "string" } },
                  coverage: { type: "string" }
                }
              },
              service_criteria: {
                type: "object",
                properties: {
                  primary_focus: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "REQUIRED: The core service lines this buyer universe targets"
                  },
                  required_services: { type: "array", items: { type: "string" } },
                  preferred_services: { type: "array", items: { type: "string" } },
                  excluded_services: { type: "array", items: { type: "string" } },
                  business_model: { type: "string" }
                },
                required: ["primary_focus"]
              },
              buyer_types_criteria: {
                type: "object",
                properties: {
                  include_pe_firms: { type: "boolean" },
                  include_platforms: { type: "boolean" },
                  include_strategic: { type: "boolean" },
                  include_family_office: { type: "boolean" }
                }
              }
            },
            required: ["size_criteria", "geography_criteria", "service_criteria", "buyer_types_criteria"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "extract_criteria" } }
    }),
  });

  if (!response.ok) {
    console.error("Criteria extraction failed");
    return getDefaultCriteria();
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      return getDefaultCriteria();
    }
  }
  return getDefaultCriteria();
}

function parseCriteriaBlock(block: string): ExtractedCriteria {
  const criteria: ExtractedCriteria = {
    size_criteria: {},
    geography_criteria: {},
    service_criteria: {},
    buyer_types_criteria: {}
  };

  // Parse each line
  const lines = block.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('SIZE_CRITERIA:')) currentSection = 'size';
    else if (trimmed.startsWith('SERVICE_CRITERIA:')) currentSection = 'service';
    else if (trimmed.startsWith('GEOGRAPHY_CRITERIA:')) currentSection = 'geography';
    else if (trimmed.startsWith('BUYER_TYPES:')) currentSection = 'buyer_types';
    else if (trimmed.startsWith('-')) {
      const [key, value] = trimmed.slice(1).split(':').map(s => s.trim());
      if (key && value) {
        const cleanValue = value.replace(/[\[\]]/g, '');
        
        if (currentSection === 'size') {
          const num = parseFloat(cleanValue.replace(/[,$]/g, ''));
          if (!isNaN(num)) {
            (criteria.size_criteria as any)[key] = num;
          }
        } else if (currentSection === 'geography') {
          if (key === 'coverage') {
            criteria.geography_criteria.coverage = cleanValue;
          } else {
            (criteria.geography_criteria as any)[key] = cleanValue.split(',').map(s => s.trim()).filter(Boolean);
          }
        } else if (currentSection === 'service') {
          if (key === 'business_model') {
            criteria.service_criteria.business_model = cleanValue;
          } else {
            (criteria.service_criteria as any)[key] = cleanValue.split(',').map(s => s.trim()).filter(Boolean);
          }
        } else if (currentSection === 'buyer_types') {
          (criteria.buyer_types_criteria as any)[key] = cleanValue.toLowerCase() === 'true';
        }
      }
    }
  }

  return criteria;
}

function getDefaultCriteria(): ExtractedCriteria {
  return {
    size_criteria: {},
    geography_criteria: {},
    service_criteria: { primary_focus: [] },
    buyer_types_criteria: {
      include_pe_firms: true,
      include_platforms: true,
      include_strategic: true,
      include_family_office: true
    }
  };
}

// Generate gap-fill content for missing elements
async function generateGapFill(
  missingElements: string[],
  industryName: string,
  apiKey: string
): Promise<string> {
  const prompt = `Generate additional M&A guide content to address these gaps for "${industryName}":
${missingElements.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Focus especially on:
- Primary focus services (core service lines the buyer universe targets)
- Specific numeric criteria (revenue ranges, EBITDA ranges)
- Buyer type configurations

Be comprehensive and specific.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are an M&A advisor filling gaps in an industry guide. Be specific and detailed." },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000
    }),
  });

  if (!response.ok) {
    throw new Error("Gap fill generation failed");
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const encoder = new TextEncoder();

  try {
    const { 
      industry_name, 
      universe_id, 
      existing_content, 
      clarification_context,
      stream = true 
    } = await req.json();

    if (!industry_name) {
      return new Response(
        JSON.stringify({ error: 'industry_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Generating M&A Guide for: ${industry_name}`, clarification_context ? 'with context' : 'without context');

    // If not streaming, generate all at once
    if (!stream) {
      let fullContent = '';
      for (const phase of GENERATION_PHASES) {
        const phaseContent = await generatePhaseContent(phase, industry_name, fullContent, LOVABLE_API_KEY, clarification_context);
        fullContent += phaseContent + '\n\n';
      }
      
      const quality = validateQuality(fullContent);
      const criteria = await extractCriteria(fullContent, LOVABLE_API_KEY);
      
      return new Response(
        JSON.stringify({ 
          content: fullContent, 
          quality,
          criteria 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSE Streaming response
    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let fullContent = '';

        try {
          // Generate each phase
          for (let i = 0; i < GENERATION_PHASES.length; i++) {
            const phase = GENERATION_PHASES[i];
            
            // Send phase start
            send({ 
              type: 'phase_start', 
              phase: i + 1, 
              total: GENERATION_PHASES.length,
              id: phase.id,
              name: phase.name 
            });

            // Generate phase content with clarification context
            const phaseContent = await generatePhaseContent(phase, industry_name, fullContent, LOVABLE_API_KEY, clarification_context);
            fullContent += phaseContent + '\n\n';

            // Send content chunks
            const chunks = phaseContent.match(/.{1,500}/g) || [];
            for (const chunk of chunks) {
              send({ type: 'content', content: chunk });
              // Small delay for smoother streaming
              await new Promise(r => setTimeout(r, 50));
            }

            // Send phase complete
            send({ 
              type: 'phase_complete', 
              phase: i + 1,
              wordCount: fullContent.split(/\s+/).length
            });
          }

          // Quality check
          send({ type: 'quality_check_start' });
          const quality = validateQuality(fullContent);
          send({ type: 'quality_check_result', result: quality });

          // Gap fill if needed
          if (!quality.passed && quality.missingElements.length > 0) {
            send({ type: 'gap_fill_start', missingElements: quality.missingElements });
            
            const gapContent = await generateGapFill(quality.missingElements, industry_name, LOVABLE_API_KEY);
            fullContent += '\n\n## GAP FILL CONTENT\n\n' + gapContent;
            
            // Stream gap fill content
            const chunks = gapContent.match(/.{1,500}/g) || [];
            for (const chunk of chunks) {
              send({ type: 'content', content: chunk });
              await new Promise(r => setTimeout(r, 50));
            }

            send({ type: 'gap_fill_complete' });

            // Re-validate
            const finalQuality = validateQuality(fullContent);
            send({ type: 'final_quality', result: finalQuality });
          }

          // Extract criteria
          send({ type: 'criteria_extraction_start' });
          const criteria = await extractCriteria(fullContent, LOVABLE_API_KEY);
          send({ type: 'criteria', criteria });

          // Complete
          send({ 
            type: 'complete', 
            totalWords: fullContent.split(/\s+/).length,
            content: fullContent
          });

        } catch (error) {
          send({ type: 'error', message: error.message });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Error generating MA Guide:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
