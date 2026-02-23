/**
 * Auto-Enrichment Hook — DISABLED
 *
 * Auto-enrichment has been disabled to limit API costs and give admins
 * full control over when enrichment runs. Manual enrichment buttons
 * on deal detail pages still work.
 *
 * The hook returns a no-op interface so existing imports don't break.
 */

interface AutoEnrichmentConfig {
  dealId: string;
  deal: {
    id: string;
    website?: string | null;
    internal_deal_memo_link?: string | null;
    enriched_at?: string | null;
    executive_summary?: string | null;
    address_city?: string | null;
    geographic_states?: string[] | null;
  } | null;
  enabled?: boolean;
}

interface AutoEnrichmentResult {
  isAutoEnriching: boolean;
  shouldAutoEnrich: boolean;
  enrichmentReason: string | null;
  triggerEnrichment: () => Promise<void>;
}

export function useAutoEnrichment(_config: AutoEnrichmentConfig): AutoEnrichmentResult {
  return {
    isAutoEnriching: false,
    shouldAutoEnrich: false,
    enrichmentReason: null,
    triggerEnrichment: async () => {},
  };
}
