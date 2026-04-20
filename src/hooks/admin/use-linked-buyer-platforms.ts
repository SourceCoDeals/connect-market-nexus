import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LinkedBuyerRecord {
  id: string;
  company_name: string;
  company_website: string | null;
  buyer_type: string | null;
  industry_vertical: string | null;
  target_ebitda_min: number | null;
  target_ebitda_max: number | null;
  target_geographies: string[] | null;
  target_services: string[] | null;
  revenue_model: string | null;
  thesis_summary: string | null;
  parent_pe_firm_id: string | null;
  pe_firm_website: string | null;
  num_platforms: number | null;
}

export interface LinkedBuyerPlatformsResult {
  parent: LinkedBuyerRecord | null;
  platforms: LinkedBuyerRecord[];
}

const SELECT =
  'id, company_name, company_website, buyer_type, industry_vertical, target_ebitda_min, target_ebitda_max, target_geographies, target_services, revenue_model, thesis_summary, parent_pe_firm_id, pe_firm_website, num_platforms';

export function useLinkedBuyerPlatforms(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ['linked-buyer-platforms', buyerId],
    enabled: !!buyerId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<LinkedBuyerPlatformsResult> => {
      if (!buyerId) return { parent: null, platforms: [] };

      const { data, error } = await supabase
        .from('buyers')
        .select(SELECT)
        .or(`id.eq.${buyerId},parent_pe_firm_id.eq.${buyerId}`)
        .eq('archived', false);

      if (error) throw error;

      const rows = (data || []) as LinkedBuyerRecord[];
      const parent = rows.find((r) => r.id === buyerId) ?? null;
      const platforms = rows
        .filter((r) => r.parent_pe_firm_id === buyerId)
        .sort((a, b) => a.company_name.localeCompare(b.company_name));

      return { parent, platforms };
    },
  });
}
