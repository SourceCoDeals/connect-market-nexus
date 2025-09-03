import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DocumentAction {
  dealId: string;
  documentType: 'nda' | 'fee_agreement';
  action: 'send' | 'mark_signed' | 'mark_declined' | 'resend';
  recipientEmail?: string;
  notes?: string;
}

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ dealId, documentType, action, recipientEmail, notes }: DocumentAction) => {
      let status: string;
      let updateField: string;
      let timestampField: string;

      switch (action) {
        case 'send':
          status = 'sent';
          break;
        case 'mark_signed':
          status = 'signed';
          break;
        case 'mark_declined':
          status = 'declined';
          break;
        case 'resend':
          status = 'sent';
          break;
        default:
          throw new Error('Invalid action');
      }

      updateField = documentType === 'nda' ? 'nda_status' : 'fee_agreement_status';
      timestampField = documentType === 'nda' ? 'nda_sent_at' : 'fee_agreement_sent_at';

      const updates: any = {
        [updateField]: status,
        updated_at: new Date().toISOString()
      };

      if (action === 'send' || action === 'resend') {
        updates[timestampField] = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', dealId)
        .select()
        .single();
      
      if (error) throw error;

      // Log the document action
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        activity_type: 'document',
        title: `${documentType.toUpperCase()} ${action.replace('_', ' ')}`,
        description: notes || `${documentType.toUpperCase()} status updated to ${status}`,
        metadata: {
          document_type: documentType,
          action,
          status,
          recipient_email: recipientEmail
        }
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      
      const actionLabels = {
        send: 'sent',
        mark_signed: 'marked as signed',
        mark_declined: 'marked as declined',
        resend: 'resent'
      };
      
      toast({
        title: 'Document Updated',
        description: `${variables.documentType.toUpperCase()} has been ${actionLabels[variables.action]}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update document: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}