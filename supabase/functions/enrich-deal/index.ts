import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeState, normalizeStates, mergeStates } from "../_shared/geography.ts";
import { buildPriorityUpdates, updateExtractionSources, createFieldSource } from "../_shared/source-priority.ts";
import { GEMINI_API_URL, getGeminiHeaders, DEFAULT_GEMINI_MODEL } from "../_shared/ai-providers.ts";
import { checkProviderAvailability, reportRateLimit } from "../_shared/rate-limiter.ts";
import { validateUrl, ssrfErrorResponse } from "../_shared/security.ts";
import { logAICallCost } from "../_shared/cost-tracker.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import {
  // Configuration
  DEAL_SCRAPE_TIMEOUT_MS,
  DEAL_AI_TIMEOUT_MS,
  DEAL_MIN_CONTENT_LENGTH,
  DEAL_AI_RETRY_CONFIG,
  // Constants
  VALID_LISTING_UPDATE_KEYS,
  NUMERIC_LISTING_FIELDS,
  WEBSITE_PLACEHOLDERS,
  // Prompts
  DEAL_SYSTEM_PROMPT,
  buildDealUserPrompt,
  DEAL_TOOL_SCHEMA,
  // Validators
  validateDealExtraction,
  // Transcript mapping
  mapTranscriptToListing,
  sanitizeListingUpdates,
} from "../_shared/deal-extraction.ts";

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

/**
 * Lightweight AI call to infer industry from deal metadata when website scraping is unavailable.
 */
