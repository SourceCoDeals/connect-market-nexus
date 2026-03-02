import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LandingPageDeal {
  id: string;
  title: string;
  deal_identifier: string | null;
  hero_description: string | null;
  description: string | null;
  description_html: string | null;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  ebitda_margin: number | null;
  business_model: string | null;
  customer_geography: string | null;
  categories: string[] | null;
  category: string | null;
  investment_thesis: string | null;
  ownership_structure: string | null;
  seller_motivation: string | null;
  services: string[] | null;
  custom_sections: Array<{ title: string; description: string }> | null;
  revenue_metric_subtitle: string | null;
  ebitda_metric_subtitle: string | null;
  custom_metric_label: string | null;
  custom_metric_value: string | null;
  custom_metric_subtitle: string | null;
  metric_3_type: string | null;
  metric_3_custom_label: string | null;
  metric_3_custom_value: string | null;
  metric_3_custom_subtitle: string | null;
  metric_4_type: string | null;
  metric_4_custom_label: string | null;
  metric_4_custom_value: string | null;
  metric_4_custom_subtitle: string | null;
  executive_summary: string | null;
  growth_drivers: string[] | null;
  key_risks: string[] | null;
  competitive_position: string | null;
  service_mix: string[] | null;
  customer_types: string | null;
  revenue_model: string | null;
  revenue_model_breakdown: Record<string, number> | null;
  end_market_description: string | null;
  management_depth: string | null;
  full_time_employees: number | null;
  part_time_employees: number | null;
  image_url: string | null;
  status: string;
  presented_by_admin_id: string | null;
  timeline_preference: string | null;
  seller_involvement_preference: string | null;
  // Internal fields used only for anonymization — never displayed directly
  internal_company_name: string | null;
  company_website: string | null;
}

export interface RelatedDeal {
  id: string;
  title: string;
  location: string | null;
  revenue: number | null;
  ebitda: number | null;
  ebitda_margin: number | null;
  categories: string[] | null;
  description: string | null;
  hero_description: string | null;
}

const LANDING_PAGE_FIELDS = `
  id, title, deal_identifier, hero_description, description, description_html, location,
  revenue, ebitda, ebitda_margin, business_model, customer_geography,
  categories, category, investment_thesis, ownership_structure, seller_motivation,
  services, custom_sections, revenue_metric_subtitle, ebitda_metric_subtitle,
  custom_metric_label, custom_metric_value, custom_metric_subtitle,
  metric_3_type, metric_3_custom_label, metric_3_custom_value, metric_3_custom_subtitle,
  metric_4_type, metric_4_custom_label, metric_4_custom_value, metric_4_custom_subtitle,
  executive_summary, growth_drivers, key_risks, competitive_position, service_mix,
  customer_types, revenue_model, revenue_model_breakdown, end_market_description, management_depth,
  full_time_employees, part_time_employees, image_url, status, presented_by_admin_id,
  timeline_preference, seller_involvement_preference,
  internal_company_name, company_website
`;

export function useDealLandingPage(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal-landing-page', dealId],
    queryFn: async (): Promise<LandingPageDeal> => {
      if (!dealId) throw new Error('Deal ID is required');

      const { data, error } = await supabase
        .from('listings')
        .select(LANDING_PAGE_FIELDS)
        .eq('id', dealId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Deal not found');

      return {
        ...data,
        custom_sections: data.custom_sections as LandingPageDeal['custom_sections'],
        growth_drivers: data.growth_drivers as string[] | null,
        key_risks: data.key_risks as string[] | null,
        service_mix: (Array.isArray(data.service_mix) ? data.service_mix : data.service_mix ? [data.service_mix] : null) as string[] | null,
        revenue_model_breakdown: data.revenue_model_breakdown as Record<string, number> | null,
      };
    },
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRelatedDeals(currentDealId: string | undefined) {
  return useQuery({
    queryKey: ['related-deals', currentDealId],
    queryFn: async (): Promise<RelatedDeal[]> => {
      const { data, error } = await supabase
        .from('listings')
        .select(
          'id, title, location, revenue, ebitda, ebitda_margin, categories, description, hero_description',
        )
        .eq('status', 'active')
        .neq('id', currentDealId ?? '')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return (data ?? []) as RelatedDeal[];
    },
    enabled: !!currentDealId,
    staleTime: 5 * 60 * 1000,
  });
}
