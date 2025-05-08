
import { User } from "@/types";
import { AdminConnectionRequest } from "@/types/admin";

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
    
    console.log(`Would send connection approval email to ${request.user.email} for listing ${request.listing.title}`);
    // This is a stub. In the future, we'll implement actual email sending.
    return Promise.resolve();
  };
  
  /**
   * Send an email notification to a user when their connection request is rejected
   */
  const sendConnectionRejectionEmail = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      console.error("Cannot send connection rejection email: missing user or listing data");
      return;
    }
    
    console.log(`Would send connection rejection email to ${request.user.email} for listing ${request.listing.title}. Reason: ${request.admin_comment || 'No reason provided'}`);
    // This is a stub. In the future, we'll implement actual email sending.
    return Promise.resolve();
  };
  
  return {
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail
  };
}
