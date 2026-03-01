/**
 * use-deal-stage.ts
 *
 * Mutation hook for moving a deal between pipeline stages,
 * including ownership checks, optimistic updates, owner-intro
 * email triggers, and notification side-effects.
 *
 * Extracted from use-deals.ts
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Deal } from '@/types/deals';

export function useUpdateDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      stageId,
      currentAdminId,
      skipOwnerCheck,
    }: {
      dealId: string;
      stageId: string;
      fromStage?: string;
      toStage?: string;
      currentAdminId?: string;
      skipOwnerCheck?: boolean;
    }) => {
      // If not skipping owner check, verify ownership first
      if (!skipOwnerCheck && currentAdminId) {
        const { data: dealData, error: dealDataError } = await supabase
          .from('deals')
          .select(
            'assigned_to, title, assigned_admin:profiles!deals_assigned_to_fkey(first_name, last_name)',
          )
          .eq('id', dealId)
          .single();
        if (dealDataError) throw dealDataError;

        // Check if someone else owns this deal
        if (dealData?.assigned_to && dealData.assigned_to !== currentAdminId) {
          const ownerName = dealData.assigned_admin
            ? `${dealData.assigned_admin.first_name} ${dealData.assigned_admin.last_name}`.trim()
            : 'Another admin';

          // Return a special error that will trigger the warning dialog
          throw {
            type: 'OWNER_WARNING',
            ownerName,
            dealTitle: dealData.title,
            ownerId: dealData.assigned_to,
            dealId,
            stageId,
          };
        }
      }

      // Use new RPC function with ownership logic
      const { data, error } = await (supabase.rpc as any)('move_deal_stage_with_ownership', {
        p_deal_id: dealId,
        p_new_stage_id: stageId,
        p_current_admin_id: currentAdminId,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ dealId, stageId, toStage }) => {
      // cancel ongoing refetches
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals']);
      const nowIso = new Date().toISOString();
      if (previousDeals) {
        queryClient.setQueryData<Deal[]>(['deals'], (old) =>
          (old || []).map((d) =>
            d.deal_id === dealId
              ? {
                  ...d,
                  stage_id: stageId,
                  stage_name: toStage ?? d.stage_name,
                  deal_stage_entered_at: nowIso,
                  deal_updated_at: nowIso,
                }
              : d,
          ),
        );
      }
      return { previousDeals };
    },
    onSuccess: async (data: unknown, variables) => {
      const result = data as Record<string, unknown> | null;
      // Handle ownership assignment notifications
      if (result?.owner_assigned) {
        toast({
          title: 'Deal Assigned',
          description: 'You have been assigned as the owner of this deal.',
        });
      }

      if (result?.different_owner_warning) {
        toast({
          title: 'Different Owner',
          description: `This deal is owned by ${result.previous_owner_name || 'another admin'}. They will be notified of this change.`,
          variant: 'default',
        });

        // Send email notification to original owner
        const deals = queryClient.getQueryData<Deal[]>(['deals']);
        const deal = deals?.find((d) => d.deal_id === variables.dealId);

        if (deal && result.previous_owner_id && result.previous_owner_name) {
          try {
            // Get current admin info
            const {
              data: { user },
              error: authError,
            } = await supabase.auth.getUser();
            if (authError) throw authError;
            const { data: currentAdmin, error: currentAdminError } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', user?.id ?? '')
              .single();
            if (currentAdminError) throw currentAdminError;

            const currentAdminName = currentAdmin
              ? `${currentAdmin.first_name} ${currentAdmin.last_name}`.trim()
              : 'Another admin';

            await supabase.functions.invoke('notify-deal-owner-change', {
              body: {
                dealId: deal.deal_id,
                dealTitle: deal.title,
                previousOwnerId: result.previous_owner_id,
                previousOwnerName: result.previous_owner_name,
                modifyingAdminId: user?.id,
                modifyingAdminName: currentAdminName,
                oldStageName: result.old_stage_name,
                newStageName: result.new_stage_name,
                listingTitle: deal.listing_title,
                companyName: deal.listing_real_company_name,
              },
            });
          } catch (error) {
            console.error('Failed to send owner change notification:', error);
            // Don't fail the stage move, just log
          }
        }
      }

      // Check if moved to "Owner intro requested" stage and trigger email
      const newStageName = result?.new_stage_name as string | undefined;
      if (newStageName === 'Owner intro requested') {
        const deals = queryClient.getQueryData<Deal[]>(['deals']);
        const deal = deals?.find((d) => d.deal_id === variables.dealId);

        if (deal && deal.listing_id) {
          try {
            // Get deal owner info
            const { data: ownerData, error: ownerDataError } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', deal.assigned_to ?? '')
              .single();
            if (ownerDataError) throw ownerDataError;

            const dealOwnerName = ownerData
              ? `${ownerData.first_name} ${ownerData.last_name}`.trim()
              : undefined;
            const dealOwnerEmail = ownerData?.email;

            const result = await supabase.functions.invoke('send-owner-intro-notification', {
              body: {
                dealId: deal.deal_id,
                listingId: deal.listing_id,
                buyerName: deal.buyer_name || deal.contact_name || 'Unknown',
                buyerEmail: deal.buyer_email || deal.contact_email || '',
                buyerCompany: deal.buyer_company || deal.contact_company,
                dealValue: deal.deal_value,
                dealTitle: deal.title,
                dealOwnerName,
                dealOwnerEmail,
              },
            });

            if (result.error) {
              toast({
                title: 'Notification Failed',
                description:
                  'The owner intro email could not be sent. Please notify the owner manually.',
                variant: 'destructive',
              });
            } else if (result.data?.success) {
              if (result.data?.duplicate) {
                toast({
                  title: 'Already Notified',
                  description: 'This owner was recently notified about this introduction.',
                });
              } else {
                const ownerName = result.data.primary_owner_name || 'the primary owner';
                toast({
                  title: 'Owner Notified',
                  description: `${ownerName} has been notified of this introduction request via email.`,
                });
              }
            } else {
              toast({
                title: 'Stage Updated',
                description: 'The stage was moved but notification status is unknown.',
              });
            }
          } catch (error) {
            console.error('Failed to send owner intro notification:', error);
            // Don't fail the stage move, just log
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-activities'] });

      if (!result?.owner_assigned && !result?.different_owner_warning) {
        toast({
          title: 'Deal Updated',
          description: 'Deal stage has been updated successfully.',
        });
      }
    },
    onError: (error: unknown, _vars, context) => {
      // Don't show error toast for OWNER_WARNING - that's handled by the dialog
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        (error as Record<string, unknown>).type === 'OWNER_WARNING'
      ) {
        return;
      }

      if (context?.previousDeals) {
        queryClient.setQueryData(['deals'], context.previousDeals);
      }
      toast({
        title: 'Error',
        description: `Failed to update deal stage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });
}
