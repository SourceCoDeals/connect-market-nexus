/**
 * Extract website URL from internal_deal_memo_link.
 */
export const extractWebsiteFromMemo = (memoLink: string | null | undefined): string | null => {
  if (!memoLink) return null;
  if (memoLink.includes('sharepoint.com') || memoLink.includes('onedrive')) return null;
  const websiteMatch = memoLink.match(/Website:\s*(https?:\/\/[^\s]+)/i);
  if (websiteMatch) return websiteMatch[1];
  if (memoLink.match(/^https?:\/\/[a-zA-Z0-9]/) && !memoLink.includes('sharepoint')) return memoLink;
  if (memoLink.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) return `https://${memoLink}`;
  return null;
};

/**
 * Get effective website - prefer website field, fallback to extracted from memo.
 */
export const getEffectiveWebsite = (deal: any): string | null => {
  if (deal?.website) return deal.website;
  return extractWebsiteFromMemo(deal?.internal_deal_memo_link);
};

/**
 * Calculate data completeness percentage.
 */
export const calculateDataCompleteness = (deal: any, effectiveWebsite: string | null): number => {
  if (!deal) return 0;
  const fields = [
    deal.title,
    deal.description,
    deal.location,
    deal.revenue,
    deal.ebitda,
    deal.category,
    effectiveWebsite,
    deal.executive_summary,
    deal.service_mix,
    deal.geographic_states,
  ];
  const filledFields = fields.filter(f => f !== null && f !== undefined && f !== '').length;
  return Math.round((filledFields / fields.length) * 100);
};

/**
 * Format currency values for display.
 */
export const formatCurrency = (value: number | null): string => {
  if (!value) return "Not specified";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};
