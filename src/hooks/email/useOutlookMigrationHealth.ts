/**
 * Hook that pings a table introduced by a key Outlook migration and reports
 * whether the database schema is up-to-date with the edge functions. Lets
 * the Outlook settings page surface an actionable banner to admins if the
 * migration hasn't been applied yet — which otherwise manifests as silent
 * sync failures (unmatched emails get dropped because the target queue table
 * doesn't exist).
 *
 * The check is cheap (SELECT with `head: true` + `limit 1`) and hits the
 * production DB through the normal Supabase client, so it respects RLS —
 * which is fine because this hook only runs behind the admin-gated
 * Outlook settings page.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OutlookMigrationHealth {
  /** True if the `outlook_unmatched_emails` table exists and is readable. */
  migrationApplied: boolean;
  /** The raw Postgres error code, if we got one (`42P01` = relation doesn't exist). */
  errorCode: string | null;
  /** Human-readable error, if any. */
  errorMessage: string | null;
}

export function useOutlookMigrationHealth(enabled: boolean = true) {
  return useQuery<OutlookMigrationHealth>({
    queryKey: ['outlook', 'migration-health'],
    queryFn: async () => {
      // Lightweight probe — head request, no rows returned, just asks "does
      // this table exist and am I allowed to read it?"
      const { error } = await (supabase as any)
        .from('outlook_unmatched_emails')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (!error) {
        return { migrationApplied: true, errorCode: null, errorMessage: null };
      }

      // Postgres 42P01 = undefined_table. Supabase surfaces it as `code`
      // on the PostgrestError. Any other error (permission denied, network
      // failure, etc.) means the migration is probably fine but something
      // else is off — we still surface it so the admin has visibility.
      const code = (error as { code?: string }).code || null;
      return {
        migrationApplied: code !== '42P01',
        errorCode: code,
        errorMessage: error.message || null,
      };
    },
    enabled,
    staleTime: 60_000,
    // Don't retry on failure — either the table is there or it isn't.
    retry: false,
  });
}
