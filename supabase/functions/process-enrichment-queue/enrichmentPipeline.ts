// Enrichment pipeline runner for process-enrichment-queue
// Keeps the main edge function small and focused.

export type EnrichmentPipelineInput = {
  supabaseUrl: string;
  serviceRoleKey: string;
  listingId: string;
  timeoutMs: number;
};

type ListingContext = {
  internal_company_name: string | null;
  title: string | null;
  address_city: string | null;
  address_state: string | null;
  address: string | null;
  linkedin_url: string | null;
  website: string | null;
};

type StepResult = { ok: true; fieldsUpdated: string[] } | { ok: false; error: string };

async function callFn(
  input: EnrichmentPipelineInput,
  fnName: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: any }>
{
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is not set — cannot make internal function calls');
  }

  const res = await fetch(`${input.supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      // Use service role key for Authorization (valid JWT the gateway accepts) +
      // anon key for apikey header (required for project routing)
      apikey: anonKey,
      Authorization: `Bearer ${input.serviceRoleKey}`,
      'x-internal-secret': input.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  return { ok: res.ok, status: res.status, json };
}

function getErrorMessage(fnName: string, status: number, json: any): string {
  const msg = json?.error || json?.message;
  if (typeof msg === 'string' && msg.trim()) return `${fnName}: ${msg}`;
  return `${fnName}: HTTP ${status}`;
}

export async function runListingEnrichmentPipeline(
  input: EnrichmentPipelineInput,
  listing: ListingContext
): Promise<StepResult> {
  const updatedFields: string[] = [];

  // 1) Website scrape + AI extraction (writes enriched_at + structured intelligence)
  // skipExternalEnrichment=true: LinkedIn/Google are called at the pipeline level (step 2)
  // to avoid nested edge-function timeout chains (queue→enrich-deal→apify would cascade-timeout)
  const enrichDeal = await callFn(input, 'enrich-deal', { dealId: input.listingId, skipExternalEnrichment: true });

  // 409 = concurrent modification (another process enriched this deal) — treat as success
  if (enrichDeal.status === 409 && enrichDeal.json?.error_code === 'concurrent_modification') {
    console.log(`Deal ${input.listingId} was already enriched by another process — treating as success`);
    return { ok: true, fieldsUpdated: [] };
  }

  if (!enrichDeal.ok || !enrichDeal.json?.success) {
    return {
      ok: false,
      error: getErrorMessage('enrich-deal', enrichDeal.status, enrichDeal.json),
    };
  }
  if (Array.isArray(enrichDeal.json?.fieldsUpdated)) {
    updatedFields.push(...enrichDeal.json.fieldsUpdated);
  }

  return { ok: true, fieldsUpdated: Array.from(new Set(updatedFields)) };
}
