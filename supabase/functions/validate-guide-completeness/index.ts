import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
  warnings: string[];
  metadata: {
    wordCount: number;
    hasAllPhases: boolean;
    hasPlaceholders: boolean;
    placeholderCount: number;
    hasBuyerProfiles: boolean;
    hasCriteria: boolean;
    hasPrimaryFocus: boolean;
    missingSections: string[];
  };
}

const REQUIRED_PHASES = [
  '1a', '1b', '1c', '1d', '1e',
  '2a', '2b', '2c',
  '3a', '3b', '3c',
  '4a', '4b'
];

const PLACEHOLDER_PATTERNS = /\[X\]|\$\[X\]|X\.X|TBD|PLACEHOLDER|\[VALUE\]|\[INSERT\]|\[NUMBER\]|\[TEXT\]/gi;

/**
 * Validate that a generated M&A guide meets quality standards
 *
 * POST /functions/v1/validate-guide-completeness
 * {
 *   "content": "...generated guide content..."
 * }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid content parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = validateGuide(content);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating guide:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function validateGuide(content: string): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Check word count
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 20000) {
    issues.push(`Content too short: ${wordCount} words (minimum 20,000)`);
    score -= 20;
  } else if (wordCount < 25000) {
    warnings.push(`Content on lower side: ${wordCount} words (recommended 25,000+)`);
  }

  // Check for placeholders
  const placeholderMatches = content.match(PLACEHOLDER_PATTERNS);
  const placeholderCount = placeholderMatches?.length || 0;
  if (placeholderCount > 0) {
    issues.push(`Found ${placeholderCount} placeholder values (should be 0)`);
    score -= Math.min(30, placeholderCount * 2);
  }

  // Check for all required phases
  const missingSections: string[] = [];
  const phasesPresent = new Set<string>();
  for (const phase of REQUIRED_PHASES) {
    const phaseRegex = new RegExp(`PHASE ${phase.toUpperCase()}|##\\s*PHASE\\s*${phase.toUpperCase()}`, 'i');
    if (phaseRegex.test(content)) {
      phasesPresent.add(phase);
    } else {
      missingSections.push(phase);
    }
  }

  if (missingSections.length > 0) {
    issues.push(`Missing ${missingSections.length} required phases: ${missingSections.join(', ')}`);
    score -= 25;
  }

  // Check for buyer profiles
  const hasBuyerProfiles = /BUYER_\d+|BUYER PROFILE|buyer type/i.test(content);
  if (!hasBuyerProfiles) {
    issues.push('No buyer profiles found');
    score -= 15;
  }

  // Check for criteria section
  const hasCriteria = /---BEGIN CRITERIA---|SIZE_CRITERIA|GEOGRAPHY_CRITERIA|SERVICE_CRITERIA/i.test(content);
  if (!hasCriteria) {
    warnings.push('No structured criteria section found');
  }

  // Check for primary focus
  const hasPrimaryFocus = /primary focus|primary_focus/i.test(content);
  if (!hasPrimaryFocus) {
    issues.push('Primary focus not defined');
    score -= 10;
  }

  // Check for tables (should have some structure)
  const tableCount = (content.match(/<table|^\|.*\|$/gm) || []).length;
  if (tableCount === 0) {
    warnings.push('No tables found (recommend 3-5 data tables for structure)');
  }

  // Check for proper formatting
  if (!content.includes('##') && !content.includes('<h2')) {
    issues.push('No heading structure detected (should use ## or <h2>)');
    score -= 10;
  }

  // Check for financial data
  if (!/revenue|ebitda|margin|ebitda margin|\$|%.*profit/i.test(content)) {
    warnings.push('Limited financial metrics found');
  }

  // Ensure score is within 0-100
  score = Math.max(0, Math.min(100, score));
  const passed = issues.length === 0 && score >= 70;

  return {
    passed,
    score,
    issues,
    warnings,
    metadata: {
      wordCount,
      hasAllPhases: missingSections.length === 0,
      hasPlaceholders: placeholderCount > 0,
      placeholderCount,
      hasBuyerProfiles,
      hasCriteria,
      hasPrimaryFocus,
      missingSections,
    },
  };
}
