import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkImportDeal {
  csvRowNumber: number;
  date: Date | null;
  name: string;
  email: string;
  companyName: string;
  phoneNumber: string;
  role: string;
  message: string;
}

interface BulkImportData {
  listingId: string;
  deals: BulkImportDeal[];
  fileName: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  details: {
    imported: any[];
    duplicates: any[];
    errors: any[];
  };
}

export function useBulkDealImport() {
  const queryClient = useQueryClient();

  const bulkImport = useMutation({
    mutationFn: async (data: BulkImportData): Promise<ImportResult> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const result: ImportResult = {
        imported: 0,
        duplicates: 0,
        errors: 0,
        details: {
          imported: [],
          duplicates: [],
          errors: [],
        },
      };

      for (const deal of data.deals) {
        try {
          // 1. Check if user exists in profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, nda_signed, fee_agreement_signed')
            .eq('email', deal.email)
            .maybeSingle();

          // 2. Check for duplicates
          let duplicateQuery = supabase
            .from('connection_requests')
            .select('id, status, user_message')
            .eq('listing_id', data.listingId);

          if (profile?.id) {
            duplicateQuery = duplicateQuery.eq('user_id', profile.id);
          } else {
            duplicateQuery = duplicateQuery.eq('lead_email', deal.email);
          }

          const { data: existingRequest } = await duplicateQuery.maybeSingle();

          if (existingRequest) {
            result.duplicates++;
            result.details.duplicates.push({
              deal,
              existingRequestId: existingRequest.id,
              existingStatus: existingRequest.status,
            });
            continue;
          }

          // 3. Insert connection request
          const { data: newRequest, error } = await supabase
            .from('connection_requests')
            .insert({
              listing_id: data.listingId,
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
                csv_filename: data.fileName,
                csv_row_number: deal.csvRowNumber,
                import_date: new Date().toISOString(),
                imported_by_admin_id: user.id,
              },
              created_at: deal.date?.toISOString() || new Date().toISOString(),
            })
            .select()
            .single();

          if (error) throw error;

          result.imported++;
          result.details.imported.push(newRequest);
        } catch (error: any) {
          result.errors++;
          result.details.errors.push({
            deal,
            error: error.message,
          });
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });

      if (result.imported > 0) {
        toast.success(
          `Successfully imported ${result.imported} connection request(s)`,
          {
            description: result.duplicates > 0 
              ? `Skipped ${result.duplicates} duplicate(s)` 
              : undefined,
          }
        );
      }

      if (result.errors > 0) {
        toast.error(`Failed to import ${result.errors} row(s)`, {
          description: 'Check console for details',
        });
        console.error('Import errors:', result.details.errors);
      }

      if (result.duplicates > 0 && result.imported === 0) {
        toast.warning(`All ${result.duplicates} entries were duplicates`, {
          description: 'No new requests were created',
        });
      }
    },
    onError: (error: any) => {
      toast.error('Bulk import failed', {
        description: error.message,
      });
    },
  });

  return {
    bulkImport: bulkImport.mutateAsync,
    isLoading: bulkImport.isPending,
  };
}
