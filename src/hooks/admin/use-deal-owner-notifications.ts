import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Hook to listen for deal assignment notifications and trigger email notifications
 */
export function useDealOwnerNotifications() {
  useEffect(() => {
    const channel = supabase
      .channel('deal-owner-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
          filter: 'notification_type=eq.deal_assignment'
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const notification = payload.new;
          const metadata = notification.metadata;

          if (!metadata) return;

          try {
            // Send email to new owner
            await supabase.functions.invoke('notify-new-deal-owner', {
              body: {
                dealId: metadata.deal_id,
                dealTitle: metadata.deal_title,
                listingTitle: metadata.listing_title,
                companyName: metadata.company_name,
                newOwnerName: metadata.new_owner_name,
                newOwnerEmail: metadata.new_owner_email,
                buyerName: metadata.buyer_name,
                buyerEmail: metadata.buyer_email,
                buyerCompany: metadata.buyer_company,
                assignedByName: metadata.assigned_by_name
              }
            });
          } catch (error) {
            console.error('Failed to send new owner email notification:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
          filter: 'notification_type=eq.deal_reassignment'
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const notification = payload.new;
          const metadata = notification.metadata;

          if (!metadata || !metadata.previous_owner_email) return;

          try {
            // Send email to previous owner
            await supabase.functions.invoke('notify-deal-reassignment', {
              body: {
                dealId: metadata.deal_id,
                dealTitle: metadata.deal_title,
                listingTitle: metadata.listing_title,
                companyName: metadata.company_name,
                previousOwnerId: metadata.previous_owner_id,
                previousOwnerName: metadata.previous_owner_name,
                previousOwnerEmail: metadata.previous_owner_email,
                newOwnerId: metadata.new_owner_id,
                newOwnerName: metadata.new_owner_name,
                newOwnerEmail: metadata.new_owner_email
              }
            });
          } catch (error) {
            console.error('Failed to send reassignment email notification:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
