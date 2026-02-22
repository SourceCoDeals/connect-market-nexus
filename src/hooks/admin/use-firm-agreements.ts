import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type AgreementStatus = 'not_started' | 'sent' | 'redlined' | 'under_review' | 'signed' | 'expired' | 'declined';
export type AgreementSource = 'platform' | 'manual' | 'docusign' | 'other';
export type AgreementScope = 'blanket' | 'deal_specific';

export interface FirmAgreement {
  id: string;
  normalized_company_name: string;
  primary_company_name: string;
  website_domain: string | null;
  email_domain: string | null;
  company_name_variations: string[];
  // Legacy booleans (kept for backward compat)
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
  // Expanded status fields
  nda_status: AgreementStatus;
  fee_agreement_status: AgreementStatus;
  fee_agreement_scope: AgreementScope;
  fee_agreement_deal_id: string | null;
  nda_expires_at: string | null;
  fee_agreement_expires_at: string | null;
  nda_document_url: string | null;
  fee_agreement_document_url: string | null;
  nda_source?: AgreementSource;
  fee_agreement_source_type?: AgreementSource;
  nda_redline_notes: string | null;
  fee_agreement_redline_notes: string | null;
  nda_redline_document_url: string | null;
  fee_agreement_redline_document_url: string | null;
  nda_custom_terms: string | null;
  fee_agreement_custom_terms: string | null;
  nda_inherited_from_firm_id: string | null;
  fee_inherited_from_firm_id: string | null;
  nda_sent_at: string | null;
  fee_agreement_sent_at: string | null;
  // DocuSeal fields
  nda_docuseal_submission_id: string | null;
  nda_docuseal_status: string | null;
  nda_signed_document_url: string | null;
  fee_docuseal_submission_id: string | null;
  fee_docuseal_status: string | null;
  fee_signed_document_url: string | null;
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
        const { data: dealsData, error: dealsDataError } = await supabase
          .from('deals')
          .select('connection_request_id')
          .in('connection_request_id', allRequestIds);
        if (dealsDataError) throw dealsDataError;

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
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['firm-members'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'], refetchType: 'active' });

      toast({
        title: 'Success',
        description: 'Fee agreement status updated for firm',
      });
    },
    onError: (error: any, _variables: any, context: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['firm-members'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'], refetchType: 'active' });

      toast({
        title: 'Success',
        description: 'NDA status updated for firm',
      });
    },
    onError: (error: any, _variables: any, context: any) => {
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

// ──────────────────────────────────────────────────────────────────────
// EXPANDED STATUS UPDATE — uses new update_firm_agreement_status() RPC
// ──────────────────────────────────────────────────────────────────────

export interface UpdateAgreementStatusParams {
  firmId: string;
  agreementType: 'nda' | 'fee_agreement';
  newStatus: AgreementStatus;
  signedByName?: string | null;
  signedByUserId?: string | null;
  documentUrl?: string | null;
  redlineNotes?: string | null;
  redlineDocumentUrl?: string | null;
  customTerms?: string | null;
  expiresAt?: string | null;
  source?: AgreementSource;
  scope?: AgreementScope;
  dealId?: string | null;
  notes?: string | null;
}

export function useUpdateAgreementStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: UpdateAgreementStatusParams) => {
      const { data, error } = await supabase.rpc('update_firm_agreement_status', {
        p_firm_id: params.firmId,
        p_agreement_type: params.agreementType,
        p_new_status: params.newStatus,
        p_signed_by_name: params.signedByName ?? null,
        p_signed_by_user_id: params.signedByUserId ?? null,
        p_document_url: params.documentUrl ?? null,
        p_redline_notes: params.redlineNotes ?? null,
        p_redline_document_url: params.redlineDocumentUrl ?? null,
        p_custom_terms: params.customTerms ?? null,
        p_expires_at: params.expiresAt ?? null,
        p_source: params.source ?? 'platform',
        p_scope: params.scope ?? 'blanket',
        p_deal_id: params.dealId ?? null,
        p_notes: params.notes ?? null,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['firm-agreements'] });
      const previousData = queryClient.getQueryData(['firm-agreements']);

      queryClient.setQueryData(['firm-agreements'], (old: any) => {
        if (!old) return old;
        return old.map((firm: any) => {
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
    onError: (error: any, _variables: any, context: any) => {
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

// ──────────────────────────────────────────────────────────────────────
// AGREEMENT AUDIT LOG
// ──────────────────────────────────────────────────────────────────────

export interface AgreementAuditEntry {
  id: string;
  firm_id: string;
  agreement_type: 'nda' | 'fee_agreement';
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  document_url: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

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

// ──────────────────────────────────────────────────────────────────────
// DOMAIN ALIASES
// ──────────────────────────────────────────────────────────────────────

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
    onError: (error: any) => {
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
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
