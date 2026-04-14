import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  callGeminiWithTool,
  callGeminiWithRetry,
  DEFAULT_GEMINI_MODEL,
  GEMINI_API_URL,
  getGeminiHeaders,
  getGeminiApiKey,
} from '../_shared/ai-providers.ts';

import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';

const INTEL_BUCKET = 'portal-intelligence-docs';

interface ThesisExtractionRequest {
  portal_intelligence_doc_id: string;
}

interface DocumentContent {
  text?: string;
  base64?: string;
  mimeType?: string;
}

interface ExtractedThesis {
  industry_label: string;
  industry_keywords: string[];
  ebitda_min: number | null;
  ebitda_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  employee_min: number | null;
  employee_max: number | null;
  target_states: string[];
  priority: number;
  notes: string | null;
  confidence: number;
  source_excerpt: string | null;
}

interface ExtractionResult {
  theses: ExtractedThesis[];
  overall_confidence: number;
  extraction_notes: string | null;
}

/**
 * Download a portal intelligence file from Supabase storage and return either
 * decoded text (for text-like files) or base64 + mime type (for binary formats
 * that Gemini can ingest natively as multimodal input).
 */
async function downloadIntelligenceFile(storagePath: string): Promise<DocumentContent> {
  console.log(`[DOCUMENT_FETCH] Downloading from bucket "${INTEL_BUCKET}": "${storagePath}"`);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const decodedPath = decodeURIComponent(storagePath);
  const { data, error } = await supabase.storage.from(INTEL_BUCKET).download(decodedPath);

  if (error || !data) {
    const errName = (error as { name?: string })?.name || 'Unknown';
    const errMsg =
      error?.message || (error as { statusCode?: string })?.statusCode || JSON.stringify(error);
    console.error(`[DOCUMENT_FETCH] Storage error (${errName}):`, JSON.stringify(error));
    throw new Error(
      `Failed to download intelligence doc at "${decodedPath}": ${errName} - ${errMsg}. The file may have been removed from storage.`,
    );
  }

  const buffer = await data.arrayBuffer();
  const ext = decodedPath.split('.').pop()?.toLowerCase() || '';
  console.log(`[DOCUMENT_FETCH] Downloaded ${buffer.byteLength} bytes, ext="${ext}"`);

  const binaryFormats = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'];
  if (binaryFormats.includes(ext)) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    return { base64, mimeType };
  }

  const text = new TextDecoder().decode(buffer);
  return { text };
}

const THESIS_TOOL = {
  type: 'function',
  function: {
    name: 'extract_portal_thesis_criteria',
    description:
      'Extract a list of structured thesis criteria (one row per industry vertical) from a buyer intelligence document.',
    parameters: {
      type: 'object',
      properties: {
        theses: {
          type: 'array',
          description:
            'One entry per distinct industry vertical / thesis the document describes. Split multi-vertical PE mandates into separate entries so each maps cleanly to a row in portal_thesis_criteria.',
          items: {
            type: 'object',
            properties: {
              industry_label: {
                type: 'string',
                description:
                  'Human-friendly label for this thesis, e.g. "Residential HVAC" or "Commercial Landscaping". Prefer 2-4 words.',
              },
              industry_keywords: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Specific services / niches / sub-industries the buyer will consider. Used for keyword-based matching, so be specific and avoid generic terms.',
              },
              ebitda_min: {
                type: 'number',
                description:
                  'Minimum EBITDA in raw dollars. $2.5M -> 2500000. OMIT the field entirely if not stated.',
              },
              ebitda_max: {
                type: 'number',
                description: 'Maximum EBITDA in raw dollars. OMIT if not stated.',
              },
              revenue_min: {
                type: 'number',
                description: 'Minimum revenue in raw dollars. OMIT if not stated.',
              },
              revenue_max: {
                type: 'number',
                description: 'Maximum revenue in raw dollars. OMIT if not stated.',
              },
              employee_min: {
                type: 'number',
                description: 'Minimum headcount if specified. OMIT if not stated.',
              },
              employee_max: {
                type: 'number',
                description: 'Maximum headcount if specified. OMIT if not stated.',
              },
              target_states: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Two-letter US state abbreviations (e.g. ["OH", "PA"]). Empty array means national / no geographic preference. Convert full state names, regions, or countries into the closest 2-letter codes; leave empty if only non-US geography is mentioned.',
              },
              priority: {
                type: 'number',
                description:
                  'Priority 1-5 where 1 is highest priority. Default 3 unless the document explicitly flags a thesis as primary or secondary focus.',
              },
              notes: {
                type: 'string',
                description:
                  'Short 1-2 sentence summary of any extra context, exclusions, preferred deal structure, or quality gates for this thesis. OMIT if nothing to add.',
              },
              confidence: {
                type: 'number',
                description:
                  'Confidence 0-100 in this specific thesis row. 90+ = explicit, fully-specified; 70-89 = clearly stated with most fields; 50-69 = partial / inferred; below 50 = mostly guessed.',
              },
              source_excerpt: {
                type: 'string',
                description:
                  'Short verbatim quote (max ~200 chars) from the document that supports this thesis row, so a human reviewer can verify quickly. OMIT if no clear supporting quote.',
              },
            },
            required: ['industry_label', 'industry_keywords', 'confidence'],
          },
        },
        overall_confidence: {
          type: 'number',
          description: 'Overall 0-100 confidence in the extraction as a whole.',
        },
        extraction_notes: {
          type: 'string',
          description:
            'Anything the reviewer should know: gaps, ambiguities, or sections of the document that were ignored because they were not thesis-relevant. OMIT if nothing to flag.',
        },
      },
      required: ['theses', 'overall_confidence'],
    },
  },
};

