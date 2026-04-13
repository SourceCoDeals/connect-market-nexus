/**
 * Hook for managing the current user's Outlook email connection.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { EmailConnection } from '@/types/email';

const EMAIL_CONNECTION_KEY = ['email', 'connection'];

/**
 * Extract a human-readable message from the various error shapes
 * `supabase.functions.invoke` can return:
 *
 *   - `FunctionsHttpError`   — the function responded with non-2xx; the
 *                              body is on `error.context.body` (as a
 *                              Response we can await) but the Supabase
 *                              client already flattens `.message` to
 *                              something like "Edge Function returned a
 *                              non-2xx status code".
 *   - `FunctionsFetchError`  — the request couldn't even be delivered
 *                              (platform timeout, network blip). Message is
 *                              "Failed to send a request to the Edge
 *                              Function". This is the exact error surfaced
 *                              in the Outlook backfill bug screenshot.
 *   - `FunctionsRelayError`  — infrastructure error talking to the Edge
 *                              Runtime relay.
 *   - plain `Error` / string / `undefined` — belt-and-braces fallback.
 *
 * For `FunctionsHttpError` we *also* try to read the JSON body we returned
 * from our own `errorResponse` helper, which always exposes a user-facing
 * `error` string. That way callers see "Only admins can backfill…" instead
 * of "Edge Function returned a non-2xx status code".
 *
 * Exported for unit testing.
 */
export async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  if (!error) return fallback;

  // Try to dig the server-provided error string out of the response body.
  // FunctionsHttpError exposes the original Response on `context`.
  const ctx = (error as { context?: unknown }).context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).clone().json();
      if (body && typeof body === 'object') {
        const serverMessage =
          (body as { error?: string }).error || (body as { message?: string }).message;
        if (serverMessage && typeof serverMessage === 'string') {
          return serverMessage;
        }
      }
    } catch {
      // body wasn't JSON — fall through
    }
  }

  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

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

      if (resp.error) {
        throw new Error(await extractFunctionError(resp.error, 'Failed to start OAuth flow'));
      }
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

      if (resp.error) {
        throw new Error(await extractFunctionError(resp.error, 'Callback failed'));
      }
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

      if (resp.error) {
        throw new Error(await extractFunctionError(resp.error, 'Backfill failed'));
      }
      // NOTE: `syncResult` is intentionally null here now that the sync runs
      // as a background task server-side — the real counts aren't known until
      // well after the HTTP response returns. We still include the legacy
      // field on the type for existing consumers.
      return resp.data?.data as {
        targetUserId: string;
        emailAddress: string;
        daysBack: number;
        status?: 'started';
        message?: string;
        rematchedFromUnmatchedQueue: number;
        syncResult: { synced: number; skipped: number; queuedUnmatched: number } | null;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: EMAIL_CONNECTION_KEY });
      queryClient.invalidateQueries({ queryKey: ['email', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['email', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['email', 'deal-outlook'] });
      toast({
        title: 'Backfill Started',
        description:
          data?.message ||
          `Importing up to ${data?.daysBack ?? ''} days of Outlook history in the background. Refresh this page in a couple of minutes to see the imported emails.`,
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

      if (resp.error) {
        throw new Error(await extractFunctionError(resp.error, 'Bulk backfill failed'));
      }
      // NOTE: per-mailbox synced/skipped/queued counts are intentionally
      // zero in the initial response because the work runs as a background
      // task server-side (see outlook-bulk-backfill-all). The `results`
      // array lists the mailboxes that were queued for processing.
      return resp.data?.data as {
        daysBack: number;
        status?: 'started';
        message?: string;
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
      const queued = data?.mailboxesProcessed ?? 0;
      toast({
        title: 'Bulk Backfill Started',
        description:
          data?.message ||
          `Queued ${queued} mailbox${
            queued === 1 ? '' : 'es'
          } for background backfill. Refresh this page in a couple of minutes to see results.`,
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

      if (resp.error) {
        throw new Error(await extractFunctionError(resp.error, 'Disconnect failed'));
      }
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