async function inferIndustryFromContext(
  deal: Record<string, any>,
  geminiApiKey: string,
  supabase: any,
  dealId: string,
): Promise<string | null> {
  if (!geminiApiKey) return null;
  if (deal.industry) return deal.industry;

  const context = [
    deal.title && `Company: ${deal.title}`,
    deal.internal_company_name && `Internal Name: ${deal.internal_company_name}`,
    deal.executive_summary && `Summary: ${String(deal.executive_summary).substring(0, 300)}`,
    deal.services && `Services: ${String(deal.services).substring(0, 200)}`,
    deal.category && `Category: ${deal.category}`,
    deal.description && `Description: ${String(deal.description).substring(0, 200)}`,
  ].filter(Boolean).join('\n');

  if (!context || context.length < 10) return null;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: getGeminiHeaders(geminiApiKey),
      body: JSON.stringify({
        model: DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: 'You classify businesses into concise industry labels. Return ONLY the industry label, nothing else. Be specific but concise (2-4 words). Examples: "HVAC Services", "Commercial Plumbing", "IT Managed Services", "Environmental Remediation", "Healthcare Staffing".' },
          { role: 'user', content: `Classify this business:\n${context}` },
        ],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const industry = data.choices?.[0]?.message?.content?.trim();
    if (industry && industry.length > 1 && industry.length < 60) {
      const { error: industryError } = await supabase.from('listings').update({ industry }).eq('id', dealId);
      if (industryError) {
        console.error(`[inferIndustry] Failed to set industry for deal ${dealId}:`, industryError);
      } else {
        console.log(`[inferIndustry] Set industry="${industry}" for deal ${dealId}`);
      }
      return industry;
    }
  } catch (err) {
    console.warn('[inferIndustry] Failed (non-blocking):', err);
  }
  return null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    // ========================================================================
    // FETCH DEAL
    // ========================================================================
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
    // STEP 0: TRANSCRIPT PROCESSING (highest priority source)
    // ========================================================================
    const { data: allTranscripts, error: transcriptsError } = await supabase
      .from('deal_transcripts')
      .select('id, transcript_text, processed_at, extracted_data, applied_to_deal, source, fireflies_transcript_id, transcript_url')
      .eq('listing_id', dealId)
      .order('created_at', { ascending: false });

    let transcriptsProcessed = 0;
    let transcriptsAppliedFromExisting = 0;
    const transcriptErrors: string[] = [];
    const transcriptFieldNames: string[] = [];

    const transcriptReport = {
      totalTranscripts: allTranscripts?.length || 0,
      processable: 0,
      skipped: 0,
      processed: 0,
      appliedFromExisting: 0,
      appliedFromExistingTranscripts: 0,
      errors: [] as string[],
    };

    if (!transcriptsError && allTranscripts?.length) {
      const sample = allTranscripts.slice(0, 5).map((t: any) => ({
        id: t.id,
        processed_at: t.processed_at,
        text_len: t.transcript_text ? t.transcript_text.length : 0,
        has_extracted: !!t.extracted_data,
        applied_to_deal: t.applied_to_deal,
      }));
      console.log(`[Transcripts] fetched=${allTranscripts.length}`, sample);
    }

    // 0A) Apply existing extracted_data from previously-processed transcripts
    if (!transcriptsError && allTranscripts && allTranscripts.length > 0) {
      const transcriptsWithExtracted = allTranscripts.filter((t: any) => t.extracted_data && typeof t.extracted_data === 'object');

      if (transcriptsWithExtracted.length > 0) {
        const listingKeys = new Set(Object.keys(deal as Record<string, unknown>));
        let cumulativeUpdates: Record<string, unknown> = {};
        let cumulativeSources = deal.extraction_sources;

        for (const t of transcriptsWithExtracted) {
          const extracted = t.extracted_data as any;
          const flat = mapTranscriptToListing(extracted, listingKeys);
          if (Object.keys(flat).length === 0) continue;

          let updates: Record<string, unknown>;
          let sourceUpdates: Record<string, unknown>;

          if (forceReExtract) {
            updates = { ...flat };
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

          if (!forceReExtract && updates.geographic_states && Array.isArray(deal.geographic_states) && deal.geographic_states.length > 0) {
            updates.geographic_states = mergeStates(deal.geographic_states, updates.geographic_states as any);
          }

          cumulativeUpdates = { ...cumulativeUpdates, ...updates };
          cumulativeSources = updateExtractionSources(cumulativeSources, sourceUpdates as any);

          Object.assign(deal, updates);
        }

        if (Object.keys(cumulativeUpdates).length > 0) {
          const sanitizedUpdates = sanitizeListingUpdates(cumulativeUpdates);

          const numericPreview = Object.fromEntries(
            Object.entries(sanitizedUpdates)
              .filter(([k]) => NUMERIC_LISTING_FIELDS.has(k))
              .map(([k, v]) => [k, { value: v, type: typeof v }])
          );
          console.log('[Transcripts] Numeric payload preview (post-sanitize):', numericPreview);

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
            transcriptFieldNames.push(...Object.keys(cumulativeUpdates));
            (deal as any).extraction_sources = cumulativeSources;
          }
        }
      }
    }

    // 0B) Process transcripts that need AI extraction
    let needsExtraction: typeof allTranscripts = [];

    if (!transcriptsError && allTranscripts && allTranscripts.length > 0) {
      if (forceReExtract) {
        console.log(`[Transcripts] forceReExtract=true: Re-processing ALL ${allTranscripts.length} transcripts with new prompts`);
        needsExtraction = allTranscripts;

        const allTranscriptIds = allTranscripts.map((t: any) => t.id);
        if (allTranscriptIds.length > 0) {
          console.log(`[Transcripts] Clearing extracted_data for ${allTranscriptIds.length} transcripts`);
          const { error: clearError } = await supabase
            .from('deal_transcripts')
            .update({ processed_at: null, extracted_data: null, applied_to_deal: false })
            .in('id', allTranscriptIds);
          if (clearError) {
            console.error(`[Transcripts] Failed to clear extracted_data:`, clearError);
          }
        }
      } else {
        needsExtraction = allTranscripts.filter((t: any) => {
          const hasExtracted = t.extracted_data && typeof t.extracted_data === 'object' && Object.keys(t.extracted_data).length > 0;
          if (hasExtracted) return false;
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
          const textToCheck = (t.transcript_text || '') + ' ' + ((t as any).transcript_url || '');
          const match = textToCheck.match(firefliesLinkPattern);
          if (match) {
            const ffId = match[1];
            console.log(`[Transcripts] Detected Fireflies URL in link transcript ${t.id}, extracted ID: ${ffId}`);
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
              t.transcript_text = '';
            } else {
              console.warn(`[Transcripts] Failed to convert link transcript ${t.id}:`, convertErr);
            }
          }
        }
      }

      // Fetch Fireflies content for transcripts with empty text
      const firefliesEmpty = needsExtraction.filter(
        (t: any) => {
          if (t.transcript_text && t.transcript_text.trim().length >= 100) return false;
          if (t.source === 'fireflies' && t.fireflies_transcript_id) return true;
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

      const validTranscripts = needsExtraction.filter((t: any) =>
        t.transcript_text && t.transcript_text.trim().length >= 100
      );

      transcriptReport.processable = validTranscripts.length;
      transcriptReport.skipped = needsExtraction.length - validTranscripts.length;

      if (transcriptReport.skipped > 0) {
        console.log(`[Transcripts] Skipping ${transcriptReport.skipped} transcripts with insufficient content (<100 chars)`);
      }

      console.log(`[Transcripts] Processing ${validTranscripts.length} transcripts in batches...`);

      const failedTranscriptIds = validTranscripts
        .filter((t: any) => t.processed_at)
        .map((t: any) => t.id);

      if (failedTranscriptIds.length > 0) {
        console.log(`[Transcripts] Resetting processed_at for ${failedTranscriptIds.length} previously-failed transcripts`);
        const { error: resetError } = await supabase
          .from('deal_transcripts')
          .update({ processed_at: null, extracted_data: null })
          .in('id', failedTranscriptIds);
        if (resetError) {
          console.error(`[Transcripts] Failed to reset processed_at:`, resetError);
        }
      }

      const BATCH_SIZE = 10;
      for (let i = 0; i < validTranscripts.length; i += BATCH_SIZE) {
        const batch = validTranscripts.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (transcript: any) => {
            const MAX_RETRIES = 1;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              if (attempt > 0) {
                console.log(`[Transcripts] Retrying transcript ${transcript.id} (attempt ${attempt + 1})`);
                await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
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
                  if (extractResponse.status < 500 && extractResponse.status !== 429) {
                    throw lastError;
                  }
                  continue;
                }

                return transcript.id;
              } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                if (attempt === MAX_RETRIES) throw lastError;
              }
            }

            throw lastError || new Error('Transcript extraction failed after retries');
          })
        );

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

        if (i + BATCH_SIZE < validTranscripts.length) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      transcriptReport.processed = transcriptsProcessed + (transcriptReport.appliedFromExistingTranscripts || 0);
      (transcriptReport as any).processedThisRun = transcriptsProcessed;
      transcriptReport.errors = transcriptErrors;
    } else {
      transcriptReport.processed = transcriptReport.appliedFromExistingTranscripts || 0;
      (transcriptReport as any).processedThisRun = 0;
    }

    // Re-fetch deal after transcript processing
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

    // Guardrail: warn if transcripts exist but nothing was extracted
    if (
      transcriptReport.totalTranscripts > 0 &&
      transcriptsProcessed === 0 &&
      transcriptReport.appliedFromExisting === 0
    ) {
      const allHaveExtracted = allTranscripts?.every(
        (t: any) => t.extracted_data && typeof t.extracted_data === 'object' && Object.keys(t.extracted_data as any).length > 0
      );

      if (allHaveExtracted) {
        console.log('[Transcripts] All transcripts already have extracted_data from prior runs. Continuing to website scraping.');
      } else {
        const reason = needsExtraction.length === 0
          ? 'All transcripts marked as processed but none have extracted_data.'
          : transcriptErrors.length > 0
            ? `All ${transcriptReport.processable} transcript extractions failed: ${transcriptErrors.slice(0, 3).join('; ')}`
            : 'No transcripts had sufficient text content (>= 100 chars)';
        console.warn(`[Transcripts] GUARDRAIL (non-fatal): ${reason}. Falling back to website-only enrichment.`);
      }
    }

    // ========================================================================
    // STEP 1: WEBSITE SCRAPING
    // ========================================================================
    const lockVersion = deal.enriched_at;

    // Resolve website URL
    let websiteUrl = deal.website;
    if (websiteUrl && WEBSITE_PLACEHOLDERS.includes(websiteUrl.trim().toLowerCase())) {
      console.log(`[Website] Rejecting placeholder website value: "${websiteUrl}"`);
      websiteUrl = null;
    }

    if (!websiteUrl && deal.internal_deal_memo_link) {
      const memoLink = deal.internal_deal_memo_link;
      if (!memoLink.includes('sharepoint.com') && !memoLink.includes('onedrive')) {
        const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
        if (websiteMatch) {
          websiteUrl = websiteMatch[1];
        } else if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/)) {
          websiteUrl = memoLink;
        } else if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
          websiteUrl = `https://${memoLink}`;
        }
      }
    }

    if (!websiteUrl) {
      await inferIndustryFromContext(deal, geminiApiKey!, supabase, dealId);
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      if (transcriptFieldsApplied > 0) {
        const { error: markEnrichedErr } = await supabase.from('listings').update({ enriched_at: new Date().toISOString() }).eq('id', dealId);
        if (markEnrichedErr) console.error(`[enrich-deal] Failed to mark deal ${dealId} as enriched:`, markEnrichedErr);
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
      const { error: markEnrichedErr2 } = await supabase.from('listings').update({ enriched_at: new Date().toISOString() }).eq('id', dealId);
      if (markEnrichedErr2) console.error(`[enrich-deal] Failed to mark deal ${dealId} as enriched:`, markEnrichedErr2);
      return new Response(
        JSON.stringify({ success: true, message: 'No website URL found. Deal marked as enriched with limited data.', fieldsUpdated: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle multiple comma-separated URLs
    if (websiteUrl.includes(',')) {
      const urls = websiteUrl.split(',').map((u: string) => u.trim()).filter(Boolean);
      websiteUrl = urls[0];
      console.log(`Multiple URLs detected, using first: "${websiteUrl}" (from ${urls.length} URLs)`);
    }

    if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = `https://${websiteUrl}`;
    }

    // SSRF validation
    const urlValidation = validateUrl(websiteUrl);
    if (!urlValidation.valid) {
      console.error(`SSRF blocked for deal website: ${websiteUrl} - ${urlValidation.reason}`);
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

    if (!firecrawlApiKey) {
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

    // Parse URL
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

    // Scrape homepage
    const scrapedPages: { url: string; content: string; success: boolean }[] = [];

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
          signal: AbortSignal.timeout(DEAL_SCRAPE_TIMEOUT_MS),
        });

        if (!response.ok) {
          let errorBody = '';
          try { errorBody = await response.text(); } catch {}
          console.error(`Firecrawl scrape failed for ${url}: HTTP ${response.status} — ${errorBody.slice(0, 300)}`);
          return { url, content: '', success: false };
        }

        const data = await response.json();
        const content = data.data?.markdown || data.markdown || '';
        return { url, content, success: content.length > 50 };
      } catch (err) {
        console.error(`Firecrawl scrape exception for ${url}:`, err instanceof Error ? err.message : err);
        return { url, content: '', success: false };
      }
    }

    const homepageResult = await scrapePage(websiteUrl);
    scrapedPages.push(homepageResult);

    if (!homepageResult.success) {
      console.warn('Failed to scrape homepage — marking as enriched with limited data');
      await inferIndustryFromContext(deal, geminiApiKey!, supabase, dealId);
      const { error: markEnrichedErr3 } = await supabase
        .from('listings')
        .update({ enriched_at: new Date().toISOString() })
        .eq('id', dealId);
      if (markEnrichedErr3) console.error(`[enrich-deal] Failed to mark deal ${dealId} as enriched:`, markEnrichedErr3);
      const transcriptFieldsApplied = transcriptReport.appliedFromExisting + transcriptsProcessed;
      return new Response(
        JSON.stringify({
          success: true,
          message: transcriptFieldsApplied > 0
            ? `Transcript enrichment completed (${transcriptFieldsApplied} fields applied). Website scraping failed: could not reach homepage.`
            : 'Website could not be scraped (site may be down or blocking). Deal marked as enriched with limited data.',
          fieldsUpdated: transcriptFieldNames,
          transcriptReport,
          warning: 'website_scrape_failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const successfulScrapes = scrapedPages.filter(p => p.success);
    console.log(`Successfully scraped ${successfulScrapes.length} of ${scrapedPages.length} pages`);

    let websiteContent = '';
    for (const page of scrapedPages) {
      if (page.success && page.content.length > 50) {
        const pageName = new URL(page.url).pathname || 'homepage';
        websiteContent += `\n\n=== PAGE: ${pageName} ===\n\n${page.content}`;
      }
    }

    const scrapedPagesSummary = scrapedPages.map(p => ({
      url: p.url,
      success: p.success,
      chars: p.content.length
    }));
    console.log('Scrape summary:', JSON.stringify(scrapedPagesSummary));

    if (!websiteContent || websiteContent.length < DEAL_MIN_CONTENT_LENGTH) {
      console.log(`Insufficient website content scraped: ${websiteContent.length} chars (need ${DEAL_MIN_CONTENT_LENGTH}+)`);
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
        JSON.stringify({ success: false, error: `Could not extract sufficient content from website (${websiteContent.length} chars, need ${DEAL_MIN_CONTENT_LENGTH}+)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraped ${websiteContent.length} characters from website`);

    if (!geminiApiKey) {
      console.log('No AI key configured, using basic extraction');
      const updates: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      };
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

    // ========================================================================
    // STEP 2: AI EXTRACTION
    // ========================================================================
    console.log('Extracting deal intelligence with AI...');

    const userPrompt = buildDealUserPrompt(deal.title, websiteContent);

    const MAX_AI_RETRIES = DEAL_AI_RETRY_CONFIG.maxRetries;
    const AI_RETRY_DELAYS = DEAL_AI_RETRY_CONFIG.delays;

    let aiResponse: Response | null = null;
    let lastAiError = '';

    for (let attempt = 0; attempt < MAX_AI_RETRIES; attempt++) {
      try {
        const availability = await checkProviderAvailability(supabase, 'gemini');
        if (!availability.ok && availability.retryAfterMs) {
          const waitMs = Math.min(availability.retryAfterMs, 30000);
          console.log(`[enrich-deal] Gemini in cooldown, waiting ${waitMs}ms before attempt ${attempt + 1}`);
          await new Promise(r => setTimeout(r, waitMs));
        }

        aiResponse = await fetch(GEMINI_API_URL, {
          method: 'POST',
          headers: getGeminiHeaders(geminiApiKey),
          body: JSON.stringify({
            model: DEFAULT_GEMINI_MODEL,
            messages: [
              { role: 'system', content: DEAL_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            tools: [DEAL_TOOL_SCHEMA],
            tool_choice: { type: 'function', function: { name: 'extract_deal_intelligence' } }
          }),
          signal: AbortSignal.timeout(DEAL_AI_TIMEOUT_MS),
        });

        if (aiResponse.status === 429) {
          const retryAfterHeader = aiResponse.headers.get('Retry-After');
          let retryAfterSeconds: number | undefined;
          if (retryAfterHeader) {
            const parsed = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsed)) retryAfterSeconds = parsed;
          }
          await reportRateLimit(supabase, 'gemini', retryAfterSeconds).catch(() => {});

          const waitMs = retryAfterSeconds ? retryAfterSeconds * 1000 : AI_RETRY_DELAYS[attempt];
          const jitter = Math.random() * 1000;
          console.log(`AI rate limited (429), waiting ${Math.round(waitMs + jitter)}ms (attempt ${attempt + 1}/${MAX_AI_RETRIES})`);
          await new Promise(r => setTimeout(r, waitMs + jitter));
          continue;
        }

        if (aiResponse.ok) break;

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

        lastAiError = await aiResponse.text();
        console.error(`AI non-retryable error (${aiResponse.status}):`, lastAiError);
        break;

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

    // Cost tracking (non-blocking)
    const geminiUsage = aiData.usage;
    if (geminiUsage) {
      logAICallCost(supabase, 'enrich-deal', 'gemini', DEFAULT_GEMINI_MODEL,
        { inputTokens: geminiUsage.prompt_tokens || 0, outputTokens: geminiUsage.completion_tokens || 0 },
        undefined, { dealId }
      ).catch(() => {});
    }

    // Parse tool call results
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
    // STEP 3: VALIDATE + CLEAN EXTRACTED DATA
    // ========================================================================

    // Run all validators (strips financials, cleans addresses, validates LinkedIn, etc.)
    validateDealExtraction(extracted, websiteContent);

    // Protect manually-set internal_company_name from AI overwrite
    if (deal.internal_company_name && extracted.internal_company_name) {
      console.log(`[Enrichment] Preserving existing internal_company_name "${deal.internal_company_name}" (AI suggested: "${extracted.internal_company_name}")`);
      delete extracted.internal_company_name;
    }

    // Normalize geographic_states using shared module
    if (extracted.geographic_states) {
      extracted.geographic_states = normalizeStates(extracted.geographic_states as string[]);
    }

    // ========================================================================
    // STEP 4: EXTERNAL ENRICHMENT (LinkedIn + Google Reviews)
    // ========================================================================
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
            dealId: dealId,
            companyWebsite: websiteUrl || deal.website,
          }),
          signal: AbortSignal.timeout(180000),
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
        console.warn('LinkedIn enrichment failed (non-blocking):', linkedinError);
      }
    } else if (skipExternalEnrichment) {
      console.log('[enrich-deal] Skipping LinkedIn/Google (handled by pipeline)');
    }

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
              dealId: dealId,
            }),
            signal: AbortSignal.timeout(95000),
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
          console.warn('Google reviews enrichment failed (non-blocking):', googleError);
        }
      }
    }

    // ========================================================================
    // STEP 5: WRITE TO DATABASE
    // ========================================================================
    const { updates, sourceUpdates } = buildPriorityUpdates(
      deal,
      deal.extraction_sources,
      extracted,
      'website'
    );

    const finalUpdates: Record<string, unknown> = {
      ...updates,
      enriched_at: new Date().toISOString(),
      last_enriched_at: new Date().toISOString(),
      extraction_sources: updateExtractionSources(deal.extraction_sources, sourceUpdates),
    };

    if (updates.geographic_states && deal.geographic_states?.length > 0) {
      finalUpdates.geographic_states = mergeStates(
        deal.geographic_states,
        updates.geographic_states as string[]
      );
    }

    let updateQuery = supabase
      .from('listings')
      .update(finalUpdates)
      .eq('id', dealId);

    if (lockVersion) {
      updateQuery = updateQuery.eq('enriched_at', lockVersion);
    } else {
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

    if (!updateResult || updateResult.length === 0) {
      console.warn(`Optimistic lock conflict for deal ${dealId} - record was modified by another process`);
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

    // Fallback industry inference
    if (!updates.industry && !deal.industry) {
      try {
        const inferred = await inferIndustryFromContext(
          { ...deal, ...updates },
          geminiApiKey!,
          supabase,
          dealId
        );
        if (inferred) {
          websiteFieldsUpdated.push('industry');
          console.log(`[enrich-deal] Industry inferred as fallback: "${inferred}"`);
        }
      } catch (err) {
        console.warn('[enrich-deal] Industry inference fallback failed (non-blocking):', err);
      }
    }

    const allFieldsUpdated = [...new Set([...transcriptFieldNames, ...websiteFieldsUpdated])];
    console.log(`Updated ${allFieldsUpdated.length} fields (${transcriptFieldNames.length} transcript + ${websiteFieldsUpdated.length} website):`, allFieldsUpdated);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully enriched deal with ${allFieldsUpdated.length} fields` +
          (transcriptFieldNames.length > 0 ? ` (${transcriptFieldNames.length} from transcripts, ${websiteFieldsUpdated.length} from website)` : ''),
        fieldsUpdated: allFieldsUpdated,
        extracted,
        scrapeReport: {
          totalPagesAttempted: scrapedPages.length,
          successfulPages: successfulScrapes.length,
          totalCharactersScraped: websiteContent.length,
          pages: scrapedPagesSummary,
        },
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