function buildPrompts(docTitle: string, docType: string) {
  const systemPrompt = `You are an expert M&A analyst extracting a private-equity buyer's investment thesis from internal notes, meeting transcripts, thesis memos, or PE firm briefing documents.

RULES:
1. ONE THESIS PER VERTICAL: If the buyer targets multiple verticals (e.g. "HVAC, Plumbing, and Electrical"), produce ONE entry per vertical when they have distinct criteria, or ONE grouped entry when the criteria are identical across verticals. Prefer splitting when in doubt — reviewers can merge.

2. FINANCIAL NUMBERS AS RAW INTEGERS: Always raw dollars.
   - "$2.5M+ revenue" -> revenue_min: 2500000, revenue_max: null
   - "EBITDA $750K-$3M" -> ebitda_min: 750000, ebitda_max: 3000000
   - "10-50 employees" -> employee_min: 10, employee_max: 50

3. GEOGRAPHY:
   - Two-letter uppercase state codes only.
   - "US" / "United States" / "National" -> empty target_states array.
   - "Southeast" -> expand to the states normally considered part of that region.
   - Non-US geography -> leave empty and mention in notes.

4. INDUSTRY KEYWORDS SHOULD BE SPECIFIC. "Services" is too broad; "mechanical contractor" is good. Include sub-industries, technical services, and customer-segment qualifiers.

5. CONFIDENCE SCORING:
   - 90-100: Thesis explicitly stated with specific numeric ranges and clear industry language.
   - 70-89: Clearly stated but one or two fields inferred.
   - 50-69: Partial — you're stitching together hints.
   - Below 50: Mostly inferred, flag for reviewer.

6. DO NOT INVENT FIELDS. If the document says nothing about EBITDA, leave ebitda_min and ebitda_max as null. Reviewers can fill in gaps manually — silent guesses are worse than missing data.

7. IGNORE DEAL-SPECIFIC CONTENT. This document may be a transcript or memo that also discusses specific companies or deals in passing. Focus strictly on the buyer's general acquisition thesis, not on individual targets.

8. SOURCE EXCERPTS: For each thesis row, include a short quote (~1 sentence) from the document that a human can verify at a glance.`;

  const userPrompt = `Extract the buyer's investment thesis from the following intelligence document.

Document title: "${docTitle}"
Document type: ${docType}

Produce one or more thesis rows suitable for saving to a portal_thesis_criteria table. Reviewers will see your output in a checklist before anything is persisted, so optimize for precision over recall.`;

  return { systemPrompt, userPrompt };
}

