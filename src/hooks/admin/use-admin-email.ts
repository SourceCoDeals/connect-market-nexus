
import { User } from "@/types";
import { AdminConnectionRequest } from "@/types/admin";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook for sending email notifications from admin actions
 */
export function useAdminEmail() {
  /**
   * Send an email notification to a user when their account is approved
   */
  const sendUserApprovalEmail = async (user: User) => {
    console.log(`Would send approval email to ${user.email} for user ${user.first_name} ${user.last_name}`);
    // This is a stub. In the future, we'll implement actual email sending.
    return Promise.resolve();
  };
  
  /**
   * Send an email notification to a user when their account is rejected
   */
  const sendUserRejectionEmail = async (user: User, reason?: string) => {
    console.log(`Would send rejection email to ${user.email} for user ${user.first_name} ${user.last_name}. Reason: ${reason || 'No reason provided'}`);
    // This is a stub. In the future, we'll implement actual email sending.
    return Promise.resolve();
  };
  
  /**
   * Send an email notification to a user when their connection request is approved
   */
  const sendConnectionApprovalEmail = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      console.error("Cannot send connection approval email: missing user or listing data");
      return;
    }
    
    try {
      const notificationPayload = {
        type: 'approved',
        userId: request.user.id,
        userEmail: request.user.email,
        firstName: request.user.first_name,
        listingName: request.listing.title
      };
      
      const { error } = await supabase.functions.invoke(
        "send-connection-notification", 
        { 
          body: JSON.stringify(notificationPayload) 
        }
      );
      
      if (error) {
        console.error("Error sending connection approval notification:", error);
      }
    } catch (error) {
      console.error("Failed to send connection approval email:", error);
    }
  };
  
  /**
   * Send an email notification to a user when their connection request is rejected
   */
  const sendConnectionRejectionEmail = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      console.error("Cannot send connection rejection email: missing user or listing data");
      return;
    }
    
    try {
      const notificationPayload = {
        type: 'rejected',
        userId: request.user.id,
        userEmail: request.user.email,
        firstName: request.user.first_name,
        listingName: request.listing.title
      };
      
      const { error } = await supabase.functions.invoke(
        "send-connection-notification", 
        { 
          body: JSON.stringify(notificationPayload) 
        }
      );
      
      if (error) {
        console.error("Error sending connection rejection notification:", error);
      }
    } catch (error) {
      console.error("Failed to send connection rejection email:", error);
    }
  };
  
  return {
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail
  };
}
