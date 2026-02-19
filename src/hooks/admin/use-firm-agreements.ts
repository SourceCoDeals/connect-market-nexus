import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FirmAgreement {
  id: string;
  normalized_company_name: string;
  primary_company_name: string;
  website_domain: string | null;
  email_domain: string | null;
  company_name_variations: string[];
  fee_agreement_signed: boolean;
  fee_agreement_signed_at: string | null;
  fee_agreement_signed_by: string | null;
  fee_agreement_signed_by_name: string | null;
  fee_agreement_email_sent: boolean;
  fee_agreement_email_sent_at: string | null;
  nda_signed: boolean;
  nda_signed_at: string | null;
  nda_signed_by: string | null;
  nda_signed_by_name: string | null;
  nda_email_sent: boolean;
  nda_email_sent_at: string | null;
  member_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Include firm members for search
  firm_members?: Array<{
    id: string;
    user: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  }>;
  // Stats for leads, requests, and deals
  lead_count?: number;
  request_count?: number;
  deal_count?: number;
}

export interface FirmMember {
  id: string;
  firm_id: string;
  user_id: string | null;
  member_type: 'marketplace_user' | 'lead';
  lead_email: string | null;
  lead_name: string | null;
  lead_company: string | null;
  connection_request_id: string | null;
  inbound_lead_id: string | null;
  is_primary_contact: boolean;
  added_at: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    company_name: string;
    buyer_type: string;
  } | null;
}

export function useFirmAgreements() {
  return useQuery({
    queryKey: ['firm-agreements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firm_agreements')
        .select(`
          *,
          firm_members(
            id,
            user:profiles(
              id,
              first_name,
              last_name,
              email
            )
          )
        `)
        .order('primary_company_name');

      if (error) throw error;

      const firms = data || [];
      if (firms.length === 0) return [] as FirmAgreement[];

      const firmIds = firms.map(f => f.id);

      // Batch-fetch stats: 2-3 queries total instead of 4*N
      const [leadsRes, requestsRes] = await Promise.all([
        supabase.from('inbound_leads').select('firm_id').in('firm_id', firmIds),
        supabase.from('connection_requests').select('id, firm_id').in('firm_id', firmIds),
      ]);

      // Count leads per firm
      const leadCounts: Record<string, number> = {};
      (leadsRes.data || []).forEach((l: any) => {
        leadCounts[l.firm_id] = (leadCounts[l.firm_id] || 0) + 1;
      });

      // Count requests per firm & collect request IDs for deal lookup
      const requestCounts: Record<string, number> = {};
      const requestToFirm: Record<string, string> = {};
      (requestsRes.data || []).forEach((r: any) => {
        requestCounts[r.firm_id] = (requestCounts[r.firm_id] || 0) + 1;
        requestToFirm[r.id] = r.firm_id;
      });

      // Count deals per firm via connection_request_id
      const dealCounts: Record<string, number> = {};
      const allRequestIds = Object.keys(requestToFirm);
      if (allRequestIds.length > 0) {
        const { data: dealsData } = await supabase
          .from('deals')
          .select('connection_request_id')
          .in('connection_request_id', allRequestIds);

        (dealsData || []).forEach((d: any) => {
          const firmId = requestToFirm[d.connection_request_id];
          if (firmId) {
            dealCounts[firmId] = (dealCounts[firmId] || 0) + 1;
          }
        });
      }

      return firms.map(firm => ({
        ...firm,
        lead_count: leadCounts[firm.id] || 0,
        request_count: requestCounts[firm.id] || 0,
        deal_count: dealCounts[firm.id] || 0,
      })) as FirmAgreement[];
    },
  });
}

export function useFirmMembers(firmId: string | null) {
  return useQuery({
    queryKey: ['firm-members', firmId],
    queryFn: async () => {
      if (!firmId) return [];

      const { data, error } = await supabase
        .from('firm_members')
        .select(`
          *,
          user:profiles(
            id,
            email,
            first_name,
            last_name,
            company_name,
            buyer_type
          )
        `)
        .eq('firm_id', firmId)
        .order('member_type', { ascending: false })
        .order('is_primary_contact', { ascending: false });

      if (error) throw error;
      return data as FirmMember[];
    },
    enabled: !!firmId,
  });
}

// Minimal members index for global search (firm_id + user names)
export function useAllFirmMembersForSearch() {
  return useQuery({
    queryKey: ['firm-members-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firm_members')
        .select(`
          firm_id,
          user:profiles(
            id,
            first_name,
            last_name,
            email,
            buyer_type
          )
        `);

      if (error) throw error;
      return (data || []) as Array<{ firm_id: string; user: { id: string; first_name: string | null; last_name: string | null; email: string | null; buyer_type: string | null } | null }>;
    },
    staleTime: 60_000,
  });
}

export function useUpdateFirmFeeAgreement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      firmId,
      isSigned,
      signedByUserId,
      signedByName,
    }: {
      firmId: string;
      isSigned: boolean;
      signedByUserId?: string | null;
      signedByName?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('update_fee_agreement_firm_status', {
        p_firm_id: firmId,
        p_is_signed: isSigned,
        p_signed_by_user_id: signedByUserId,
        p_signed_at: isSigned ? new Date().toISOString() : null,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ firmId, isSigned }) => {
      await queryClient.cancelQueries({ queryKey: ['firm-agreements'] });
      
      const previousData = queryClient.getQueryData(['firm-agreements']);
      
      queryClient.setQueryData(['firm-agreements'], (old: any) => {
        if (!old) return old;
        return old.map((firm: any) =>
          firm.id === firmId
            ? {
                ...firm,
                fee_agreement_signed: isSigned,
                fee_agreement_signed_at: isSigned ? new Date().toISOString() : null,
              }
            : firm
        );
      });
      
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      
      toast({
        title: 'Success',
        description: 'Fee agreement status updated for firm',
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['firm-agreements'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateFirmNDA() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      firmId,
      isSigned,
      signedByUserId,
      signedByName,
    }: {
      firmId: string;
      isSigned: boolean;
      signedByUserId?: string | null;
      signedByName?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('update_nda_firm_status', {
        p_firm_id: firmId,
        p_is_signed: isSigned,
        p_signed_by_user_id: signedByUserId,
        p_signed_at: isSigned ? new Date().toISOString() : null,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ firmId, isSigned }) => {
      await queryClient.cancelQueries({ queryKey: ['firm-agreements'] });
      
      const previousData = queryClient.getQueryData(['firm-agreements']);
      
      queryClient.setQueryData(['firm-agreements'], (old: any) => {
        if (!old) return old;
        return old.map((firm: any) =>
          firm.id === firmId
            ? {
                ...firm,
                nda_signed: isSigned,
                nda_signed_at: isSigned ? new Date().toISOString() : null,
              }
            : firm
        );
      });
      
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      
      toast({
        title: 'Success',
        description: 'NDA status updated for firm',
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['firm-agreements'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
