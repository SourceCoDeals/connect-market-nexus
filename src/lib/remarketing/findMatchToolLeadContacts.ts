/**
 * findMatchToolLeadContacts.ts
 *
 * Client-side wrapper around `find-match-tool-lead-contacts` edge function
 * (Serper → Blitz → Clay waterfall, scoped to match_tool_leads).
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

export async function findMatchToolLeadContacts(leadId: string): Promise<FindContactsResult> {
  try {
    const { data: lead, error: fetchErr } = await supabase
      .from('match_tool_leads' as any)
      .select('id, full_name, email, website, business_name, linkedin_url, phone')
      .eq('id', leadId)
      .maybeSingle();
    if (fetchErr || !lead) {
      return { outcome: 'error', linkedin_url: null, phone: null, message: fetchErr?.message };
    }
    const l = lead as any;
    if (!l.full_name || !l.email) {
      return {
        outcome: 'no_contact_info',
        linkedin_url: l.linkedin_url ?? null,
        phone: l.phone ?? null,
        message: 'Lead missing full name or email',
      };
    }
    if (l.linkedin_url && l.phone) {
      return { outcome: 'skipped_complete', linkedin_url: l.linkedin_url, phone: l.phone };
    }

    const { data, error } = await supabase.functions.invoke('find-match-tool-lead-contacts', {
      body: {
        match_tool_lead_id: l.id,
        full_name: l.full_name,
        email: l.email,
        website: l.website || undefined,
        business_name: l.business_name || undefined,
      },
    });
    if (error || !data) {
      return {
        outcome: 'error',
        linkedin_url: null,
        phone: null,
        message: error?.message || 'No response',
      };
    }
    const newLinkedIn: string | null = data.linkedin_url ?? null;
    const newPhone: string | null = data.phone ?? null;
    const wasCached = data.from_cache === true;
    const clayQueued = data.clay_fallback_sent === true;
    const wasSkipped = data.skipped === true;

    if (wasSkipped) {
      return {
        outcome: 'skipped_complete',
        linkedin_url: newLinkedIn,
        phone: newPhone,
      };
    }
    if (wasCached) return { outcome: 'cached', linkedin_url: newLinkedIn, phone: newPhone };
    if (newLinkedIn && newPhone)
      return { outcome: 'found_both', linkedin_url: newLinkedIn, phone: newPhone };
    if (newPhone) return { outcome: 'found_phone', linkedin_url: newLinkedIn, phone: newPhone };
    if (newLinkedIn)
      return { outcome: 'found_linkedin', linkedin_url: newLinkedIn, phone: newPhone };
    if (clayQueued)
      return {
        outcome: 'queued_async',
        linkedin_url: null,
        phone: null,
        message: 'Searching async — results arrive within minutes',
      };
    return { outcome: 'queued_async', linkedin_url: null, phone: null, message: 'No contacts yet' };
  } catch (err) {
    return {
      outcome: 'error',
      linkedin_url: null,
      phone: null,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function findMatchToolLeadContactsBulk(
  leadIds: string[],
  options: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
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
      const r = await findMatchToolLeadContacts(id);
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
