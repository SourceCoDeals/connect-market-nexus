import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InboundLeadFirmInfo {
  firm_id: string | null;
  firm_name: string | null;
  fee_agreement_signed: boolean;
  nda_signed: boolean;
}

export function useInboundLeadFirm(leadId: string | null) {
  return useQuery({
    queryKey: ['inbound-lead-firm', leadId],
    queryFn: async () => {
      if (!leadId) return null;

      const { data, error } = await supabase
        .from('inbound_leads')
        .select(`
          firm_id,
          firm:firm_agreements (
            id,
            primary_company_name,
            fee_agreement_signed,
            nda_signed
          )
        `)
        .eq('id', leadId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      if (!data) return null;
      
      // Type guard: check if firm property exists
      const firmData = data as any;
      if (!firmData.firm) return null;

      const firm = Array.isArray(firmData.firm) ? firmData.firm[0] : firmData.firm;

      return {
        firm_id: firm.id,
        firm_name: firm.primary_company_name,
        fee_agreement_signed: firm.fee_agreement_signed,
        nda_signed: firm.nda_signed,
      } as InboundLeadFirmInfo;
    },
    enabled: !!leadId,
    staleTime: 30000,
  });
}
