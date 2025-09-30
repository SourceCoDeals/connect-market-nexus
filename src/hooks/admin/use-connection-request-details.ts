import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectionRequestDetails {
  id: string;
  lead_nda_signed: boolean;
  lead_nda_signed_at: string | null;
  lead_nda_signed_by: string | null;
  lead_nda_email_sent: boolean;
  lead_nda_email_sent_at: string | null;
  lead_nda_email_sent_by: string | null;
  lead_fee_agreement_signed: boolean;
  lead_fee_agreement_signed_at: string | null;
  lead_fee_agreement_signed_by: string | null;
  lead_fee_agreement_email_sent: boolean;
  lead_fee_agreement_email_sent_at: string | null;
  lead_fee_agreement_email_sent_by: string | null;
  decision_notes: string | null;
  user_message: string | null;
  created_at: string;
  nda_signed_by_admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
  nda_email_sent_by_admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
  fee_signed_by_admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
  fee_email_sent_by_admin?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

export function useConnectionRequestDetails(connectionRequestId?: string) {
  return useQuery({
    queryKey: ['connection-request-details', connectionRequestId],
    queryFn: async () => {
      if (!connectionRequestId) return null;
      
      const { data, error } = await supabase
        .from('connection_requests')
        .select(`
          id,
          lead_nda_signed,
          lead_nda_signed_at,
          lead_nda_signed_by,
          lead_nda_email_sent,
          lead_nda_email_sent_at,
          lead_nda_email_sent_by,
          lead_fee_agreement_signed,
          lead_fee_agreement_signed_at,
          lead_fee_agreement_signed_by,
          lead_fee_agreement_email_sent,
          lead_fee_agreement_email_sent_at,
          lead_fee_agreement_email_sent_by,
          decision_notes,
          user_message,
          created_at
        `)
        .eq('id', connectionRequestId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      // Fetch admin details separately
      const adminIds = [
        data.lead_nda_signed_by,
        data.lead_nda_email_sent_by,
        data.lead_fee_agreement_signed_by,
        data.lead_fee_agreement_email_sent_by
      ].filter(Boolean) as string[];
      
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', adminIds);
      
      const adminMap = new Map(
        admins?.map(admin => [admin.id, admin]) || []
      );
      
      return {
        ...data,
        nda_signed_by_admin: data.lead_nda_signed_by 
          ? adminMap.get(data.lead_nda_signed_by) 
          : undefined,
        nda_email_sent_by_admin: data.lead_nda_email_sent_by 
          ? adminMap.get(data.lead_nda_email_sent_by) 
          : undefined,
        fee_signed_by_admin: data.lead_fee_agreement_signed_by 
          ? adminMap.get(data.lead_fee_agreement_signed_by) 
          : undefined,
        fee_email_sent_by_admin: data.lead_fee_agreement_email_sent_by 
          ? adminMap.get(data.lead_fee_agreement_email_sent_by) 
          : undefined,
      } as ConnectionRequestDetails;
    },
    enabled: !!connectionRequestId,
    staleTime: 30000,
  });
}
