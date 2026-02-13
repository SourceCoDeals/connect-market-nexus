import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createEdgeTimeoutSignal } from "../_shared/edge-timeout.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeState, normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources, createFieldSource } from "../_shared/source-priority.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";
import { validateUrl, ssrfErrorResponse } from "../_shared/security.ts";
import { logAICallCost } from "../_shared/cost-tracker.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

// Financial confidence levels per spec
type FinancialConfidence = 'high' | 'medium' | 'low';

interface ExtractedFinancial {
  value?: number;
  confidence: FinancialConfidence;
  is_inferred?: boolean;
  source_quote?: string;
  inference_method?: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return String((error as any).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

// Only allow updates to real listings columns (prevents schema-cache 500s)
// NOTE: 'location' is intentionally excluded - it's for marketplace anonymity
const VALID_LISTING_UPDATE_KEYS = new Set([
  'internal_company_name', // extracted company name
  'title', // fallback if internal_company_name not set
  'executive_summary',
  'services',
  'service_mix',
  'business_model',
  'industry',
  'geographic_states',
  'number_of_locations',
  // Structured address fields (for remarketing accuracy)
  'street_address',
  'address_city',
  'address_state',
  'address_zip',
  'address_country',
  'address', // legacy full address field
  'headquarters_address',
  'founded_year',
  'full_time_employees',
  'part_time_employees',
  'website',
  'customer_types',
  'end_market_description',
  'customer_concentration',
  'customer_geography',
  'owner_goals',
  'ownership_structure',
  'transition_preferences',
  'special_requirements',
  'timeline_notes',
  'key_risks',
  'competitive_position',
  'technology_systems',
  'real_estate_info',
  'growth_trajectory',
  'key_quotes',
  'primary_contact_name',
  'primary_contact_email',
  'primary_contact_phone',
  // LinkedIn data from Apify
  'linkedin_employee_count',
  'linkedin_employee_range',
  'linkedin_url', // Extracted from website or entered manually
  // Financial tracking fields per spec
  'revenue',
  'ebitda',
  'revenue_confidence',
  'revenue_is_inferred',
  'revenue_source_quote',
  'ebitda_margin',
  'ebitda_confidence',
  'ebitda_is_inferred',
  'ebitda_source_quote',
  'financial_notes',
  'financial_followup_questions',
]);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const _edgeStartTime = Date.now();
    const _edgeTimeout = createEdgeTimeoutSignal(_edgeStartTime);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Edge Gateway routing requires the anon key in the `apikey` header.
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseAnonKey) {
      console.error('SUPABASE_ANON_KEY is not set — internal function calls will fail');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: SUPABASE_ANON_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dealId, forceReExtract = false, skipExternalEnrichment = false } = await req.json();

