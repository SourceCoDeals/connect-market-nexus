import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReferralData {
  listingId: string;
  recipientEmail: string;
  recipientName?: string;
  personalMessage?: string;
}

export function useSendDealReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ReferralData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Create referral record
      const { error: dbError } = await supabase
        .from('deal_referrals')
        .insert({
          listing_id: data.listingId,
          referrer_user_id: session.user.id,
          recipient_email: data.recipientEmail,
          recipient_name: data.recipientName || null,
          personal_message: data.personalMessage || null,
        });

      if (dbError) throw dbError;

      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-deal-referral', {
        body: {
          listingId: data.listingId,
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName,
          personalMessage: data.personalMessage,
        },
      });

      if (emailError) throw emailError;

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-referrals'] });
      toast({
        title: 'Deal shared',
        description: 'Your colleague will receive an email with the deal details.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to share deal',
      });
    },
  });
}
