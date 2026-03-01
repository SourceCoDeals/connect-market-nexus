/**
 * Shared hooks for Firm Agreements — queries, expanded status, audit log, domain aliases
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  FirmAgreement,
  FirmMember,
  UpdateAgreementStatusParams,
  AgreementAuditEntry,
} from './use-firm-agreements-types';

// ─── Firm Queries ───

export function useFirmAgreements() {
  return useQuery({
    queryKey: ['firm-agreements'],
    staleTime: 60_000,
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
      (leadsRes.data || []).forEach((l) => {
        leadCounts[l.firm_id] = (leadCounts[l.firm_id] || 0) + 1;
      });

      // Count requests per firm & collect request IDs for deal lookup
      const requestCounts: Record<string, number> = {};
      const requestToFirm: Record<string, string> = {};
      (requestsRes.data || []).forEach((r) => {
        requestCounts[r.firm_id] = (requestCounts[r.firm_id] || 0) + 1;
        requestToFirm[r.id] = r.firm_id;
      });

      // Count deals per firm via connection_request_id
      const dealCounts: Record<string, number> = {};
      const allRequestIds = Object.keys(requestToFirm);
      if (allRequestIds.length > 0) {
        const { data: dealsData, error: dealsDataError } = await supabase
          .from('deals')
          .select('connection_request_id')
          .in('connection_request_id', allRequestIds);
        if (dealsDataError) throw dealsDataError;

        (dealsData || []).forEach((d) => {
          const firmId = d.connection_request_id ? requestToFirm[d.connection_request_id] : undefined;
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

// ─── Expanded Status Update ───

export function useUpdateAgreementStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: UpdateAgreementStatusParams) => {
      const { data, error } = await supabase.rpc('update_firm_agreement_status', {
        p_firm_id: params.firmId,
        p_agreement_type: params.agreementType,
        p_new_status: params.newStatus,
        p_signed_by_name: params.signedByName ?? undefined,
        p_signed_by_user_id: params.signedByUserId ?? undefined,
        p_document_url: params.documentUrl ?? undefined,
        p_redline_notes: params.redlineNotes ?? undefined,
        p_redline_document_url: params.redlineDocumentUrl ?? undefined,
        p_custom_terms: params.customTerms ?? undefined,
        p_expires_at: params.expiresAt ?? undefined,
        p_source: params.source ?? 'platform',
        p_scope: params.scope ?? 'blanket',
        p_deal_id: params.dealId ?? undefined,
        p_notes: params.notes ?? undefined,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['firm-agreements'] });
      const previousData = queryClient.getQueryData(['firm-agreements']);

      queryClient.setQueryData<FirmAgreement[] | undefined>(['firm-agreements'], (old) => {
        if (!old) return old;
        return old.map((firm) => {
          if (firm.id !== params.firmId) return firm;
          if (params.agreementType === 'nda') {
            return {
              ...firm,
              nda_status: params.newStatus,
              nda_signed: params.newStatus === 'signed',
              nda_signed_at: params.newStatus === 'signed' ? new Date().toISOString() : firm.nda_signed_at,
            };
          }
          return {
            ...firm,
            fee_agreement_status: params.newStatus,
            fee_agreement_signed: params.newStatus === 'signed',
            fee_agreement_signed_at: params.newStatus === 'signed' ? new Date().toISOString() : firm.fee_agreement_signed_at,
          };
        });
      });

      return { previousData };
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['firm-members'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['agreement-audit-log'], refetchType: 'active' });

      const typeLabel = params.agreementType === 'nda' ? 'NDA' : 'Fee Agreement';
      toast({
        title: `${typeLabel} Updated`,
        description: `Status changed to ${params.newStatus.replace(/_/g, ' ')}`,
      });
    },
    onError: (error: Error, _variables: unknown, context: { previousData?: unknown } | undefined) => {
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

// ─── Agreement Audit Log ───

export function useAgreementAuditLog(firmId: string | null) {
  return useQuery({
    queryKey: ['agreement-audit-log', firmId],
    queryFn: async () => {
      if (!firmId) return [];
      const { data, error } = await supabase
        .from('agreement_audit_log')
        .select('*')
        .eq('firm_id', firmId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AgreementAuditEntry[];
    },
    enabled: !!firmId,
  });
}

// ─── Domain Aliases ───

export function useFirmDomainAliases(firmId: string | null) {
  return useQuery({
    queryKey: ['firm-domain-aliases', firmId],
    queryFn: async () => {
      if (!firmId) return [];
      const { data, error } = await supabase
        .from('firm_domain_aliases')
        .select('*')
        .eq('firm_id', firmId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        firm_id: string;
        domain: string;
        is_primary: boolean;
        created_at: string;
      }>;
    },
    enabled: !!firmId,
  });
}

export function useAddDomainAlias() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ firmId, domain }: { firmId: string; domain: string }) => {
      const { error } = await supabase
        .from('firm_domain_aliases')
        .insert({ firm_id: firmId, domain: domain.toLowerCase().trim() });

      if (error) throw error;
    },
    onSuccess: (_data, { firmId }) => {
      queryClient.invalidateQueries({ queryKey: ['firm-domain-aliases', firmId] });
      toast({ title: 'Domain alias added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRemoveDomainAlias() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ aliasId, firmId }: { aliasId: string; firmId: string }) => {
      const { error } = await supabase
        .from('firm_domain_aliases')
        .delete()
        .eq('id', aliasId);

      if (error) throw error;
      return firmId;
    },
    onSuccess: (_data, { firmId }) => {
      queryClient.invalidateQueries({ queryKey: ['firm-domain-aliases', firmId] });
      toast({ title: 'Domain alias removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
