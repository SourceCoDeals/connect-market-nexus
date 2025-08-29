import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateInboundLeadData, useCreateInboundLead, useMapLeadToListing, useConvertLeadToRequest } from './use-inbound-leads';
import { toast } from '@/hooks/use-toast';

interface BulkImportResult {
  successCount: number;
  failedCount: number;
  errors: string[];
  createdLeads: any[];
}

interface BulkMapAndConvertResult {
  mappedCount: number;
  convertedCount: number;
  failedCount: number;
  errors: string[];
}

export function useEnhancedBulkLeadOperations() {
  const queryClient = useQueryClient();
  const createLead = useCreateInboundLead();
  const mapLead = useMapLeadToListing();
  const convertLead = useConvertLeadToRequest();

  const bulkImportWithMapping = useMutation({
    mutationFn: async ({
      leads,
      listingId,
      listingTitle,
      shouldConvert = false
    }: {
      leads: CreateInboundLeadData[];
      listingId?: string;
      listingTitle?: string;
      shouldConvert?: boolean;
    }): Promise<BulkImportResult & BulkMapAndConvertResult> => {
      const errors: string[] = [];
      const createdLeads: any[] = [];
      let successCount = 0;
      let failedCount = 0;
      let mappedCount = 0;
      let convertedCount = 0;

      // Step 1: Create all leads
      for (const leadData of leads) {
        try {
          const response = await createLead.mutateAsync(leadData);
          createdLeads.push(response);
          successCount++;
        } catch (error) {
          failedCount++;
          errors.push(`Failed to create lead ${leadData.name}: ${(error as any)?.message || 'Unknown error'}`);
        }
      }

      // Step 2: If listing is selected, map and optionally convert leads
      if (listingId && listingTitle && createdLeads.length > 0) {
        for (const createdLead of createdLeads) {
          try {
            // Map the lead to the listing
            await mapLead.mutateAsync({
              leadId: createdLead.id,
              listingId,
              listingTitle,
              skipDuplicateCheck: true // Skip duplicate check for bulk operations
            });
            mappedCount++;

            // If auto-convert is enabled, convert to connection request
            if (shouldConvert) {
              try {
                await convertLead.mutateAsync(createdLead.id);
                convertedCount++;
              } catch (convertError) {
                errors.push(`Failed to convert lead ${createdLead.name}: ${(convertError as any)?.message || 'Unknown error'}`);
              }
            }
          } catch (mapError) {
            errors.push(`Failed to map lead ${createdLead.name}: ${(mapError as any)?.message || 'Unknown error'}`);
          }
        }
      }

      return {
        successCount,
        failedCount,
        errors,
        createdLeads,
        mappedCount,
        convertedCount
      };
    },
    onSuccess: (result) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });

      // Show appropriate success message
      const { successCount, mappedCount, convertedCount, errors } = result;
      
      let message = `Successfully imported ${successCount} lead${successCount !== 1 ? 's' : ''}`;
      if (mappedCount > 0) {
        message += `, mapped ${mappedCount}`;
      }
      if (convertedCount > 0) {
        message += `, and converted ${convertedCount} to connection requests`;
      }

      toast({
        title: "Bulk import completed",
        description: message,
        variant: errors.length > 0 ? "default" : "default"
      });

      // Show errors if any
      if (errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Some operations failed",
          description: `${errors.length} error(s) occurred. Check the console for details.`,
        });
        console.error('Bulk import errors:', errors);
      }
    },
    onError: (error) => {
      console.error('Bulk import failed:', error);
      toast({
        variant: "destructive",
        title: "Bulk import failed",
        description: (error as any)?.message || "Could not complete the bulk import operation",
      });
    },
  });

  return {
    bulkImportWithMapping,
    isLoading: bulkImportWithMapping.isPending
  };
}