    if (!dealId) {
      return new Response(
        JSON.stringify({ error: 'Missing dealId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pre-flight check for GEMINI_API_KEY (used by extract-deal-transcript)
    if (!geminiApiKey) {
      console.error('[enrich-deal] GEMINI_API_KEY is not set — transcript extraction will fail');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GEMINI_API_KEY is not configured. Please add it to Supabase Edge Function secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the deal/listing with extraction_sources (includes version for optimistic lock)
    const { data: deal, error: dealError } = await supabase
      .from('listings')
      .select('*, extraction_sources')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: 'Deal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STEP 0: Transcripts (highest priority)
    // - Apply ALREADY extracted transcript intelligence to the listing first
    // - Then process any truly unprocessed transcripts (processed_at is null)
    // ========================================================================

    // Fetch ALL transcripts for this deal (we need the full picture for reporting)
    const { data: allTranscripts, error: transcriptsError } = await supabase
      .from('deal_transcripts')
      .select('id, transcript_text, processed_at, extracted_data, applied_to_deal, source, fireflies_transcript_id, transcript_url')
      .eq('listing_id', dealId)
      .order('created_at', { ascending: false });

    let transcriptsProcessed = 0;
    let transcriptsAppliedFromExisting = 0;
    const transcriptErrors: string[] = [];
    const transcriptFieldNames: string[] = []; // Track which fields transcripts applied

    // Reporting fields (returned to UI)
    const transcriptReport = {
      totalTranscripts: allTranscripts?.length || 0,
      processable: 0, // pending w/ sufficient text
      skipped: 0, // pending but too short/placeholder
      processed: 0, // processed (LLM) this run
      appliedFromExisting: 0, // fields applied from already-extracted transcripts
      appliedFromExistingTranscripts: 0, // transcripts that contributed at least 1 applied field
      errors: [] as string[],
    };

    if (!transcriptsError && allTranscripts?.length) {
      const sample = allTranscripts.slice(0, 5).map((t) => ({
        id: t.id,
        processed_at: t.processed_at,
        text_len: t.transcript_text ? t.transcript_text.length : 0,
        has_extracted: !!t.extracted_data,
        applied_to_deal: t.applied_to_deal,
      }));
      console.log(`[Transcripts] fetched=${allTranscripts.length}`, sample);
    }

    // 0A) Apply existing extracted_data (even if applied_to_deal was previously true)
    // Rationale: older runs could mark transcripts processed/applied but fail to update listings.
    if (!transcriptsError && allTranscripts && allTranscripts.length > 0) {
      const transcriptsWithExtracted = allTranscripts.filter((t) => t.extracted_data && typeof t.extracted_data === 'object');

      if (transcriptsWithExtracted.length > 0) {
        const listingKeys = new Set(Object.keys(deal as Record<string, unknown>));
        let cumulativeUpdates: Record<string, unknown> = {};
        let cumulativeSources = deal.extraction_sources;

        const PLACEHOLDER_STRINGS = new Set([
          'unknown',
          '<unknown>',
          'n/a',
          'na',
          'not specified',
          'not provided',
          'none',
          'null',
          '-',
          '—',
        ]);

        const normalizePlaceholderString = (s: string): string =>
          s
            .trim()
            .toLowerCase()
            // common LLM placeholders like <UNKNOWN>
            .replace(/^<|>$/g, '')
            .trim();

        const isPlaceholder = (v: unknown): boolean => {
          if (typeof v !== 'string') return false;
          const raw = v.trim().toLowerCase();
          const normalized = normalizePlaceholderString(raw);
          return raw.length === 0 || PLACEHOLDER_STRINGS.has(raw) || PLACEHOLDER_STRINGS.has(normalized);
        };

        const toFiniteNumber = (v: unknown): number | undefined => {
          if (v === null || v === undefined) return undefined;
          if (typeof v === 'number' && Number.isFinite(v)) return v;
          if (typeof v === 'string') {
            if (isPlaceholder(v)) return undefined;
            const cleaned = v.replace(/[$,]/g, '').trim();
            const pct = cleaned.endsWith('%') ? cleaned.slice(0, -1).trim() : cleaned;
            const n = Number(pct);
            if (Number.isFinite(n)) return n;
          }
          return undefined;
        };

        const mapExtractedToListing = (extracted: any): Record<string, unknown> => {
          const out: Record<string, unknown> = {};

          // Structured revenue
          {
            const revenueValue = toFiniteNumber(extracted?.revenue?.value);
            if (revenueValue != null) {
              out.revenue = revenueValue;
              if (extracted?.revenue?.confidence) out.revenue_confidence = extracted.revenue.confidence;
              out.revenue_is_inferred = !!extracted?.revenue?.is_inferred;
              if (extracted?.revenue?.source_quote) out.revenue_source_quote = extracted.revenue.source_quote;
            }
          }

          // Structured EBITDA
          {
            const ebitdaAmount = toFiniteNumber(extracted?.ebitda?.amount);
            if (ebitdaAmount != null) out.ebitda = ebitdaAmount;

            const marginPct = toFiniteNumber(extracted?.ebitda?.margin_percentage);
            if (marginPct != null) out.ebitda_margin = marginPct / 100;

            if (extracted?.ebitda?.confidence) out.ebitda_confidence = extracted.ebitda.confidence;
            if (extracted?.ebitda) out.ebitda_is_inferred = !!extracted.ebitda.is_inferred;
            if (extracted?.ebitda?.source_quote) out.ebitda_source_quote = extracted.ebitda.source_quote;
          }

          // Common fields
          if (Array.isArray(extracted?.geographic_states) && extracted.geographic_states.length) out.geographic_states = extracted.geographic_states;

          {
            const n = toFiniteNumber(extracted?.number_of_locations);
            if (n != null) out.number_of_locations = n;
          }
          {
            const n = toFiniteNumber(extracted?.full_time_employees);
            if (n != null) out.full_time_employees = n;
          }
          {
            const n = toFiniteNumber(extracted?.founded_year);
            if (n != null) out.founded_year = n;
          }

          if (extracted?.service_mix) out.service_mix = extracted.service_mix;
          if (extracted?.business_model) out.business_model = extracted.business_model;
          if (extracted?.industry) out.industry = extracted.industry;

          if (extracted?.owner_goals) out.owner_goals = extracted.owner_goals;
          if (extracted?.transition_preferences) out.transition_preferences = extracted.transition_preferences;
          if (extracted?.special_requirements) out.special_requirements = extracted.special_requirements;
          if (extracted?.timeline_notes) out.timeline_notes = extracted.timeline_notes;

          if (extracted?.customer_types) out.customer_types = extracted.customer_types;
          // customer_concentration: DB is NUMERIC but LLM often returns text.
          // Extract percentage number if present; append text to customer_types.
          if (extracted?.customer_concentration) {
            const concText = String(extracted.customer_concentration);
            const pctMatch = concText.match(/(\d{1,3})(?:\s*%|\s*percent)/i);
            if (pctMatch) {
              const n = Number(pctMatch[1]);
              if (Number.isFinite(n) && n > 0 && n <= 100) out.customer_concentration = n;
            }
            if (out.customer_types) {
              out.customer_types += '\n\nCustomer Concentration: ' + concText;
            } else {
              out.customer_types = 'Customer Concentration: ' + concText;
            }
          }
          if (extracted?.customer_geography) out.customer_geography = extracted.customer_geography;
          if (extracted?.end_market_description) out.end_market_description = extracted.end_market_description;

          if (extracted?.executive_summary) out.executive_summary = extracted.executive_summary;
          if (extracted?.competitive_position) out.competitive_position = extracted.competitive_position;
          if (extracted?.growth_trajectory) out.growth_trajectory = extracted.growth_trajectory;
          if (Array.isArray(extracted?.key_risks) && extracted.key_risks.length) {
            out.key_risks = extracted.key_risks.map((r: string) => `• ${r}`).join('\n');
          }
          if (extracted?.technology_systems) out.technology_systems = extracted.technology_systems;
          if (extracted?.real_estate_info) out.real_estate_info = extracted.real_estate_info;

          if (Array.isArray(extracted?.key_quotes) && extracted.key_quotes.length) out.key_quotes = extracted.key_quotes;
          if (extracted?.financial_notes) out.financial_notes = extracted.financial_notes;
          if (Array.isArray(extracted?.financial_followup_questions) && extracted.financial_followup_questions.length) {
            out.financial_followup_questions = extracted.financial_followup_questions;
          }

          if (extracted?.primary_contact_name) out.primary_contact_name = extracted.primary_contact_name;
          if (extracted?.primary_contact_email) out.primary_contact_email = extracted.primary_contact_email;
          if (extracted?.primary_contact_phone) out.primary_contact_phone = extracted.primary_contact_phone;

          // Fields that were previously missing from this mapping
          if (extracted?.ownership_structure) out.ownership_structure = extracted.ownership_structure;
          if (extracted?.headquarters_address) out.headquarters_address = extracted.headquarters_address;
          if (Array.isArray(extracted?.services) && extracted.services.length) out.services = extracted.services;
          if (extracted?.website) out.website = extracted.website;
          if (extracted?.location) out.location = extracted.location;
          {
            const pt = toFiniteNumber(extracted?.part_time_employees);
            if (pt != null) out.part_time_employees = pt;
          }

          // Filter to known listing columns (defensive)
          const filtered: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(out)) {
            if (listingKeys.has(k)) filtered[k] = v;
          }
          return filtered;
        };

        for (const t of transcriptsWithExtracted) {
          const extracted = t.extracted_data as any;
          const flat = mapExtractedToListing(extracted);
          if (Object.keys(flat).length === 0) continue;

          let updates: Record<string, unknown>;
          let sourceUpdates: Record<string, unknown>;

          if (forceReExtract) {
            // Force mode: bypass priority checks — overwrite ALL fields from transcripts
            updates = { ...flat };
            // Build source tracking entries manually
            sourceUpdates = {};
            for (const key of Object.keys(flat)) {
              sourceUpdates[key] = createFieldSource('transcript', t.id);
            }
          } else {
            const result = buildPriorityUpdates(
              deal as any,
              cumulativeSources,
              flat as any,
              'transcript',
              t.id
            );
            updates = result.updates as Record<string, unknown>;
            sourceUpdates = result.sourceUpdates;
          }

          if (Object.keys(updates).length === 0) continue;

          transcriptsAppliedFromExisting++;

          // Merge geographic states rather than replace (unless force re-extracting)
          if (!forceReExtract && updates.geographic_states && Array.isArray(deal.geographic_states) && deal.geographic_states.length > 0) {
            updates.geographic_states = mergeStates(deal.geographic_states, updates.geographic_states as any);
          }

          cumulativeUpdates = { ...cumulativeUpdates, ...updates };
          cumulativeSources = updateExtractionSources(cumulativeSources, sourceUpdates as any);

          // Keep local deal object in sync so subsequent priority checks see new values
          Object.assign(deal, updates);
        }

        if (Object.keys(cumulativeUpdates).length > 0) {
          // Final safety: never allow placeholder strings into numeric columns.
          // Postgres will hard-fail the whole update otherwise.
          const NUMERIC_FIELDS = new Set([
            'revenue',
            'ebitda',
            'ebitda_margin',
            'number_of_locations',
            'full_time_employees',
            'founded_year',
            'linkedin_employee_count',
            'part_time_employees',
            'team_page_employee_count',
            'customer_concentration', // numeric column — LLM often returns prose
          ]);

          const sanitizedUpdates: Record<string, unknown> = { ...cumulativeUpdates };
          const removed: Array<{ key: string; value: unknown }> = [];

          for (const [k, v] of Object.entries(sanitizedUpdates)) {
            if (!NUMERIC_FIELDS.has(k)) continue;

            // Supabase numeric columns sometimes travel as strings; coerce when possible.
            if (typeof v === 'string') {
              const cleaned = v.replace(/[$,]/g, '').trim();
              const n = Number(cleaned);
              if (Number.isFinite(n)) {
                sanitizedUpdates[k] = n;
                continue;
              }
            }

            if (typeof v !== 'number' || !Number.isFinite(v)) {
              removed.push({ key: k, value: v });
              delete sanitizedUpdates[k];
            }
          }

          // Also strip any placeholder strings from ANY field (not just numeric).
          // This prevents a single "Unknown" from failing the entire update.
          const removedPlaceholders: Array<{ key: string; value: unknown }> = [];
          for (const [k, v] of Object.entries(sanitizedUpdates)) {
            if (typeof v === 'string' && isPlaceholder(v)) {
              removedPlaceholders.push({ key: k, value: v });
              delete sanitizedUpdates[k];
            }
          }

          const numericPreview = Object.fromEntries(
            Object.entries(sanitizedUpdates)
              .filter(([k]) => NUMERIC_FIELDS.has(k))
              .map(([k, v]) => [k, { value: v, type: typeof v }])
          );

          console.log('[Transcripts] Numeric payload preview (post-sanitize):', numericPreview);

          if (removed.length > 0) {
            console.warn('[Transcripts] Removed invalid numeric fields from updates:', removed);
          }
          if (removedPlaceholders.length > 0) {
            console.warn('[Transcripts] Removed placeholder string fields from updates:', removedPlaceholders);
          }

          const { error: applyExistingError } = await supabase
            .from('listings')
            .update({
              ...sanitizedUpdates,
              enriched_at: new Date().toISOString(),
              extraction_sources: cumulativeSources,
            })
            .eq('id', dealId);

          if (applyExistingError) {
            console.error('Failed applying existing transcript intelligence:', applyExistingError);
          } else {
            transcriptReport.appliedFromExisting = Object.keys(cumulativeUpdates).length;
            transcriptReport.appliedFromExistingTranscripts = transcriptsAppliedFromExisting;
            // Track which fields were applied from transcripts (for merged response)
            transcriptFieldNames.push(...Object.keys(cumulativeUpdates));
            // Keep deal.extraction_sources accurate for the rest of the pipeline
            (deal as any).extraction_sources = cumulativeSources;
          }
        }
      }
    }

    // 0B) Process transcripts that need AI extraction
    // forceReExtract=true: Re-process ALL transcripts with latest prompts (useful after prompt updates)
    // Otherwise: Only process unprocessed or failed transcripts
    let needsExtraction: typeof allTranscripts = [];
    
    if (!transcriptsError && allTranscripts && allTranscripts.length > 0) {
      if (forceReExtract) {
        // Force re-extraction: include ALL transcripts
        console.log(`[Transcripts] forceReExtract=true: Re-processing ALL ${allTranscripts.length} transcripts with new prompts`);
        needsExtraction = allTranscripts;
        
        // Clear extracted_data and processed_at so fresh extraction can apply
        const allTranscriptIds = allTranscripts.map((t) => t.id);
        if (allTranscriptIds.length > 0) {
          console.log(`[Transcripts] Clearing extracted_data for ${allTranscriptIds.length} transcripts`);
          await supabase
            .from('deal_transcripts')
            .update({ processed_at: null, extracted_data: null, applied_to_deal: false })
            .in('id', allTranscriptIds);
        }
      } else {
        // Normal mode: only unprocessed or failed transcripts
        // FIX #3: Check extracted_data FIRST — if a transcript already has extracted_data,
        // it was successfully processed and should not be re-sent to the LLM.
        needsExtraction = allTranscripts.filter((t) => {
          // Already has valid extracted data → skip
          const hasExtracted = t.extracted_data && typeof t.extracted_data === 'object' && Object.keys(t.extracted_data).length > 0;
          if (hasExtracted) return false;
          // Never processed, or processed but extraction was empty/failed
          return true;
        });
      }
    }

    console.log(`[Transcripts] Total: ${allTranscripts?.length || 0}, Need extraction: ${needsExtraction.length}, Already extracted: ${(allTranscripts?.length || 0) - needsExtraction.length}, forceReExtract: ${forceReExtract}`);

    if (needsExtraction.length > 0) {
      // Detect Fireflies URLs in link-type transcripts and convert them
      const firefliesLinkPattern = /fireflies\.ai\/view\/[^:]+::([a-zA-Z0-9]+)/;
      for (const t of needsExtraction) {
        if (t.source === 'link' && !t.fireflies_transcript_id) {
          // Check transcript_text or transcript_url for a Fireflies link
          const textToCheck = (t.transcript_text || '') + ' ' + ((t as any).transcript_url || '');
          const match = textToCheck.match(firefliesLinkPattern);
          if (match) {
            const ffId = match[1];
            console.log(`[Transcripts] Detected Fireflies URL in link transcript ${t.id}, extracted ID: ${ffId}`);
            // Update DB record to proper Fireflies source
            const { error: convertErr } = await supabase
              .from('deal_transcripts')
              .update({
                source: 'fireflies',
                fireflies_transcript_id: ffId,
              })
              .eq('id', t.id);
            if (!convertErr) {
              t.source = 'fireflies';
              t.fireflies_transcript_id = ffId;
              t.transcript_text = ''; // Clear the URL-only text so it gets fetched
            } else {
              console.warn(`[Transcripts] Failed to convert link transcript ${t.id}:`, convertErr);
            }
          }
        }
      }

      // Fetch Fireflies content for transcripts that have empty text
      // Check both source='fireflies' AND any transcript with a Fireflies URL (user may have pasted a URL manually)
      const firefliesEmpty = needsExtraction.filter(
        (t) => {
          if (t.transcript_text && t.transcript_text.trim().length >= 100) return false;
          // Source is explicitly Fireflies with an ID
          if (t.source === 'fireflies' && t.fireflies_transcript_id) return true;
          // Source is Fireflies but no ID yet (URL-only — fetch-fireflies-content will resolve it)
          if (t.source === 'fireflies') return true;
          return false;
        }
      );
      if (firefliesEmpty.length > 0) {
        console.log(`[Transcripts] Fetching Fireflies content for ${firefliesEmpty.length} transcript(s)...`);
        for (const t of firefliesEmpty) {
          try {
            const { data: fetchResult, error: fetchErr } = await supabase.functions.invoke(
              'fetch-fireflies-content',
              { body: { transcriptId: t.id } }
            );
            if (!fetchErr && fetchResult?.content) {
              t.transcript_text = fetchResult.content;
              console.log(`[Transcripts] Fetched ${fetchResult.content.length} chars for Fireflies transcript ${t.id}`);
            } else {
              console.warn(`[Transcripts] Failed to fetch Fireflies content for ${t.id}:`, fetchErr?.message || 'no content');
            }
          } catch (err) {
            console.warn(`[Transcripts] Error fetching Fireflies content for ${t.id}:`, err);
          }
        }
      }

      // Filter valid transcripts (must have >= 100 chars of text)
      const validTranscripts = needsExtraction.filter((t) =>
        t.transcript_text && t.transcript_text.trim().length >= 100
      );

      transcriptReport.processable = validTranscripts.length;
      transcriptReport.skipped = needsExtraction.length - validTranscripts.length;

      if (transcriptReport.skipped > 0) {
        console.log(`[Transcripts] Skipping ${transcriptReport.skipped} transcripts with insufficient content (<100 chars)`);
      }

      console.log(`[Transcripts] Processing ${validTranscripts.length} transcripts in batches...`);

      // Reset processed_at for failed transcripts so extract-deal-transcript can re-process them
      const failedTranscriptIds = validTranscripts
        .filter((t) => t.processed_at) // Only reset ones that were previously set
        .map((t) => t.id);

      if (failedTranscriptIds.length > 0) {
        console.log(`[Transcripts] Resetting processed_at for ${failedTranscriptIds.length} previously-failed transcripts`);
        await supabase
          .from('deal_transcripts')
          .update({ processed_at: null, extracted_data: null })
          .in('id', failedTranscriptIds);
      }

      // Process transcripts in parallel batches of 10 for speed
      const BATCH_SIZE = 10;
      for (let i = 0; i < validTranscripts.length; i += BATCH_SIZE) {
        const batch = validTranscripts.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (transcript) => {
            // Retry once on failure with 2s backoff (handles transient API errors)
            const MAX_RETRIES = 1;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              if (attempt > 0) {
                console.log(`[Transcripts] Retrying transcript ${transcript.id} (attempt ${attempt + 1})`);
                await new Promise((r) => setTimeout(r, 2000 * attempt)); // 2s backoff
              }

              try {
                const extractResponse = await fetch(
                  `${supabaseUrl}/functions/v1/extract-deal-transcript`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                      'apikey': supabaseAnonKey,
                      'x-internal-secret': supabaseServiceKey,
                    },
                    body: JSON.stringify({
                      transcriptId: transcript.id,
                      transcriptText: transcript.transcript_text,
                      applyToDeal: true,
                      dealInfo: {
                        company_name: deal.title || deal.internal_company_name,
                        industry: deal.industry,
                        location: deal.location || deal.address_city,
                        revenue: deal.revenue,
                        ebitda: deal.ebitda,
                      },
                    }),
                  }
                );

                if (!extractResponse.ok) {
                  const errText = await extractResponse.text();
                  lastError = new Error(errText.slice(0, 200));
                  // Retry on 5xx/429 errors, fail immediately on 4xx
                  if (extractResponse.status < 500 && extractResponse.status !== 429) {
                    throw lastError;
                  }
                  continue; // Retry
                }

                return transcript.id; // Success
              } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                if (attempt === MAX_RETRIES) throw lastError;
              }
            }

            throw lastError || new Error('Transcript extraction failed after retries');
          })
        );

