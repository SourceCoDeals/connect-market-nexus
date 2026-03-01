import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fromTable = supabase.from.bind(supabase) as (
  table: string,
) => ReturnType<typeof supabase.from>;

interface FirmData {
  id: string;
  primary_company_name: string | null;
  member_count: number | null;
  fee_agreement_signed: boolean;
  nda_signed: boolean;
}

export interface UserFirmInfo {
  firm_id: string | null;
  firm_name: string | null;
  member_count: number | null;
  fee_agreement_signed: boolean;
  nda_signed: boolean;
}

export function useUserFirm(userId: string | null) {
  return useQuery({
    queryKey: ['user-firm', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await fromTable('firm_members')
        .select(`
          firm_id,
          firm:firm_agreements!firm_members_firm_id_fkey (
            id,
            primary_company_name,
            member_count,
            fee_agreement_signed,
            nda_signed
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        // User might not belong to a firm
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      const row = data as unknown as { firm_id: string; firm: FirmData | FirmData[] } | null;
      if (!row?.firm) return null;

      const firm: FirmData = Array.isArray(row.firm) ? row.firm[0] : row.firm;

      return {
        firm_id: firm.id,
        firm_name: firm.primary_company_name,
        member_count: firm.member_count,
        fee_agreement_signed: firm.fee_agreement_signed,
        nda_signed: firm.nda_signed,
      } as UserFirmInfo;
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });
}
