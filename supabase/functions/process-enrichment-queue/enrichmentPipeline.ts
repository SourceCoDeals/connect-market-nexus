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
};

type StepResult = { ok: true; fieldsUpdated: string[] } | { ok: false; error: string };

async function callFn(
  input: EnrichmentPipelineInput,
  fnName: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: any }>
{
  const res = await fetch(`${input.supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      // Background worker calls: use service role key as apikey.
      // (Do not pass Authorization; some gateways reject service-role JWTs as "Invalid JWT").
      apikey: input.serviceRoleKey,
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
  const enrichDeal = await callFn(input, 'enrich-deal', { dealId: input.listingId });
  if (!enrichDeal.ok || !enrichDeal.json?.success) {
    return {
      ok: false,
      error: getErrorMessage('enrich-deal', enrichDeal.status, enrichDeal.json),
    };
  }
  if (Array.isArray(enrichDeal.json?.fieldsUpdated)) {
    updatedFields.push(...enrichDeal.json.fieldsUpdated);
  }

  // 2) LinkedIn employees via Apify (writes linkedin_employee_count/range)
  const companyName = listing.internal_company_name || listing.title;
  if (companyName) {
    const liRes = await callFn(input, 'apify-linkedin-scrape', {
      dealId: input.listingId,
      linkedinUrl: listing.linkedin_url,
      companyName,
      city: listing.address_city,
      state: listing.address_state,
    });

    // apify-linkedin-scrape returns 200 even for not found (success:false)
    if (!liRes.ok) {
      return { ok: false, error: getErrorMessage('apify-linkedin-scrape', liRes.status, liRes.json) };
    }

    if (liRes.json?.success === false) {
      // Treat as soft failure: don't block the rest of the pipeline
      // (common when LinkedIn page can't be found automatically).
    } else {
      if (liRes.json?.linkedin_employee_count != null) updatedFields.push('linkedin_employee_count');
      if (liRes.json?.linkedin_employee_range) updatedFields.push('linkedin_employee_range');
      if (liRes.json?.linkedin_url) updatedFields.push('linkedin_url');
    }
  }

  // 3) Google reviews via Apify (writes google_review_count/rating/maps url/place id)
  if (companyName) {
    const googleRes = await callFn(input, 'apify-google-reviews', {
      dealId: input.listingId,
      businessName: companyName,
      address: listing.address,
      city: listing.address_city,
      state: listing.address_state,
    });

    if (!googleRes.ok) {
      return { ok: false, error: getErrorMessage('apify-google-reviews', googleRes.status, googleRes.json) };
    }

    if (googleRes.json?.success === true) {
      updatedFields.push('google_review_count');
    }
  }

  return { ok: true, fieldsUpdated: Array.from(new Set(updatedFields)) };
}
