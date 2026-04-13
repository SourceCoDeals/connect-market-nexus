/**
 * Hook for managing the current user's Outlook email connection.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { EmailConnection } from '@/types/email';

const EMAIL_CONNECTION_KEY = ['email', 'connection'];

export function useEmailConnection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const connectionQuery = useQuery({
    queryKey: [...EMAIL_CONNECTION_KEY, user?.id],
    queryFn: async (): Promise<EmailConnection | null> => {
      if (!user?.id) return null;

      const { data, error } = await (supabase as any)
        .from('email_connections')
        .select('*')
        .eq('sourceco_user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('outlook-auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.error) throw new Error(resp.error.message || 'Failed to start OAuth flow');
      return resp.data?.data as { authUrl: string; state: string };
    },
    onSuccess: (data) => {
      // Redirect to Microsoft OAuth consent screen
      if (data?.authUrl) {
        // Store state in localStorage (persists across tabs, unlike sessionStorage)
        localStorage.setItem('outlook_oauth_state', data.state);
        window.location.href = data.authUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const callbackMutation = useMutation({
    mutationFn: async ({ code, state }: { code: string; state: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('outlook-callback', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { code, state },
      });

      if (resp.error) throw new Error(resp.error.message || 'Callback failed');
      return resp.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_CONNECTION_KEY });
      toast({
        title: 'Outlook Connected',
        description:
          'Your Outlook account has been connected successfully. Initial email sync is running in the background.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async ({ daysBack, targetUserId }: { daysBack: number; targetUserId?: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('outlook-backfill-history', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { daysBack, ...(targetUserId ? { targetUserId } : {}) },
      });

      if (resp.error) throw new Error(resp.error.message || 'Backfill failed');
      return resp.data?.data as {
        targetUserId: string;
        emailAddress: string;
        daysBack: number;
        rematchedFromUnmatchedQueue: number;
        syncResult: { synced: number; skipped: number; queuedUnmatched: number } | null;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: EMAIL_CONNECTION_KEY });
      queryClient.invalidateQueries({ queryKey: ['email', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['email', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['email', 'deal-outlook'] });
      const synced = data?.syncResult?.synced ?? 0;
      const queued = data?.syncResult?.queuedUnmatched ?? 0;
      const rematched = data?.rematchedFromUnmatchedQueue ?? 0;
      toast({
        title: 'Historical Backfill Complete',
        description: `Imported ${synced} matched emails, queued ${queued} for later matching, and re-linked ${rematched} from previous runs.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Backfill Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const bulkBackfillAllMutation = useMutation({
    mutationFn: async ({ daysBack }: { daysBack: number }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('outlook-bulk-backfill-all', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { daysBack },
      });

      if (resp.error) throw new Error(resp.error.message || 'Bulk backfill failed');
      return resp.data?.data as {
        daysBack: number;
        mailboxesProcessed: number;
        mailboxesSucceeded: number;
        mailboxesFailed: number;
        totalSynced: number;
        totalSkipped: number;
        totalQueued: number;
        totalRematched: number;
        results: Array<{
          userId: string;
          emailAddress: string;
          ok: boolean;
          synced?: number;
          skipped?: number;
          queuedUnmatched?: number;
          error?: string;
        }>;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: EMAIL_CONNECTION_KEY });
      queryClient.invalidateQueries({ queryKey: ['email', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['email', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['email', 'deal-outlook'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'email-connections'] });
      const processed = data?.mailboxesProcessed ?? 0;
      const failed = data?.mailboxesFailed ?? 0;
      const synced = data?.totalSynced ?? 0;
      const queued = data?.totalQueued ?? 0;
      const rematched = data?.totalRematched ?? 0;
      toast({
        title: 'Bulk Backfill Complete',
        description: `Processed ${processed} mailboxes (${failed} failed). Imported ${synced} matched emails, queued ${queued} for later matching, and re-linked ${rematched} from previous runs.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk Backfill Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (targetUserId?: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('outlook-disconnect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: targetUserId ? { targetUserId } : {},
      });

      if (resp.error) throw new Error(resp.error.message || 'Disconnect failed');
      return resp.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_CONNECTION_KEY });
      toast({
        title: 'Outlook Disconnected',
        description: 'Your Outlook account has been disconnected. Email history is preserved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Disconnect Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    connection: connectionQuery.data,
    isLoading: connectionQuery.isLoading,
    isConnected: connectionQuery.data?.status === 'active',
    hasError: connectionQuery.data?.status === 'error',
    isExpired: connectionQuery.data?.status === 'expired',

    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,

    handleCallback: callbackMutation.mutate,
    isProcessingCallback: callbackMutation.isPending,

    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,

    backfillHistory: backfillMutation.mutate,
    isBackfilling: backfillMutation.isPending,
    lastBackfillResult: backfillMutation.data,

    bulkBackfillAll: bulkBackfillAllMutation.mutate,
    isBulkBackfilling: bulkBackfillAllMutation.isPending,
    lastBulkBackfillResult: bulkBackfillAllMutation.data,
  };
}
