/**
 * findIntroductionContacts.ts
 *
 * Fire-and-forget helper that fetches buyer details and calls the
 * find-introduction-contacts edge function to auto-discover contacts
 * when a buyer is approved to the introduction stage.
 *
 * Returns a summary for toast display, or null on error.
 */
import { supabase } from '@/integrations/supabase/client';

interface ContactSearchResult {
  success: boolean;
  pe_contacts_found: number;
  company_contacts_found: number;
  total_saved: number;
  skipped_duplicates: number;
  message?: string;
  firmName: string;
}

/** Cross-deal contact discovery dedup window.
 * If a buyer was approved for a second deal within this many days after the
 * last discovery run, skip the edge function call — the contacts are shared
 * across all deals for this buyer and re-running would waste enrichment quota. */
const CONTACT_DISCOVERY_FRESH_DAYS = 30;

/**
 * Looks up buyer details and invokes the find-introduction-contacts edge function.
 * Non-blocking — callers should `.catch(() => {})` or handle errors gracefully.
 *
 * Skips the edge function call entirely when the buyer already has recent
 * contacts, unless triggerSource='manual' or 'retry' (explicit user intent).
 */
export async function findIntroductionContacts(
  buyerId: string,
  triggerSource: 'approval' | 'bulk_approval' | 'manual' | 'retry' = 'approval',
): Promise<ContactSearchResult | null> {
  try {
    // Cross-deal dedup: if this buyer already had contacts discovered recently,
    // skip the API call. Approving the same buyer for 5 deals previously fired
    // discovery 5× and hit rate limits; now it fires at most once per window.
    const isAutoTrigger = triggerSource === 'approval' || triggerSource === 'bulk_approval';
    if (isAutoTrigger) {
      const since = new Date(
        Date.now() - CONTACT_DISCOVERY_FRESH_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: recentContacts, error: recentErr } = await supabase
        .from('contacts')
        .select('id, created_at')
        .eq('remarketing_buyer_id', buyerId)
        .eq('archived', false)
        .gte('created_at', since)
        .limit(1);

      if (!recentErr && recentContacts && recentContacts.length > 0) {
        // Get a count for the toast
        const { count: totalCount } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('remarketing_buyer_id', buyerId)
          .eq('archived', false);

        // Fetch buyer name for the toast
        const { data: buyerName } = await supabase
          .from('buyers')
          .select('company_name, pe_firm_name')
          .eq('id', buyerId)
          .maybeSingle();

        console.log(
          `[findIntroductionContacts] Skipping discovery for buyer=${buyerId} — already has ${totalCount ?? 0} recent contacts`,
        );

        return {
          success: true,
          pe_contacts_found: 0,
          company_contacts_found: 0,
          total_saved: 0,
          skipped_duplicates: totalCount ?? 0,
          message: 'skipped_recent_discovery',
          firmName:
            (buyerName as { pe_firm_name: string | null; company_name: string } | null)
              ?.pe_firm_name ||
            (buyerName as { company_name: string } | null)?.company_name ||
            'Buyer',
        };
      }
    }

    // Fetch buyer details
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select(
        'id, company_name, company_website, buyer_type, pe_firm_name, pe_firm_website, platform_website',
      )
      .eq('id', buyerId)
      .single();

    if (buyerError || !buyer) {
      console.error('[findIntroductionContacts] Failed to fetch buyer:', buyerError?.message);
      return null;
    }

    // Extract email domain from website
    const website = buyer.platform_website || buyer.company_website;
    const emailDomain = extractDomain(website);

    const { data, error } = await supabase.functions.invoke('find-introduction-contacts', {
      body: {
        buyer_id: buyer.id,
        buyer_type: buyer.buyer_type || 'corporate',
        pe_firm_name: buyer.pe_firm_name || undefined,
        pe_firm_website: buyer.pe_firm_website || undefined,
        company_name: buyer.company_name,
        company_website: website || undefined,
        email_domain: emailDomain || undefined,
        trigger_source: triggerSource,
      },
    });

    if (error || !data) {
      console.error('[findIntroductionContacts] Edge function error:', error?.message || 'No data');
      return null;
    }

    return {
      success: data.success ?? false,
      pe_contacts_found: data.pe_contacts_found ?? 0,
      company_contacts_found: data.company_contacts_found ?? 0,
      total_saved: data.total_saved ?? 0,
      skipped_duplicates: data.skipped_duplicates ?? 0,
      message: data.message,
      firmName: buyer.pe_firm_name || buyer.company_name,
    };
  } catch (err) {
    console.error('[findIntroductionContacts] Unexpected error:', err);
    return null;
  }
}

function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
