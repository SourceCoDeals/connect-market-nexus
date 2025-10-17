import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logDealActivity } from '@/lib/deal-activity-logger';

interface LeadRequestParams {
  requestId: string;
  value: boolean;
}

export const useUpdateLeadNDAStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, value }: LeadRequestParams) => {
      const { data, error } = await supabase.rpc('update_lead_nda_status', {
        p_request_id: requestId,
        p_value: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      
      const previousRequests = queryClient.getQueryData<any>(['connection-requests']);
      const previousDeals = queryClient.getQueryData<any>(['deals']);
      
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_nda_signed: value, lead_nda_signed_at: value ? new Date().toISOString() : null } : r);
      });
      
      queryClient.setQueryData(['deals'], (old: any) => {
        if (!old) return old;
        return old.map((deal: any) => 
          deal.connection_request_id === requestId 
            ? { ...deal, nda_status: value ? 'signed' : 'not_sent' }
            : deal
        );
      });
      
      return { previousRequests, previousDeals };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousRequests) queryClient.setQueryData(['connection-requests'], ctx.previousRequests);
      if (ctx?.previousDeals) queryClient.setQueryData(['deals'], ctx.previousDeals);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead NDA signed status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connection-request-details'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'nda_status_changed',
          title: value ? 'NDA Signed' : 'NDA Status Revoked',
          description: value 
            ? `NDA marked as signed for ${deal.contact_name || 'contact'}`
            : `NDA signature revoked for ${deal.contact_name || 'contact'}`,
          metadata: { document_type: 'nda', signed: value }
        });
      }
      
      toast({ title: 'Lead NDA status updated' });
    },
  });
};

export const useUpdateLeadNDAEmailStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, value }: LeadRequestParams) => {
      const { data, error } = await supabase.rpc('update_lead_nda_email_status', {
        p_request_id: requestId,
        p_value: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      
      const previousRequests = queryClient.getQueryData<any>(['connection-requests']);
      const previousDeals = queryClient.getQueryData<any>(['deals']);
      
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_nda_email_sent: value, lead_nda_email_sent_at: value ? new Date().toISOString() : null } : r);
      });
      
      queryClient.setQueryData(['deals'], (old: any) => {
        if (!old) return old;
        return old.map((deal: any) => 
          deal.connection_request_id === requestId 
            ? { ...deal, nda_status: value ? 'sent' : 'not_sent' }
            : deal
        );
      });
      
      return { previousRequests, previousDeals };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousRequests) queryClient.setQueryData(['connection-requests'], ctx.previousRequests);
      if (ctx?.previousDeals) queryClient.setQueryData(['deals'], ctx.previousDeals);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead NDA email status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connection-request-details'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'nda_email_sent',
          title: value ? 'NDA Email Sent' : 'NDA Email Status Revoked',
          description: value 
            ? `NDA email sent to ${deal.contact_name || 'contact'}`
            : `NDA email status revoked for ${deal.contact_name || 'contact'}`,
          metadata: { document_type: 'nda', email_sent: value }
        });
      }
      
      toast({ title: 'Lead NDA email status updated' });
    },
  });
};

export const useUpdateLeadFeeAgreementStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, value }: LeadRequestParams) => {
      const { data, error } = await supabase.rpc('update_lead_fee_agreement_status', {
        p_request_id: requestId,
        p_value: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      
      const previousRequests = queryClient.getQueryData<any>(['connection-requests']);
      const previousDeals = queryClient.getQueryData<any>(['deals']);
      
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_fee_agreement_signed: value, lead_fee_agreement_signed_at: value ? new Date().toISOString() : null } : r);
      });
      
      queryClient.setQueryData(['deals'], (old: any) => {
        if (!old) return old;
        return old.map((deal: any) => 
          deal.connection_request_id === requestId 
            ? { ...deal, fee_agreement_status: value ? 'signed' : 'not_sent' }
            : deal
        );
      });
      
      return { previousRequests, previousDeals };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousRequests) queryClient.setQueryData(['connection-requests'], ctx.previousRequests);
      if (ctx?.previousDeals) queryClient.setQueryData(['deals'], ctx.previousDeals);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead fee agreement signed status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connection-request-details'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'fee_agreement_status_changed',
          title: value ? 'Fee Agreement Signed' : 'Fee Agreement Status Revoked',
          description: value 
            ? `Fee Agreement marked as signed for ${deal.contact_name || 'contact'}`
            : `Fee Agreement signature revoked for ${deal.contact_name || 'contact'}`,
          metadata: { document_type: 'fee_agreement', signed: value }
        });
      }
      
      toast({ title: 'Lead fee agreement status updated' });
    },
  });
};

export const useUpdateLeadFeeAgreementEmailStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, value }: LeadRequestParams) => {
      const { data, error } = await supabase.rpc('update_lead_fee_agreement_email_status', {
        p_request_id: requestId,
        p_value: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      
      const previousRequests = queryClient.getQueryData<any>(['connection-requests']);
      const previousDeals = queryClient.getQueryData<any>(['deals']);
      
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_fee_agreement_email_sent: value, lead_fee_agreement_email_sent_at: value ? new Date().toISOString() : null } : r);
      });
      
      queryClient.setQueryData(['deals'], (old: any) => {
        if (!old) return old;
        return old.map((deal: any) => 
          deal.connection_request_id === requestId 
            ? { ...deal, fee_agreement_status: value ? 'sent' : 'not_sent' }
            : deal
        );
      });
      
      return { previousRequests, previousDeals };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousRequests) queryClient.setQueryData(['connection-requests'], ctx.previousRequests);
      if (ctx?.previousDeals) queryClient.setQueryData(['deals'], ctx.previousDeals);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead fee agreement email status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connection-request-details'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'fee_agreement_email_sent',
          title: value ? 'Fee Agreement Email Sent' : 'Fee Agreement Email Status Revoked',
          description: value 
            ? `Fee Agreement email sent to ${deal.contact_name || 'contact'}`
            : `Fee Agreement email status revoked for ${deal.contact_name || 'contact'}`,
          metadata: { document_type: 'fee_agreement', email_sent: value }
        });
      }
      
      toast({ title: 'Lead fee agreement email status updated' });
    },
  });
};
