import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
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
        is_sent: value,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
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
        is_sent: value,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({ title: 'Lead fee agreement email status updated' });
    },
  });
};
