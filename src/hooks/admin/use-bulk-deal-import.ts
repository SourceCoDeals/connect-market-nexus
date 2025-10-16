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
  batchId?: string;
}

export type DuplicateType = 
  | 'exact_user_and_listing' 
  | 'lead_email_and_listing' 
  | 'same_company_different_email'
  | 'cross_source_inbound_lead';

export interface DuplicateInfo {
  type: DuplicateType;
  existingRequestId: string;
  existingStatus: string;
  existingMessage?: string;
  existingCreatedAt?: string;
  userProfile?: {
    id: string;
    email: string;
    company: string;
  };
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  skipped: number;
  details: {
    imported: Array<{
      deal: BulkImportDeal;
      connectionRequestId: string;
      dealId?: string;
      linkedToUser: boolean;
      userId?: string;
      userName?: string;
      userEmail?: string;
      userCompany?: string;
    }>;
    duplicates: Array<{
      deal: BulkImportDeal;
      duplicateInfo: DuplicateInfo;
    }>;
    errors: Array<{
      deal: BulkImportDeal;
      error: string;
    }>;
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
        skipped: 0,
        details: {
          imported: [],
          duplicates: [],
          errors: [],
        },
      };

      for (const deal of data.deals) {
        try {
          // ===== LEVEL 1: Check if user exists in profiles =====
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, company, first_name, last_name, nda_signed, fee_agreement_signed, nda_email_sent, fee_agreement_email_sent')
            .eq('email', deal.email)
            .maybeSingle();

          // ===== LEVEL 2 & 3: Check for duplicate connection requests =====
          const { data: existingRequests } = await supabase
            .from('connection_requests')
            .select('id, status, user_message, created_at, user_id, lead_email')
            .eq('listing_id', data.listingId)
            .or(
              profile?.id 
                ? `user_id.eq.${profile.id},lead_email.eq.${deal.email}`
                : `lead_email.eq.${deal.email}`
            );

          if (existingRequests && existingRequests.length > 0) {
            const existingRequest = existingRequests[0];
            const duplicateType: DuplicateType = 
              existingRequest.user_id === profile?.id 
                ? 'exact_user_and_listing' 
                : 'lead_email_and_listing';

            result.duplicates++;
            result.details.duplicates.push({
              deal,
              duplicateInfo: {
                type: duplicateType,
                existingRequestId: existingRequest.id,
                existingStatus: existingRequest.status,
                existingMessage: existingRequest.user_message,
                existingCreatedAt: existingRequest.created_at,
                userProfile: profile ? {
                  id: profile.id,
                  email: profile.email,
                  company: profile.company || deal.companyName,
                } : undefined,
              },
            });
            continue;
          }

          // ===== LEVEL 4: Check for same company + same listing (different email) =====
          if (deal.companyName && deal.companyName.length > 3) {
            const { data: companyRequests } = await supabase
              .from('connection_requests')
              .select('id, status, user_message, created_at, lead_email, lead_company')
              .eq('listing_id', data.listingId)
              .ilike('lead_company', `%${deal.companyName}%`)
              .neq('lead_email', deal.email)
              .limit(1);

            if (companyRequests && companyRequests.length > 0) {
              const companyRequest = companyRequests[0];
              result.duplicates++;
              result.details.duplicates.push({
                deal,
                duplicateInfo: {
                  type: 'same_company_different_email',
                  existingRequestId: companyRequest.id,
                  existingStatus: companyRequest.status,
                  existingMessage: companyRequest.user_message,
                  existingCreatedAt: companyRequest.created_at,
                },
              });
              continue;
            }
          }

          // ===== LEVEL 5: Check cross-source from inbound_leads =====
          const { data: inboundLeads } = await supabase
            .from('inbound_leads')
            .select('id, email, converted_to_request_id, mapped_to_listing_id')
            .eq('email', deal.email)
            .not('converted_to_request_id', 'is', null)
            .limit(1);

          if (inboundLeads && inboundLeads.length > 0 && inboundLeads[0].mapped_to_listing_id === data.listingId) {
            const inboundLead = inboundLeads[0];
            result.duplicates++;
            result.details.duplicates.push({
              deal,
              duplicateInfo: {
                type: 'cross_source_inbound_lead',
                existingRequestId: inboundLead.converted_to_request_id!,
                existingStatus: 'converted_from_inbound_lead',
              },
            });
            continue;
          }

          // ===== NO DUPLICATES: Insert new connection request =====
          const { data: newRequest, error } = await supabase
            .from('connection_requests')
            .insert({
              listing_id: data.listingId,
              user_id: profile?.id || null,
              // Populate lead fields from user profile if exists, otherwise from CSV
              lead_email: profile?.email || deal.email,
              lead_name: profile 
                ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || deal.name
                : deal.name,
              lead_company: profile?.company || deal.companyName || null,
              lead_phone: deal.phoneNumber || null,
              lead_role: deal.role,
              user_message: deal.message,
              source: 'website',
              source_metadata: {
                import_method: 'csv_bulk_upload',
                csv_filename: data.fileName,
                csv_row_number: deal.csvRowNumber,
                import_date: new Date().toISOString(),
                imported_by_admin_id: user.id,
                batch_id: data.batchId || null, // Track batch for undo capability
              },
              // Use CSV date if available, otherwise current time
              created_at: deal.date?.toISOString() || new Date().toISOString(),
            })
            .select()
            .single();

          if (error) throw error;

          result.imported++;
          result.details.imported.push({
            deal,
            connectionRequestId: newRequest.id,
            linkedToUser: !!profile?.id,
            userId: profile?.id,
            userName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined,
            userEmail: profile?.email,
            userCompany: profile?.company || undefined,
          });

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
    onSuccess: async (result) => {
      // Comprehensive query invalidation to ensure UI updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['deals'] }),
        queryClient.invalidateQueries({ queryKey: ['connection-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['deal-stages'] }),
        queryClient.invalidateQueries({ queryKey: ['inbound-leads'] }),
      ]);

      if (result.imported > 0) {
        toast.success(
          `Successfully imported ${result.imported} connection request(s)`,
          {
            description: result.duplicates > 0 
              ? `Found ${result.duplicates} duplicate(s) to review` 
              : 'Connection requests and deals created',
          }
        );
      }

      if (result.errors > 0) {
        toast.error(`Failed to import ${result.errors} row(s)`, {
          description: 'See error details in the import summary',
        });
        console.error('Import errors:', result.details.errors);
      }

      if (result.duplicates > 0 && result.imported === 0) {
        toast.warning(`All ${result.duplicates} entries were duplicates`, {
          description: 'Review duplicates to decide how to handle them',
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