        // Process batch results
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const transcript = batch[j];

          if (result.status === 'fulfilled') {
            transcriptsProcessed++;
            console.log(`[Transcripts] Successfully processed transcript ${transcript.id}`);
          } else {
            const errMsg = getErrorMessage(result.reason);
            console.error(`[Transcripts] Failed transcript ${transcript.id}:`, errMsg);
            transcriptErrors.push(`Transcript ${transcript.id.slice(0, 8)}: ${errMsg.slice(0, 200)}`);
          }
        }

        // Small delay between batches
        if (i + BATCH_SIZE < validTranscripts.length) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      // FIX #6: processed counter should include BOTH LLM-processed this run AND applied from existing
      transcriptReport.processed = transcriptsProcessed + (transcriptReport.appliedFromExistingTranscripts || 0);
      (transcriptReport as any).processedThisRun = transcriptsProcessed;
      transcriptReport.errors = transcriptErrors;
    } else {
      // FIX #6 (cont): Even when needsExtraction is empty, report applied-from-existing as processed
      transcriptReport.processed = transcriptReport.appliedFromExistingTranscripts || 0;
      (transcriptReport as any).processedThisRun = 0;
    }

    // FIX #1: ALWAYS re-fetch deal after step 0A (not just after 0B).
    // Step 0A updates enriched_at in the DB but NOT in the local deal object.
    // Without this re-fetch, the optimistic lock for website update will fail with 409.
    if (transcriptReport.appliedFromExisting > 0 || transcriptsProcessed > 0) {
      const { data: refreshedDeal } = await supabase
        .from('listings')
        .select('*, extraction_sources')
        .eq('id', dealId)
        .single();

      if (refreshedDeal) {
        Object.assign(deal, refreshedDeal);
      }
    }

    // FIX #2: If transcripts exist and were already applied (from step 0A),
    // but no NEW extraction was needed, this is SUCCESS not failure.
    // GUARDRAIL: Only fire if transcripts exist but NOTHING was extracted or applied.
    if (
      transcriptReport.totalTranscripts > 0 &&
      transcriptsProcessed === 0 &&
      transcriptReport.appliedFromExisting === 0
    ) {
      // Check if all transcripts already have extracted_data (already processed in prior run)
      const allHaveExtracted = allTranscripts?.every(
        (t) => t.extracted_data && typeof t.extracted_data === 'object' && Object.keys(t.extracted_data as any).length > 0
      );

      if (allHaveExtracted) {
        // FIX #2: This is not a failure — transcripts were processed in a previous run.
        // Continue to website scraping.
        console.log('[Transcripts] All transcripts already have extracted_data from prior runs. Continuing to website scraping.');
      } else {
        const reason = needsExtraction.length === 0
          ? 'All transcripts marked as processed but none have extracted_data. This should not happen after the retry fix.'
          : transcriptErrors.length > 0
            ? `All ${transcriptReport.processable} transcript extractions failed: ${transcriptErrors.slice(0, 3).join('; ')}`
            : 'No transcripts had sufficient text content (>= 100 chars)';

        console.error(`[Transcripts] GUARDRAIL FIRED: ${reason}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Transcript enrichment failed: ${reason}`,
            transcriptReport,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Capture version for optimistic locking
    // IMPORTANT: Only use enriched_at, NOT updated_at as fallback
    // If enriched_at is null, the lock check uses .is('enriched_at', null)
    const lockVersion = deal.enriched_at;

    // Get website URL - prefer website field, fallback to extracting from internal_deal_memo_link
    // Reject LLM placeholder values that may have been written in prior runs
    const WEBSITE_PLACEHOLDERS = ['<unknown>', 'unknown', 'n/a', 'none', 'null', 'not found', 'not specified', 'not provided'];
    let websiteUrl = deal.website;
    if (websiteUrl && WEBSITE_PLACEHOLDERS.includes(websiteUrl.trim().toLowerCase())) {
      console.log(`[Website] Rejecting placeholder website value: "${websiteUrl}"`);
      websiteUrl = null;
    }
    
    if (!websiteUrl && deal.internal_deal_memo_link) {
      const memoLink = deal.internal_deal_memo_link;
      
      // Skip SharePoint/OneDrive links
      if (!memoLink.includes('sharepoint.com') && !memoLink.includes('onedrive')) {
        // Handle "Website: https://..." format
        const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
        if (websiteMatch) {
          websiteUrl = websiteMatch[1];
        } else if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/)) {
          // Direct URL
          websiteUrl = memoLink;
        } else if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
          // Domain-only format
          websiteUrl = `https://${memoLink}`;
        }
      }
    }
    
    if (!websiteUrl) {
      // If transcripts were processed, return success with a note about website scraping
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      if (transcriptFieldsApplied > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Transcript enrichment completed (${transcriptReport.appliedFromExisting} fields applied). Website scraping skipped: no website URL found.`,
            fieldsUpdated: transcriptFieldNames,
            transcriptReport,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'No website URL found for this deal. Add a website in the company overview or deal memo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle multiple comma-separated URLs — take the first one
    if (websiteUrl.includes(',')) {
      const urls = websiteUrl.split(',').map((u: string) => u.trim()).filter(Boolean);
      websiteUrl = urls[0];
      console.log(`Multiple URLs detected, using first: "${websiteUrl}" (from ${urls.length} URLs)`);
    }

    // Ensure proper URL format
    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = `https://${websiteUrl}`;
    }

    // SECURITY: Validate URL to prevent SSRF attacks
    const urlValidation = validateUrl(websiteUrl);
    if (!urlValidation.valid) {
      console.error(`SSRF blocked for deal website: ${websiteUrl} - ${urlValidation.reason}`);
      // If transcripts were processed, return success instead of hard SSRF error
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      if (transcriptFieldsApplied > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Transcript enrichment completed (${transcriptReport.appliedFromExisting} fields applied, ${transcriptsProcessed} processed). Website scraping skipped: invalid URL.`,
            fieldsUpdated: transcriptFieldNames,
            transcriptReport,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `Invalid URL: ${websiteUrl} (${urlValidation.reason || 'blocked by security policy'})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    websiteUrl = urlValidation.normalizedUrl || websiteUrl;

    console.log(`Enriching deal ${dealId} from website: ${websiteUrl}`);

    // Check if Firecrawl is configured
    if (!firecrawlApiKey) {
      // If transcripts were processed, return success with a note about website scraping
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      if (transcriptFieldsApplied > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Transcript enrichment completed (${transcriptReport.appliedFromExisting} fields applied). Website scraping skipped: Firecrawl not configured.`,
            fieldsUpdated: transcriptFieldNames,
            transcriptReport,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured. Please enable the Firecrawl connector.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Timeout constants for external API calls
    const SCRAPE_TIMEOUT_MS = 30000; // 30 seconds per page
    const AI_TIMEOUT_MS = 45000; // 45 seconds
    const MIN_CONTENT_LENGTH = 200; // Minimum chars to proceed with AI

    // Step 1: Scrape MULTIPLE pages using Firecrawl
    // We need to crawl Contact, About, and Services pages to find address information
    console.log('Scraping website with Firecrawl (multi-page)...');

    // Build list of pages to scrape - homepage + common important pages
    let baseUrl: URL;
    try {
      baseUrl = new URL(websiteUrl);
    } catch (urlErr) {
      console.error(`Invalid URL "${websiteUrl}":`, urlErr);
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      if (transcriptFieldsApplied > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Transcript enrichment completed (${transcriptReport.appliedFromExisting} fields applied). Website scraping skipped: malformed URL "${websiteUrl}".`,
            fieldsUpdated: transcriptFieldNames,
            transcriptReport,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Invalid website URL: "${websiteUrl}". Please fix the URL on this deal.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`Will scrape homepage only: ${websiteUrl}`);

    // Scrape all pages in parallel (with limit)
    const scrapedPages: { url: string; content: string; success: boolean }[] = [];

    // Helper function to scrape a single page
    async function scrapePage(url: string): Promise<{ url: string; content: string; success: boolean }> {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 1000,
          }),
          signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
        });

        if (!response.ok) {
          return { url, content: '', success: false };
        }

        const data = await response.json();
        const content = data.data?.markdown || data.markdown || '';
        return { url, content, success: content.length > 50 };
      } catch {
        return { url, content: '', success: false };
      }
    }

    // Scrape homepage only for speed (1 Firecrawl call instead of 3)
    const homepageResult = await scrapePage(websiteUrl);
    scrapedPages.push(homepageResult);

    if (!homepageResult.success) {
      console.error('Failed to scrape homepage');
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      if (transcriptFieldsApplied > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Transcript enrichment completed (${transcriptReport.appliedFromExisting} fields applied). Website scraping failed: could not reach homepage.`,
            fieldsUpdated: transcriptFieldNames,
            transcriptReport,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to scrape website homepage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count successful scrapes
    const successfulScrapes = scrapedPages.filter(p => p.success);
    console.log(`Successfully scraped ${successfulScrapes.length} of ${scrapedPages.length} pages`);

    // Combine all scraped content with page markers
    let websiteContent = '';
    for (const page of scrapedPages) {
      if (page.success && page.content.length > 50) {
        const pageName = new URL(page.url).pathname || 'homepage';
        websiteContent += `\n\n=== PAGE: ${pageName} ===\n\n${page.content}`;
      }
    }

    // Log which pages were scraped for diagnostics
    const scrapedPagesSummary = scrapedPages.map(p => ({
      url: p.url,
      success: p.success,
      chars: p.content.length
    }));
    console.log('Scrape summary:', JSON.stringify(scrapedPagesSummary));

    if (!websiteContent || websiteContent.length < MIN_CONTENT_LENGTH) {
      console.log(`Insufficient website content scraped: ${websiteContent.length} chars (need ${MIN_CONTENT_LENGTH}+)`);
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      if (transcriptFieldsApplied > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Transcript enrichment completed (${transcriptReport.appliedFromExisting} fields applied). Website scraping skipped: insufficient content (${websiteContent.length} chars).`,
            fieldsUpdated: transcriptFieldNames,
            transcriptReport,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `Could not extract sufficient content from website (${websiteContent.length} chars, need ${MIN_CONTENT_LENGTH}+)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraped ${websiteContent.length} characters from website`);

    // Check if AI gateway is configured
    if (!geminiApiKey) {
      // Fall back to basic extraction without AI
      console.log('No AI key configured, using basic extraction');
      const updates: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      };

      // Basic extraction from website content
      if (!deal.executive_summary && websiteContent.length > 200) {
        updates.executive_summary = websiteContent.substring(0, 500).trim() + '...';
      }

      const { error: updateError } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', dealId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Basic enrichment completed (AI not configured)',
          fieldsUpdated: Object.keys(updates).filter(k => k !== 'enriched_at'),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Use AI to extract structured data
    console.log('Extracting deal intelligence with AI...');

const systemPrompt = `You are a business analyst specializing in M&A due diligence. Extract comprehensive company information from website content.

CRITICAL - COMPANY NAME EXTRACTION:
- Extract the REAL company name from the website (look in header, logo, footer, about page, legal notices)
- The company name should be the actual business name, NOT a generic description
- Examples of GOOD names: "Acme Plumbing Inc.", "Johnson HVAC Services", "Precision Solar LLC"
- Examples of BAD names: "Performance Marketing Agency", "Home Services Company", "Leading Provider"
- If you find a generic placeholder title, look harder for the real company name

CRITICAL - ADDRESS EXTRACTION (HIGHEST PRIORITY):
You MUST extract a physical address. This is required for deal matching. Search AGGRESSIVELY for address information.

WHERE TO FIND ADDRESS (search ALL of these):
1. **Footer** - Most common location, look for city/state near copyright or contact info
2. **Contact page** - "Contact Us", "Locations", "Get in Touch" sections
3. **About page** - "About Us", "Our Story", company history sections
4. **Header** - Sometimes addresses appear in top navigation
5. **Google Maps embed** - Look for embedded map with address
6. **Phone numbers** - Area codes can indicate location (e.g., 214 = Dallas, TX)
7. **Service area mentions** - "Serving the Dallas-Fort Worth area", "Based in Chicago"
8. **License/certification info** - Often includes state (e.g., "Licensed in Texas")
9. **Job postings** - Often mention office location
10. **Press releases** - Often include headquarters location
11. **Copyright notices** - May include city/state

EXTRACT INTO STRUCTURED COMPONENTS:
- street_address: Just the street number and name (e.g., "123 Main Street")
- address_city: City name ONLY (e.g., "Dallas", "Chicago", "Phoenix")
- address_state: 2-letter US state code ONLY (e.g., "TX", "IL", "AZ")
- address_zip: 5-digit ZIP code (e.g., "75201")
- address_country: Country code, default "US"

INFERENCE RULES (if explicit address not found):
- If you see "Serving Dallas-Fort Worth" → address_city: "Dallas", address_state: "TX"
- If you see "Chicago-based" → address_city: "Chicago", address_state: "IL"  
- If you see "Headquartered in Phoenix, Arizona" → address_city: "Phoenix", address_state: "AZ"
- If you see a phone area code, infer the city/state from it
- If you see state licensing info, use that state

DO NOT extract vague regions like "Midwest", "Southeast", "Texas area" for address fields.
The address_city and address_state fields must be specific - a real city name and 2-letter state code.

Focus on extracting:
1. Company name - The REAL business name (not a generic description)
2. **Structured address** - REQUIRED: Extract city and state at minimum
3. Executive summary - A clear 2-3 paragraph description of the business
4. Services offered - List of services/products they provide
5. Business model - How they make money (B2B, B2C, recurring revenue, project-based, etc.)
6. Industry/sector - Primary industry classification
7. Geographic coverage - States/regions they operate in (use 2-letter US state codes)
8. Number of locations - Physical office/branch count
9. Founded year - When the company was established
10. Customer types - Who they serve (commercial, residential, government, etc.)
11. Key risks - Any potential risk factors visible
12. Competitive position - Market positioning information
13. Technology/systems - Software, tools, or technology mentioned
14. Real estate - Information about facilities (owned vs leased)
15. Growth trajectory - Any growth indicators or history`;

    const userPrompt = `Analyze this website content from "${deal.title || 'Unknown Company'}" and extract business information.

IMPORTANT: You MUST find and extract the company's physical location (city and state). Look in the footer, contact page, about page, service area mentions, phone area codes, or any other location hints. This is required for deal matching.

FINANCIAL EXTRACTION RULES:
- If you find revenue or EBITDA figures, extract them with confidence levels
- High confidence: explicit statement like "Revenue: $5M"
- Medium confidence: inferred from context like "growing business with 50 employees"
- Low confidence: vague references that need clarification
- Include the exact quote that supports any financial figure
- If data is unclear, add follow-up questions

LOCATION COUNT RULES:
- Count ALL physical locations: offices, branches, shops, stores, facilities
- Look for patterns: "X locations", "operate out of X", "facilities in"
- Count individual location mentions if total not stated
- Single location business = 1

Website Content:
${websiteContent.substring(0, 20000)}

Extract all available business information using the provided tool. The address_city and address_state fields are REQUIRED - use inference from service areas or phone codes if a direct address is not visible.

For financial data, include confidence levels and source quotes where available.`;


    // Retry logic for AI calls (handles 429 rate limits)
    const MAX_AI_RETRIES = 3;
    const AI_RETRY_DELAYS = [2000, 5000, 10000]; // exponential backoff
    
    let aiResponse: Response | null = null;
    let lastAiError = '';
    
    for (let attempt = 0; attempt < MAX_AI_RETRIES; attempt++) {
      try {
        aiResponse = await fetch(GEMINI_API_URL, {
          method: 'POST',
          headers: getGeminiHeaders(geminiApiKey),
          body: JSON.stringify({
            model: DEFAULT_GEMINI_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'extract_deal_intelligence',
                  description: 'Extract comprehensive business/deal intelligence from website content',
                  parameters: {
                    type: 'object',
                    properties: {
                      internal_company_name: {
                        type: 'string',
                        description: 'The REAL company name extracted from the website (from logo, header, footer, legal notices). Must be an actual business name, NOT a generic description like "Marketing Agency" or "Home Services Company".'
                      },
                      executive_summary: {
                        type: 'string',
                        description: 'A 2-3 paragraph executive summary describing the business, its services, market position, and value proposition'
                      },
                      service_mix: {
                        type: 'string',
                        description: 'Comma-separated list of services or products offered'
                      },
                      business_model: {
                        type: 'string',
                        description: 'Description of how the business generates revenue (e.g., B2B services, recurring contracts, project-based)'
                      },
                      industry: {
                        type: 'string',
                        description: 'Primary industry classification (e.g., HVAC, Plumbing, IT Services, Healthcare)'
                      },
                      geographic_states: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Two-letter US state codes where the company has CONFIRMED physical presence or operations explicitly stated in the text. Do NOT infer neighboring states. Only include states explicitly mentioned. (e.g., ["CA", "TX"])'
                      },
                      number_of_locations: {
                        type: 'number',
                        description: 'Number of physical locations/offices/branches'
                      },
                      street_address: {
                        type: 'string',
                        description: 'Street address only (e.g., "123 Main Street", "456 Oak Ave Suite 200"). Do NOT include city/state/zip. Leave empty/null if not found - do NOT use placeholder values like "Not Found", "N/A", or "Unknown".'
                      },
                      address_city: {
                        type: 'string',
                        description: 'City name only (e.g., "Dallas", "Los Angeles"). Do NOT include state or zip.'
                      },
                      address_state: {
                        type: 'string',
                        description: '2-letter US state code (e.g., "TX", "CA", "FL") or Canadian province code (e.g., "ON", "BC"). Must be exactly 2 uppercase letters.'
                      },
                      address_zip: {
                        type: 'string',
                        description: 'ZIP code (e.g., "75201", "90210")'
                      },
                      address_country: {
                        type: 'string',
                        description: 'Country code, typically "US" or "CA"'
                      },
                      founded_year: {
                        type: 'number',
                        description: 'Year the company was founded'
                      },
                      customer_types: {
                        type: 'string',
                        description: 'Types of customers served (e.g., "Residential, Commercial, Government")'
                      },
                      owner_goals: {
                        type: 'string',
                        description: 'Any mentioned goals from the owner (exit, growth, succession, etc.)'
                      },
                      key_risks: {
                        type: 'string',
                        description: 'Potential risk factors identified'
                      },
                      competitive_position: {
                        type: 'string',
                        description: 'Market positioning and competitive advantages'
                      },
                      technology_systems: {
                        type: 'string',
                        description: 'Software, tools, or technology platforms used'
                      },
                      real_estate_info: {
                        type: 'string',
                        description: 'Information about facilities (owned vs leased, size, etc.)'
                      },
                      growth_trajectory: {
                        type: 'string',
                        description: 'Growth history and indicators'
                      },
                      linkedin_url: {
                        type: 'string',
                        description: 'LinkedIn company page URL if found on the website'
                      },
                      // Financial fields — FLATTENED to avoid Gemini "too much branching" error
                      revenue_value: {
                        type: 'number',
                        description: 'Annual revenue in dollars (e.g., 5000000 for $5M)'
                      },
                      revenue_confidence: {
                        type: 'string',
                        description: 'Confidence level for revenue: high, medium, or low'
                      },
                      revenue_is_inferred: {
                        type: 'boolean',
                        description: 'True if revenue was calculated/inferred from other data'
                      },
                      revenue_source_quote: {
                        type: 'string',
                        description: 'Exact text where revenue was mentioned'
                      },
                      ebitda_amount: {
                        type: 'number',
                        description: 'EBITDA in dollars'
                      },
                      ebitda_margin_percentage: {
                        type: 'number',
                        description: 'EBITDA margin as percentage (e.g., 18 for 18%)'
                      },
                      ebitda_confidence: {
                        type: 'string',
                        description: 'Confidence level for EBITDA: high, medium, or low'
                      },
                      ebitda_is_inferred: {
                        type: 'boolean',
                        description: 'True if EBITDA was calculated from margin and revenue'
                      },
                      ebitda_source_quote: {
                        type: 'string',
                        description: 'Exact text supporting the EBITDA figure'
                      },
                      financial_followup_questions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Questions to clarify financials if data is unclear'
                      },
                      financial_notes: {
                        type: 'string',
                        description: 'Notes and flags for deal team about financial data quality or concerns'
                      }
                    },
                    required: []
                  }
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'extract_deal_intelligence' } }
          }),
          signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        });

        // Check for rate limit (429)
        if (aiResponse.status === 429) {
          const retryAfter = aiResponse.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : AI_RETRY_DELAYS[attempt];
          const jitter = Math.random() * 1000;
          console.log(`AI rate limited (429), waiting ${Math.round(waitMs + jitter)}ms (attempt ${attempt + 1}/${MAX_AI_RETRIES})`);
          await new Promise(r => setTimeout(r, waitMs + jitter));
          continue;
        }

        // If successful, break out of retry loop
        if (aiResponse.ok) {
          break;
        }

        // Server errors (500, 502, 503, 529) — retry with backoff
        if (aiResponse.status >= 500 || aiResponse.status === 529) {
          lastAiError = await aiResponse.text().catch(() => `HTTP ${aiResponse!.status}`);
          if (attempt < MAX_AI_RETRIES - 1) {
            const waitMs = AI_RETRY_DELAYS[attempt];
            console.warn(`AI server error (${aiResponse.status}), retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_AI_RETRIES})`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          console.error(`AI server error (${aiResponse.status}) after ${MAX_AI_RETRIES} attempts:`, lastAiError);
          break;
        }

        // Non-retryable error - log and continue
        lastAiError = await aiResponse.text();
        console.error(`AI extraction error (attempt ${attempt + 1}):`, lastAiError);
        
      } catch (err) {
        lastAiError = getErrorMessage(err);
        console.error(`AI call exception (attempt ${attempt + 1}):`, lastAiError);
        if (attempt < MAX_AI_RETRIES - 1) {
          await new Promise(r => setTimeout(r, AI_RETRY_DELAYS[attempt]));
        }
      }
    }

    if (!aiResponse || !aiResponse.ok) {
      const errorDetail = lastAiError || 'No response from AI provider';
      console.error('AI extraction failed after retries:', errorDetail);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `AI extraction failed: ${errorDetail.substring(0, 300)}`,
          retries: MAX_AI_RETRIES,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Cost tracking: log Gemini usage (non-blocking)
    const geminiUsage = aiData.usage;
    if (geminiUsage) {
      logAICallCost(supabase, 'enrich-deal', 'gemini', DEFAULT_GEMINI_MODEL,
        { inputTokens: geminiUsage.prompt_tokens || 0, outputTokens: geminiUsage.completion_tokens || 0 },
        undefined, { dealId }
      ).catch(() => {});
    }

    // Extract tool call results
    let extracted: Record<string, unknown> = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse tool arguments:', e);
      }
    }

    console.log('Extracted data:', extracted);

    // ========================================================================
    // PROCESS FINANCIAL DATA WITH CONFIDENCE TRACKING (per spec)
    // Schema is now flattened — fields come back as revenue_value, ebitda_amount, etc.
    // ========================================================================
    
    // Handle flattened revenue fields from AI extraction
    if (extracted.revenue_value) {
      extracted.revenue = extracted.revenue_value;
      delete extracted.revenue_value;
      if (!extracted.revenue_confidence) extracted.revenue_confidence = 'medium';
    }
    // Legacy: handle nested revenue object from older schema
    const revenueData = extracted.revenue as { value?: number; confidence?: FinancialConfidence; is_inferred?: boolean; source_quote?: string } | number | undefined;
    if (revenueData && typeof revenueData === 'object' && revenueData.value) {
      extracted.revenue = revenueData.value;
      extracted.revenue_confidence = revenueData.confidence || 'medium';
      extracted.revenue_is_inferred = revenueData.is_inferred || false;
      if (revenueData.source_quote) extracted.revenue_source_quote = revenueData.source_quote;
    }
    
    // Handle flattened EBITDA fields
    if (extracted.ebitda_amount) {
      extracted.ebitda = extracted.ebitda_amount;
      delete extracted.ebitda_amount;
    }
    if (extracted.ebitda_margin_percentage) {
      extracted.ebitda_margin = (extracted.ebitda_margin_percentage as number) / 100;
      delete extracted.ebitda_margin_percentage;
    }
    // SPEC: Calculate EBITDA from revenue × margin if amount not provided
    if (!extracted.ebitda && extracted.ebitda_margin && extracted.revenue && typeof extracted.revenue === 'number') {
      const calculatedEbitda = extracted.revenue * (extracted.ebitda_margin as number);
      extracted.ebitda = calculatedEbitda;
      extracted.ebitda_is_inferred = true;
      extracted.ebitda_source_quote = `Calculated: ${(extracted.revenue as number) / 1000000}M revenue × ${((extracted.ebitda_margin as number) * 100).toFixed(1)}% margin`;
      if (!extracted.ebitda_confidence) extracted.ebitda_confidence = 'medium';
      console.log(`Calculated EBITDA from margin: $${calculatedEbitda.toLocaleString()}`);
    }
    // Legacy: handle nested ebitda object from older schema
    const ebitdaData = extracted.ebitda as { amount?: number; margin_percentage?: number; confidence?: FinancialConfidence; is_inferred?: boolean; source_quote?: string } | number | undefined;
    if (ebitdaData && typeof ebitdaData === 'object') {
      if (ebitdaData.amount) extracted.ebitda = ebitdaData.amount;
      if (ebitdaData.margin_percentage) extracted.ebitda_margin = ebitdaData.margin_percentage / 100;
      if (ebitdaData.confidence) extracted.ebitda_confidence = ebitdaData.confidence;
      extracted.ebitda_is_inferred = ebitdaData.is_inferred || false;
      if (ebitdaData.source_quote) extracted.ebitda_source_quote = ebitdaData.source_quote;
    }
    // (EBITDA margin calculation already handled above)
    // Clean up flattened fields that don't map to DB columns
    delete extracted.ebitda_amount;
    delete extracted.ebitda_margin_percentage;

    // Handle financial follow-up questions
    if (extracted.financial_followup_questions && Array.isArray(extracted.financial_followup_questions)) {
      console.log(`Generated ${extracted.financial_followup_questions.length} financial follow-up questions`);
    }

    // Handle financial notes
    if (extracted.financial_notes && typeof extracted.financial_notes === 'string') {
      console.log('Financial notes extracted:', extracted.financial_notes.substring(0, 100));
    }

    // Drop any unexpected keys so we never attempt to write missing columns
    for (const key of Object.keys(extracted)) {
      if (!VALID_LISTING_UPDATE_KEYS.has(key)) {
        delete (extracted as Record<string, unknown>)[key];
      }
    }

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states as string[]);
    }

    // Validate and clean structured address fields
    const US_STATE_CODES = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR'
    ]);
    const CA_PROVINCE_CODES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

    // Normalize address_state to 2-letter code (handles full names like "Florida" -> "FL")
    if (extracted.address_state) {
      const normalized = normalizeState(String(extracted.address_state));
      if (normalized && (US_STATE_CODES.has(normalized) || CA_PROVINCE_CODES.has(normalized))) {
        extracted.address_state = normalized;
      } else {
        console.log(`Rejecting invalid address_state: "${extracted.address_state}"`);
        delete extracted.address_state;
      }
    }

    // Validate address_zip (US 5-digit or Canadian postal code)
    if (extracted.address_zip) {
      const zipStr = String(extracted.address_zip).trim();
      const usZipPattern = /^\d{5}(-\d{4})?$/;
      const caPostalPattern = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
      if (!usZipPattern.test(zipStr) && !caPostalPattern.test(zipStr)) {
        console.log(`Rejecting invalid address_zip: "${extracted.address_zip}"`);
        delete extracted.address_zip;
      } else {
        extracted.address_zip = zipStr;
      }
    }

    // Clean address_city - AI sometimes puts full address in city field
    // We need to extract just the city name
    if (extracted.address_city) {
      let cityStr = String(extracted.address_city).trim();
      
      // Common patterns where AI puts full address in city field:
      // "123 Main St. Dallas" -> extract "Dallas"
      // "23 Westbrook Industrial Park Rd. Westbrook" -> extract "Westbrook"
      // "456 Oak Ave, Chicago, IL 60601" -> extract "Chicago"
      
      // Pattern 1: Full address with comma-separated city,state,zip at end
      // e.g., "123 Main St, Dallas, TX 75201"
      const fullAddressPattern = /^(.+?),\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?$/;
      const fullMatch = cityStr.match(fullAddressPattern);
      if (fullMatch) {
        // Extract just the city from the match
        cityStr = fullMatch[2].trim();
        // If we don't have street_address, save the street part
        if (!extracted.street_address && fullMatch[1]) {
          extracted.street_address = fullMatch[1].trim();
        }
        console.log(`Extracted city "${cityStr}" from full address, street: "${fullMatch[1]}"`);
      }
      
      // Pattern 2: Street address followed by city name without proper separators
      // Look for common street indicators and take what follows
      // e.g., "23 Westbrook Industrial Park Rd. Westbrook" -> "Westbrook"
      // e.g., "456 Oak Avenue Suite 200 Chicago" -> "Chicago"
      if (!fullMatch) {
        const streetIndicators = /(St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Dr\.?|Drive|Blvd\.?|Boulevard|Ln\.?|Lane|Way|Ct\.?|Court|Pkwy\.?|Parkway|Pl\.?|Place|Cir\.?|Circle|Park)\s+/i;
        const streetMatch = cityStr.match(streetIndicators);
        if (streetMatch && streetMatch.index !== undefined) {
          // Find the last occurrence of street indicator
          const lastStreetIndex = cityStr.lastIndexOf(streetMatch[0]);
          if (lastStreetIndex > 0) {
            const afterStreet = cityStr.substring(lastStreetIndex + streetMatch[0].length).trim();
            // Remove trailing state code or zip
            const cleanedCity = afterStreet.replace(/,?\s*[A-Z]{2}\s*(\d{5})?$/, '').trim();
            
            // Only use this if it looks like a city name (1-3 words, no numbers)
            if (cleanedCity.length > 0 && cleanedCity.length < 50 && !/\d/.test(cleanedCity)) {
              // Save the street address part
              if (!extracted.street_address) {
                extracted.street_address = cityStr.substring(0, lastStreetIndex + streetMatch[0].length - 1).trim();
              }
              cityStr = cleanedCity;
              console.log(`Parsed city "${cityStr}" from combined address, street: "${extracted.street_address}"`);
            }
          }
        }
      }
      
      // Pattern 3: Simple trailing ", ST" pattern
      cityStr = cityStr.replace(/,\s*[A-Z]{2}$/, '').trim();
      
      // Pattern 4: Remove trailing ZIP code
      cityStr = cityStr.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
      
      // Reject placeholder values
      const placeholders = ['not found', 'n/a', 'unknown', 'none', 'null', 'undefined', 'tbd', 'not available'];
      if (cityStr.length > 0 && cityStr.length < 50 && !placeholders.includes(cityStr.toLowerCase())) {
        extracted.address_city = cityStr;
      } else {
        console.log(`Rejecting invalid/placeholder address_city: "${extracted.address_city}"`);
        delete extracted.address_city;
      }
    }

    // Clean street_address - reject placeholder values
    if (extracted.street_address) {
      const streetStr = String(extracted.street_address).trim();
      const placeholders = ['not found', 'n/a', 'unknown', 'none', 'null', 'undefined', 'tbd', 'not available', 'not specified'];
      if (streetStr.length > 0 && !placeholders.includes(streetStr.toLowerCase())) {
        extracted.street_address = streetStr;
      } else {
        console.log(`Rejecting placeholder street_address: "${extracted.street_address}"`);
        delete extracted.street_address;
      }
    }

    // Default address_country to US if we have other address fields
    if ((extracted.address_city || extracted.address_state) && !extracted.address_country) {
      extracted.address_country = 'US';
    }

    // IMPORTANT: Remove 'location' from extracted data - we never update it from enrichment
    // The 'location' field is for marketplace anonymity (e.g., "Southeast US")
    delete extracted.location;

    // ========================================================================
    // ENHANCED LOCATION COUNT EXTRACTION (per spec)
    // ========================================================================
    
    // If AI didn't extract location count, try regex patterns on content
    if (!extracted.number_of_locations) {
      const locationPatterns = [
        /(\d+)\s+(?:staffed\s+)?locations?/i,
        /(\d+)\s+offices?/i,
        /(\d+)\s+branches?/i,
        /(\d+)\s+stores?/i,
        /(\d+)\s+shops?/i,
        /(\d+)\s+facilities/i,
        /operate\s+out\s+of\s+(\d+)/i,
        /(\d+)\s+sites?\s+across/i,
      ];
      
      for (const pattern of locationPatterns) {
        const match = websiteContent.match(pattern);
        if (match) {
          const count = parseInt(match[1], 10);
          if (count > 0 && count < 1000) { // Sanity check
            extracted.number_of_locations = count;
            console.log(`Extracted location count via regex: ${count}`);
            break;
          }
        }
      }
      
      // If still no count, check for "multiple locations" -> estimate 3
      if (!extracted.number_of_locations) {
        if (/multiple\s+locations?/i.test(websiteContent)) {
          extracted.number_of_locations = 3;
          console.log('Inferred multiple locations as 3');
        } else if (/several\s+locations?/i.test(websiteContent)) {
          extracted.number_of_locations = 4;
          console.log('Inferred several locations as 4');
        }
      }
    }

    // Validate and normalize linkedin_url - must be a DIRECT linkedin.com/company/ URL
    if (extracted.linkedin_url) {
      const linkedinUrlStr = String(extracted.linkedin_url).trim();
      // Only accept direct LinkedIn company URLs, reject Google/search/redirect URLs
      const linkedinCompanyPattern = /^https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?$/;
      if (linkedinCompanyPattern.test(linkedinUrlStr)) {
        // Normalize to consistent format
        const match = linkedinUrlStr.match(/linkedin\.com\/company\/([^\/\?]+)/);
        if (match) {
          extracted.linkedin_url = `https://www.linkedin.com/company/${match[1]}`;
          console.log(`Validated LinkedIn URL: ${extracted.linkedin_url}`);
        }
      } else {
        console.log(`Rejecting non-direct LinkedIn URL: "${linkedinUrlStr}"`);
        delete extracted.linkedin_url;
      }
    }

    // Try to fetch LinkedIn data if we have a URL or company name
    // skipExternalEnrichment=true when called from enrichmentPipeline (which calls these separately
    // at the pipeline level to avoid nested function timeout chains)
    const linkedinUrl = extracted.linkedin_url as string | undefined;
    const companyName = (extracted.internal_company_name || deal.internal_company_name || deal.title) as string | undefined;

    if (!skipExternalEnrichment && (linkedinUrl || companyName)) {
      try {
        console.log(`Attempting LinkedIn enrichment for: ${linkedinUrl || companyName}`);

        const linkedinResponse = await fetch(`${supabaseUrl}/functions/v1/apify-linkedin-scrape`, {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'x-internal-secret': supabaseServiceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            linkedinUrl,
            companyName,
            city: extracted.address_city || deal.address_city,
            state: extracted.address_state || deal.address_state,
            dealId: dealId, // Let the function update directly too as backup
            companyWebsite: websiteUrl || deal.website, // Required for website verification
          }),
          signal: AbortSignal.timeout(180000), // 180 seconds — multi-candidate ranking can scrape up to 3 profiles
        });

        if (linkedinResponse.ok) {
          const linkedinData = await linkedinResponse.json();
          if (linkedinData.success && linkedinData.scraped) {
            console.log('LinkedIn data retrieved:', linkedinData);

            if (linkedinData.linkedin_employee_count) {
              extracted.linkedin_employee_count = linkedinData.linkedin_employee_count;
            }
            if (linkedinData.linkedin_employee_range) {
              extracted.linkedin_employee_range = linkedinData.linkedin_employee_range;
            }
            if (linkedinData.linkedin_url) {
              extracted.linkedin_url = linkedinData.linkedin_url;
            }
          } else {
            console.log('LinkedIn scrape returned no data:', linkedinData.error || 'No company found');
          }
        } else {
          console.warn('LinkedIn scrape failed:', linkedinResponse.status);
        }
      } catch (linkedinError) {
        // Non-blocking - LinkedIn enrichment is optional
        console.warn('LinkedIn enrichment failed (non-blocking):', linkedinError);
      }
    } else if (skipExternalEnrichment) {
      console.log('[enrich-deal] Skipping LinkedIn/Google (handled by pipeline)');
    }

    // Try to fetch Google reviews data
    // Use company name and location for search
    if (!skipExternalEnrichment) {
      const googleSearchName = companyName || deal.title;
      const googleLocation = (extracted.address_city && extracted.address_state)
        ? `${extracted.address_city}, ${extracted.address_state}`
        : (deal.address_city && deal.address_state)
          ? `${deal.address_city}, ${deal.address_state}`
          : deal.location;

      if (googleSearchName && !deal.google_review_count) {
        try {
          console.log(`Attempting Google reviews enrichment for: ${googleSearchName}`);

          const googleResponse = await fetch(`${supabaseUrl}/functions/v1/apify-google-reviews`, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'x-internal-secret': supabaseServiceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              businessName: googleSearchName,
              city: extracted.address_city || deal.address_city,
              state: extracted.address_state || deal.address_state,
              dealId: dealId, // Let the function update directly
            }),
            signal: AbortSignal.timeout(95000), // Slightly longer than Google scraper's 90s timeout
          });

          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            if (googleData.success && googleData.scraped) {
              console.log('Google reviews data retrieved:', googleData);
            } else {
              console.log('Google reviews scrape returned no data:', googleData.error || 'No business found');
            }
          } else {
            console.warn('Google reviews scrape failed:', googleResponse.status);
          }
        } catch (googleError) {
          // Non-blocking - Google enrichment is optional
          console.warn('Google reviews enrichment failed (non-blocking):', googleError);
        }
      }
    }

    // Build priority-aware updates using shared module
    const { updates, sourceUpdates } = buildPriorityUpdates(
      deal,
      deal.extraction_sources,
      extracted,
      'website'
    );

    // Add enriched_at timestamp
    const finalUpdates: Record<string, unknown> = {
      ...updates,
      enriched_at: new Date().toISOString(),
      last_enriched_at: new Date().toISOString(), // For auto-enrichment cache
      extraction_sources: updateExtractionSources(deal.extraction_sources, sourceUpdates),
    };

    // Merge geographic states if both exist (website shouldn't overwrite existing)
    if (updates.geographic_states && deal.geographic_states?.length > 0) {
      finalUpdates.geographic_states = mergeStates(
        deal.geographic_states,
        updates.geographic_states as string[]
      );
    }

    // Update the listing with optimistic locking
    let updateQuery = supabase
      .from('listings')
      .update(finalUpdates)
      .eq('id', dealId);

    // Apply optimistic lock: only update if version hasn't changed
    if (lockVersion) {
      updateQuery = updateQuery.eq('enriched_at', lockVersion);
    } else {
      // If never enriched before, ensure it's still null
      updateQuery = updateQuery.is('enriched_at', null);
    }

    const { data: updateResult, error: updateError } = await updateQuery.select('id');

    if (updateError) {
      console.error('Error updating listing:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: getErrorMessage(updateError),
          error_code: (updateError as any)?.code,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for optimistic lock conflict
    if (!updateResult || updateResult.length === 0) {
      console.warn(`Optimistic lock conflict for deal ${dealId} - record was modified by another process`);
      // Return 409 Conflict so queue processor can retry or skip properly
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Deal was already enriched by another process (concurrent modification).',
          fieldsUpdated: [],
          error_code: 'concurrent_modification',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const websiteFieldsUpdated = Object.keys(updates);
    // Merge transcript + website fields into one list (deduplicated)
    const allFieldsUpdated = [...new Set([...transcriptFieldNames, ...websiteFieldsUpdated])];
    console.log(`Updated ${allFieldsUpdated.length} fields (${transcriptFieldNames.length} transcript + ${websiteFieldsUpdated.length} website):`, allFieldsUpdated);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully enriched deal with ${allFieldsUpdated.length} fields` +
          (transcriptFieldNames.length > 0 ? ` (${transcriptFieldNames.length} from transcripts, ${websiteFieldsUpdated.length} from website)` : ''),
        fieldsUpdated: allFieldsUpdated,
        extracted,
        // "What We Scraped" diagnostic report
        scrapeReport: {
          totalPagesAttempted: scrapedPages.length,
          successfulPages: successfulScrapes.length,
          totalCharactersScraped: websiteContent.length,
          pages: scrapedPagesSummary,
        },
        // Transcript processing report
        transcriptReport,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enrich-deal:', error);
    const message = getErrorMessage(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
