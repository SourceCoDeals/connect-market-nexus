import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that automatically sends emails for pending notifications
 * This runs in the background and processes any notifications marked with email_pending
 */
export function useNotificationEmailSender() {
  useEffect(() => {
    let isProcessing = false;

    const processPendingEmails = async () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        // Query for notifications that need email sent
        const { data: pendingNotifications, error } = await supabase
          .from('admin_notifications')
          .select('*')
          .eq('notification_type', 'deal_reassignment')
          .contains('metadata', { email_pending: true })
          .limit(10);

        if (error) {
          console.error('[Email Sender] Error fetching pending notifications:', error);
          return;
        }

        if (!pendingNotifications || pendingNotifications.length === 0) {
          return;
        }

        console.log(`[Email Sender] Processing ${pendingNotifications.length} pending emails`);

        // Process each notification
        for (const notification of pendingNotifications) {
          try {
            const metadata = notification.metadata as any;
            
            // Call edge function to send email
            const { error: emailError } = await supabase.functions.invoke('notify-deal-reassignment', {
              body: {
                dealId: metadata.deal_id,
                dealTitle: metadata.deal_title,
                listingTitle: metadata.listing_title,
                previousOwnerId: metadata.previous_owner_id,
                previousOwnerName: metadata.previous_owner_name,
                previousOwnerEmail: metadata.previous_owner_email,
                newOwnerId: metadata.new_owner_id,
                newOwnerName: metadata.new_owner_name,
                newOwnerEmail: metadata.new_owner_email,
                companyName: metadata.company_name,
              }
            });

            if (emailError) {
              console.error('[Email Sender] Failed to send email for notification:', notification.id, emailError);
              continue;
            }

            // Remove email_pending flag
            const updatedMetadata = { ...metadata };
            delete updatedMetadata.email_pending;
            
            await supabase
              .from('admin_notifications')
              .update({ 
                metadata: { 
                  ...updatedMetadata,
                  email_sent_at: new Date().toISOString()
                }
              })
              .eq('id', notification.id);

            console.log('[Email Sender] Email sent successfully for notification:', notification.id);
          } catch (error) {
            console.error('[Email Sender] Error processing notification:', notification.id, error);
          }
        }
      } finally {
        isProcessing = false;
      }
    };

    // Process immediately on mount
    processPendingEmails();

    // Set up interval to check periodically (every 30 seconds)
    const interval = setInterval(processPendingEmails, 30000);

    // Clean up on unmount
    return () => clearInterval(interval);
  }, []);
}
