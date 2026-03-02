/**
 * useImportSubmit.ts
 *
 * Database import, audit logging, and duplicate resolution logic
 * for the bulk deal import workflow.
 *
 * Extracted from BulkDealImportDialog.tsx for maintainability.
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ImportResult } from '@/hooks/admin/use-bulk-deal-import';

export type DuplicateAction = 'skip' | 'merge' | 'replace' | 'create';

interface HandleDuplicateParams {
  action: DuplicateAction;
  importResult: ImportResult;
  currentDuplicateIndex: number;
  skipAllDuplicates: boolean;
  selectedListingId: string;
  fileName: string;
  onMoveNext: () => void;
}

export async function handleDuplicateAction({
  action,
  importResult,
  currentDuplicateIndex,
  skipAllDuplicates,
  selectedListingId,
  fileName,
  onMoveNext,
}: HandleDuplicateParams) {
  const currentDuplicate = importResult.details.duplicates[currentDuplicateIndex];
  if (!currentDuplicate) return;

  const { deal, duplicateInfo } = currentDuplicate;

  // If skip all duplicates mode is on, just skip
  if (skipAllDuplicates && action === 'skip') {
    onMoveNext();
    return;
  }

  try {
    switch (action) {
      case 'skip':
        toast.info('Skipped duplicate entry');
        break;

      case 'merge': {
        const existingMessage = duplicateInfo.existingMessage || '';
        const newMessageWithDate = `\n\nNew message (${deal.date?.toLocaleDateString() || new Date().toLocaleDateString()}):\n${deal.message}`;
        const mergedMessage = existingMessage + newMessageWithDate;

        const { error: mergeError } = await supabase
          .from('connection_requests')
          .update({
            user_message: mergedMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', duplicateInfo.existingRequestId);

        if (mergeError) throw mergeError;
        toast.success('Messages merged successfully');
        break;
      }

      case 'replace': {
        const { error: replaceError } = await supabase
          .from('connection_requests')
          .update({
            user_message: deal.message,
            lead_role: deal.role,
            lead_phone: deal.phoneNumber || null,
            lead_company: deal.companyName || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', duplicateInfo.existingRequestId);

        if (replaceError) throw replaceError;
        toast.success('Request replaced successfully');
        break;
      }

      case 'create': {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('Not authenticated');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, company, nda_signed, fee_agreement_signed')
          .eq('email', deal.email)
          .maybeSingle();
        if (profileError) throw profileError;

        const { error: createError } = await supabase.from('connection_requests').insert({
          listing_id: selectedListingId,
          user_id: profile?.id || null,
          lead_email: profile ? null : deal.email,
          lead_name: profile ? null : deal.name,
          lead_company: profile ? null : deal.companyName,
          lead_phone: profile ? null : deal.phoneNumber,
          lead_role: deal.role,
          user_message: deal.message,
          source: 'website',
          source_metadata: {
            import_method: 'csv_bulk_upload',
            csv_filename: fileName,
            csv_row_number: deal.csvRowNumber,
            import_date: new Date().toISOString(),
            imported_by_admin_id: user.id,
            forced_duplicate: true,
          },
          created_at: deal.date?.toISOString() || new Date().toISOString(),
        });

        if (createError) throw createError;
        toast.success('Created new request (duplicate allowed)');
        break;
      }
    }
  } catch (error: unknown) {
    toast.error('Failed to process duplicate', {
      description: error instanceof Error ? error.message : String(error),
    });
  }

  onMoveNext();
}

export async function logAudit(params: {
  fileName: string;
  importResult: ImportResult;
  selectedListingId: string;
  batchId: string;
  startTime: number;
}) {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (user) {
      await supabase.from('audit_logs').insert({
        table_name: 'connection_requests',
        operation: 'BULK_IMPORT',
        admin_id: user.id,
        metadata: {
          csv_filename: params.fileName,
          rows_imported: params.importResult.imported,
          rows_duplicated: params.importResult.duplicates,
          rows_errored: params.importResult.errors,
          listing_id: params.selectedListingId,
          import_duration_ms: Date.now() - params.startTime,
          batch_id: params.batchId,
        },
      });
    }
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
