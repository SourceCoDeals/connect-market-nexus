import { useState } from "react";

export interface PEFirm {
  id: string;
  user_id: string;
  domain: string;
  name: string;
  website: string | null;
  linkedin: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  hq_region: string | null;
  num_platforms: number | null;
  portfolio_companies: string[] | null;
  has_fee_agreement: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Platform {
  id: string;
  pe_firm_id: string;
  domain: string;
  name: string;
  website: string | null;
  linkedin: string | null;
  industry_vertical: string | null;
  business_summary: string | null;
  thesis_summary: string | null;
  thesis_confidence: string | null;
  min_revenue: number | null;
  max_revenue: number | null;
  revenue_sweet_spot: number | null;
  min_ebitda: number | null;
  max_ebitda: number | null;
  ebitda_sweet_spot: number | null;
  has_fee_agreement: boolean | null;
  created_at: string;
  updated_at: string;
  data_last_updated: string;
}

export interface TrackerBuyer {
  id: string;
  tracker_id: string;
  pe_firm_id: string;
  platform_id: string | null;
  fee_agreement_status: string | null;
  added_at: string;
}

export interface PEFirmWithPlatforms extends PEFirm {
  platforms: Platform[];
  trackerIds: string[];
}

export function usePEFirmsHierarchy() {
  const [peFirms] = useState<PEFirmWithPlatforms[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>('PE firms hierarchy not available - tables not in current schema');

  // Stub implementation - pe_firms, platforms, tracker_buyers tables not in current schema
  console.warn('[usePEFirmsHierarchy] pe_firms/platforms/tracker_buyers tables not available - stub implementation');

  return { peFirms, isLoading, error, refetch: () => Promise.resolve() };
}

export function usePlatformDetail(platformId: string | undefined) {
  // Stub implementation - platforms table not in current schema
  console.warn('[usePlatformDetail] platforms table not available - stub implementation');
  
  return { platform: null as Platform | null, peFirm: null as PEFirm | null, isLoading: false };
}
