/**
 * findValuationLeadContacts.ts
 *
 * Client-side wrapper that invokes the `find-valuation-lead-contacts`
 * edge function to backfill LinkedIn URL + phone for an existing
 * valuation lead. Mirrors the pattern of `findIntroductionContacts.ts`.
 *
 * Pipeline (server-side):
 *   Serper (LinkedIn search) → Blitz (sync phone) → Clay fallback (async webhooks)
 *
 * Returns a discriminated result so callers can show accurate toasts:
 *   - 'found_both' / 'found_phone' / 'found_linkedin' (sync hit)
 *   - 'queued_async' (Blitz miss, Clay was fired — results will arrive later)
 *   - 'cached' (already searched within 7-day window)
 *   - 'skipped_complete' (lead already has both fields)
 *   - 'no_contact_info' (lead missing required full_name or email)
 *   - 'error'
 */
import { supabase } from '@/integrations/supabase/client';

export type FindContactsOutcome =
  | 'found_both'
  | 'found_phone'
  | 'found_linkedin'
  | 'queued_async'
  | 'cached'
  | 'skipped_complete'
  | 'no_contact_info'
  | 'error';

export interface FindContactsResult {
  outcome: FindContactsOutcome;
  linkedin_url: string | null;
  phone: string | null;
  message?: string;
}

export async function findValuationLeadContacts(leadId: string): Promise<FindContactsResult> {
  try {
    // 1. Fetch the lead's identity fields (the edge function needs them in the body)
    const { data: lead, error: fetchErr } = await supabase
      .from('valuation_leads')
      .select('id, full_name, email, website, business_name, linkedin_url, phone')
      .eq('id', leadId)
      .maybeSingle();

    if (fetchErr || !lead) {
      console.error('[findValuationLeadContacts] Fetch failed:', fetchErr?.message);
      return { outcome: 'error', linkedin_url: null, phone: null, message: fetchErr?.message };
    }

    if (!lead.full_name || !lead.email) {
      return {
        outcome: 'no_contact_info',
        linkedin_url: lead.linkedin_url ?? null,
        phone: lead.phone ?? null,
        message: 'Lead missing full name or email — cannot search',
      };
    }

    if (lead.linkedin_url && lead.phone) {
      return {
        outcome: 'skipped_complete',
        linkedin_url: lead.linkedin_url,
        phone: lead.phone,
      };
    }

    // 2. Invoke the edge function (uses admin JWT from supabase-js)
    const { data, error } = await supabase.functions.invoke('find-valuation-lead-contacts', {
      body: {
        valuation_lead_id: lead.id,
        full_name: lead.full_name,
        email: lead.email,
        website: lead.website || undefined,
        business_name: lead.business_name || undefined,
      },
    });

    if (error || !data) {
      console.error('[findValuationLeadContacts] Edge function error:', error?.message);
      return {
        outcome: 'error',
        linkedin_url: null,
        phone: null,
        message: error?.message || 'No response from edge function',
      };
    }

    const newLinkedIn: string | null = data.linkedin_url ?? null;
    const newPhone: string | null = data.phone ?? null;
    // Edge function returns `from_cache`, `clay_fallback_sent`, and `skipped`
    // (NOT `cached` / `clay_queued` — those names were wrong in the original).
    const wasCached: boolean = data.from_cache === true;
    const clayQueued: boolean = data.clay_fallback_sent === true;
    const wasSkipped: boolean = data.skipped === true;

    if (wasSkipped) {
      return {
        outcome: 'skipped_complete',
        linkedin_url: newLinkedIn,
        phone: newPhone,
        message: 'Lead already has phone & LinkedIn',
      };
    }
    if (wasCached) {
      return { outcome: 'cached', linkedin_url: newLinkedIn, phone: newPhone };
    }
    if (newLinkedIn && newPhone) {
      return { outcome: 'found_both', linkedin_url: newLinkedIn, phone: newPhone };
    }
    if (newPhone) {
      return { outcome: 'found_phone', linkedin_url: newLinkedIn, phone: newPhone };
    }
    if (newLinkedIn) {
      return { outcome: 'found_linkedin', linkedin_url: newLinkedIn, phone: newPhone };
    }
    if (clayQueued) {
      return {
        outcome: 'queued_async',
        linkedin_url: null,
        phone: null,
        message: 'Searching async — results will arrive within minutes',
      };
    }
    return {
      outcome: 'queued_async',
      linkedin_url: null,
      phone: null,
      message: 'No contacts found yet',
    };
  } catch (err) {
    console.error('[findValuationLeadContacts] Unexpected error:', err);
    return {
      outcome: 'error',
      linkedin_url: null,
      phone: null,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Concurrency-limited fan-out for bulk backfill. Serper rate-limits
 * aggressively; 3 in-flight is safe and matches the buyer pipeline.
 */
export async function findValuationLeadContactsBulk(
  leadIds: string[],
  options: {
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<{
  total: number;
  found: number;
  cached: number;
  queued: number;
  errors: number;
  skipped: number;
}> {
  const { concurrency = 3, onProgress } = options;
  const results = {
    total: leadIds.length,
    found: 0,
    cached: 0,
    queued: 0,
    errors: 0,
    skipped: 0,
  };
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < leadIds.length) {
      const idx = cursor++;
      const id = leadIds[idx];
      const r = await findValuationLeadContacts(id);
      switch (r.outcome) {
        case 'found_both':
        case 'found_phone':
        case 'found_linkedin':
          results.found++;
          break;
        case 'cached':
          results.cached++;
          break;
        case 'queued_async':
          results.queued++;
          break;
        case 'skipped_complete':
        case 'no_contact_info':
          results.skipped++;
          break;
        case 'error':
          results.errors++;
          break;
      }
      done++;
      onProgress?.(done, leadIds.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, leadIds.length) }, () => worker()));

  return results;
}
