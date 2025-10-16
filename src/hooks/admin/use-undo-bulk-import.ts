import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useUndoBulkImport() {
  const queryClient = useQueryClient();

  const undoImport = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find all connection requests from this batch
      const { data: requests, error: fetchError } = await supabase
        .from('connection_requests')
        .select('id, listing_id, lead_email, lead_name')
        .contains('source_metadata', { batch_id: batchId });

      if (fetchError) throw fetchError;
      if (!requests || requests.length === 0) {
        throw new Error('No requests found for this import batch');
      }

      const requestIds = requests.map(r => r.id);

      // Delete all connection requests from this batch
      const { error: deleteError } = await supabase
        .from('connection_requests')
        .delete()
        .in('id', requestIds);

      if (deleteError) throw deleteError;

      // Log the undo action
      await supabase.from('audit_logs').insert({
        table_name: 'connection_requests',
        operation: 'BULK_UNDO',
        admin_id: user.id,
        metadata: {
          batch_id: batchId,
          deleted_count: requests.length,
          undo_timestamp: new Date().toISOString(),
        },
      });

      return {
        deletedCount: requests.length,
        requests,
      };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['deals'] }),
        queryClient.invalidateQueries({ queryKey: ['connection-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['connection-request-stages'] }),
      ]);

      toast.success(
        `Successfully removed ${result.deletedCount} imported connection requests`,
        {
          description: 'The bulk import has been undone',
        }
      );
    },
    onError: (error: any) => {
      toast.error('Failed to undo import', {
        description: error.message,
      });
    },
  });

  return {
    undoImport: undoImport.mutateAsync,
    isUndoing: undoImport.isPending,
  };
}