async function runExtraction(
  content: DocumentContent,
  inlineContent: string | null,
  docTitle: string,
  docType: string,
): Promise<ExtractionResult> {
  const { systemPrompt, userPrompt } = buildPrompts(docTitle, docType);
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('OPENROUTER_API_KEY / GEMINI_API_KEY not configured');
  }

  // Binary document — use Gemini multimodal so we don't need to OCR locally.
  if (content.base64 && content.mimeType) {
    console.log(`[EXTRACTION] Multimodal mode (${content.mimeType})`);
    const fullPrompt = `${userPrompt}\n\nThe attached file is the document to analyze.${inlineContent ? `\n\nADDITIONAL FREE-FORM NOTES (user also typed these into the doc record):\n${inlineContent.slice(0, 10_000)}` : ''}`;

    const response = await callGeminiWithRetry(
      GEMINI_API_URL,
      getGeminiHeaders(geminiApiKey),
      {
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: docTitle,
                  file_data: `data:${content.mimeType};base64,${content.base64}`,
                },
              },
              { type: 'text', text: fullPrompt },
            ],
          },
        ],
        tools: [THESIS_TOOL],
        tool_choice: { type: 'function', function: { name: THESIS_TOOL.function.name } },
        temperature: 0,
        max_tokens: 4096,
      },
      120_000,
      'Gemini/portal-thesis',
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini multimodal error: ${response.status}`, errText.substring(0, 500));
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const responseData = await response.json();
    const toolCalls = responseData.choices?.[0]?.message?.tool_calls;
    if (!toolCalls?.length) {
      throw new Error('Gemini did not return a tool call for the intelligence doc');
    }
    return JSON.parse(toolCalls[0].function.arguments) as ExtractionResult;
  }

  // Text path — either the raw file text, the inline `content` column, or both.
  const textParts: string[] = [];
  if (content.text) textParts.push(`FILE CONTENT:\n${content.text.slice(0, 40_000)}`);
  if (inlineContent) textParts.push(`INLINE NOTES:\n${inlineContent.slice(0, 10_000)}`);
  const combinedText = textParts.join('\n\n---\n\n');

  if (!combinedText.trim()) {
    throw new Error(
      'Intelligence doc has no text content to extract from (no file and no inline notes).',
    );
  }

  const fullUserPrompt = `${userPrompt}\n\nDOCUMENT:\n${combinedText}`;

  const result = await callGeminiWithTool(
    systemPrompt,
    fullUserPrompt,
    THESIS_TOOL,
    geminiApiKey,
    DEFAULT_GEMINI_MODEL,
    60_000,
    4096,
  );

  if (!result.data) {
    throw new Error(result.error?.message || 'No thesis data extracted from document');
  }
  return result.data as unknown as ExtractionResult;
}

/**
 * Normalize and clamp the AI output so it always matches the portal_thesis_criteria
 * schema. This is the last line of defense against hallucinated field shapes.
 */
function normalizeThesis(raw: Partial<ExtractedThesis> & Record<string, unknown>): ExtractedThesis {
  const toInt = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$]/g, ''));
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const toStringArray = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  };

  const states = toStringArray(raw.target_states)
    .map((s) => s.toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));

  const priorityRaw = Number(raw.priority);
  const priority = Number.isFinite(priorityRaw)
    ? Math.min(5, Math.max(1, Math.round(priorityRaw)))
    : 3;

  const confidenceRaw = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(100, Math.max(0, Math.round(confidenceRaw)))
    : 50;

  return {
    industry_label: String(raw.industry_label ?? '').trim() || 'Untitled thesis',
    industry_keywords: toStringArray(raw.industry_keywords),
    ebitda_min: toInt(raw.ebitda_min),
    ebitda_max: toInt(raw.ebitda_max),
    revenue_min: toInt(raw.revenue_min),
    revenue_max: toInt(raw.revenue_max),
    employee_min: toInt(raw.employee_min),
    employee_max: toInt(raw.employee_max),
    target_states: states,
    priority,
    notes: raw.notes ? String(raw.notes).slice(0, 1000) : null,
    confidence,
    source_excerpt: raw.source_excerpt ? String(raw.source_excerpt).slice(0, 500) : null,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { portal_intelligence_doc_id }: ThesisExtractionRequest = await req.json();
    if (!portal_intelligence_doc_id) {
      throw new Error('Missing required field: portal_intelligence_doc_id');
    }

    console.log(`[REQUEST] intelligence_doc_id=${portal_intelligence_doc_id}`);

    const { data: doc, error: docError } = await supabase
      .from('portal_intelligence_docs')
      .select('id, portal_org_id, doc_type, title, content, file_url, file_name, file_type')
      .eq('id', portal_intelligence_doc_id)
      .single();

    if (docError || !doc) {
      throw new Error(
        `Intelligence doc not found: ${docError?.message || portal_intelligence_doc_id}`,
      );
    }

    // Pull either the uploaded file or the inline content. At least one must be present.
    let fileContent: DocumentContent = {};
    if (doc.file_url) {
      fileContent = await downloadIntelligenceFile(doc.file_url);
    }

    if (!doc.file_url && !doc.content?.trim()) {
      throw new Error('Intelligence doc has no file and no inline content to extract from.');
    }

    const startTime = Date.now();
    const rawResult = await runExtraction(
      fileContent,
      doc.content ?? null,
      doc.title || doc.file_name || 'Intelligence doc',
      doc.doc_type || 'general_notes',
    );

    const duration = Date.now() - startTime;
    console.log(`[EXTRACTION_COMPLETE] ${duration}ms`);

    const theses = Array.isArray(rawResult.theses)
      ? rawResult.theses.map(normalizeThesis).filter((t) => t.industry_keywords.length > 0)
      : [];

    const overallConfidence = Number.isFinite(rawResult.overall_confidence)
      ? Math.min(100, Math.max(0, Math.round(rawResult.overall_confidence)))
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        portal_org_id: doc.portal_org_id,
        portal_intelligence_doc_id: doc.id,
        theses,
        overall_confidence: overallConfidence,
        extraction_notes: rawResult.extraction_notes ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: unknown) {
    console.error('[ERROR]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
