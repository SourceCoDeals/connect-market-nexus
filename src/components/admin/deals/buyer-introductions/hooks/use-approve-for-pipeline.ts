import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logDealActivity } from '@/lib/deal-activity-logger';
import type { BuyerIntroduction, ScoreSnapshot } from '@/types/buyer-introductions';

interface ApproveParams {
  buyer: BuyerIntroduction;
  listingId: string;
  listingTitle: string;
}

export function useApproveForPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ buyer, listingId, listingTitle }: ApproveParams) => {
      // Get the first (default) deal stage
      const { data: stages, error: stageError } = await supabase
        .from('deal_stages')
        .select('id, name')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .limit(1);

      if (stageError) throw stageError;

      const firstStage = stages?.[0];
      if (!firstStage) {
        throw new Error('No active deal stages found. Please create a pipeline stage first.');
      }

      const dealTitle = `${buyer.buyer_firm_name} — ${listingTitle}`;

      // Upsert buyer contact if we have email
      let buyerContactId: string | null = null;
      if (buyer.buyer_email) {
        const nameParts = buyer.buyer_name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: contact } = await supabase
          .from('contacts')
          .upsert(
            {
              first_name: firstName,
              last_name: lastName,
              email: buyer.buyer_email.toLowerCase().trim(),
              phone: buyer.buyer_phone || null,
              contact_type: 'buyer',
              source: 'remarketing_fit_interested',
            },
            { onConflict: 'email' },
          )
          .select('id')
          .single();

        if (contact) {
          buyerContactId = contact.id;
        }
      }

      // Create the deal in the pipeline
      const { data: newDeal, error: dealError } = await supabase
        .from('deal_pipeline')
        .insert({
          title: dealTitle,
          description: `Created from Introduction Pipeline: ${buyer.buyer_name} at ${buyer.buyer_firm_name} approved for deal pipeline.${buyer.buyer_feedback ? `\n\nBuyer feedback: ${buyer.buyer_feedback}` : ''}${buyer.next_step ? `\nNext step: ${buyer.next_step}` : ''}`,
          stage_id: firstStage.id,
          listing_id: listingId,
          source: 'remarketing',
          nda_status: 'not_sent',
          fee_agreement_status: 'not_sent',
          buyer_contact_id: buyerContactId,
          remarketing_buyer_id: buyer.id,
          value: buyer.expected_deal_size_low || 0,
          probability: 25,
          priority: 'medium',
        } as never)
        .select()
        .single();

      if (dealError) throw dealError;

      // Update the introduction status to fit_and_interested
      const { error: updateError } = await supabase
        .from('buyer_introductions' as never)
        .update({
          introduction_status: 'fit_and_interested',
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', buyer.id);

      if (updateError) throw updateError;

      // Log status change
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('introduction_status_log' as never).insert({
        buyer_introduction_id: buyer.id,
        old_status: buyer.introduction_status,
        new_status: 'fit_and_interested',
        changed_by: user?.id,
      } as never);

      // Log the deal creation activity
      if (newDeal?.id) {
        await logDealActivity({
          dealId: newDeal.id,
          activityType: 'deal_created',
          title: 'Opportunity Created from Introduction Pipeline',
          description: `Deal created when ${buyer.buyer_name} (${buyer.buyer_firm_name}) was approved for the deal pipeline`,
          metadata: {
            buyer_introduction_id: buyer.id,
            buyer_name: buyer.buyer_name,
            buyer_firm: buyer.buyer_firm_name,
            source: 'introduction_pipeline_approval',
          },
        });
      }

      return { dealId: newDeal?.id, stageName: firstStage.name };
    },
    onSuccess: (_data, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-introductions', listingId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal-stages'] });
      toast.success('Buyer approved — deal pipeline entry created');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to approve buyer for pipeline');
    },
  });
}
