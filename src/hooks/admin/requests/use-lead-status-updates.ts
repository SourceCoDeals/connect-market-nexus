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
        request_id: requestId,
        is_signed: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      const previous = queryClient.getQueryData<any>(['connection-requests']);
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_nda_signed: value, lead_nda_signed_at: value ? new Date().toISOString() : null } : r);
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['connection-requests'], ctx.previous);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead NDA signed status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'document_signed',
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
        request_id: requestId,
        email_sent: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      const previous = queryClient.getQueryData<any>(['connection-requests']);
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_nda_email_sent: value, lead_nda_email_sent_at: value ? new Date().toISOString() : null } : r);
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['connection-requests'], ctx.previous);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead NDA email status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'document_email_sent',
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
        request_id: requestId,
        is_signed: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      const previous = queryClient.getQueryData<any>(['connection-requests']);
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_fee_agreement_signed: value, lead_fee_agreement_signed_at: value ? new Date().toISOString() : null } : r);
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['connection-requests'], ctx.previous);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead fee agreement signed status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'document_signed',
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
        request_id: requestId,
        email_sent: value,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ requestId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });
      const previous = queryClient.getQueryData<any>(['connection-requests']);
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((r: any) => r.id === requestId ? { ...r, lead_fee_agreement_email_sent: value, lead_fee_agreement_email_sent_at: value ? new Date().toISOString() : null } : r);
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['connection-requests'], ctx.previous);
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update lead fee agreement email status' });
    },
    onSuccess: async (_, { requestId, value }) => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      
      // Log activity if this connection request has a deal
      const { data: deal } = await supabase
        .from('deals')
        .select('id, contact_name')
        .eq('connection_request_id', requestId)
        .maybeSingle();
      
      if (deal) {
        await logDealActivity({
          dealId: deal.id,
          activityType: 'document_email_sent',
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
