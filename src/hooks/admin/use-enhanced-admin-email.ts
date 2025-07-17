
import { User } from "@/types";
import { AdminConnectionRequest } from "@/types/admin";
import { supabase } from "@/integrations/supabase/client";
import { useEmailNotifications } from "../auth/use-email-notifications";

/**
 * Enhanced hook for sending email notifications from admin actions
 */
export function useEnhancedAdminEmail() {
  const { triggerUserJourneyEvent } = useEmailNotifications();

  /**
   * Send an email notification to a user when their account is approved
   */
  const sendUserApprovalEmail = async (user: User) => {
    console.log(`Sending approval email to ${user.email} for user ${user.first_name} ${user.last_name}`);
    
    try {
      const success = await triggerUserJourneyEvent('profile_approved', user);
      
      if (success) {
        console.log(`Approval email sent successfully to ${user.email}`);
      } else {
        console.error(`Failed to send approval email to ${user.email}`);
      }
      
      return success;
    } catch (error) {
      console.error(`Error sending approval email to ${user.email}:`, error);
      return false;
    }
  };
  
  /**
   * Send an email notification to a user when their account is rejected
   */
  const sendUserRejectionEmail = async (user: User, reason?: string) => {
    console.log(`Sending rejection email to ${user.email} for user ${user.first_name} ${user.last_name}. Reason: ${reason || 'No reason provided'}`);
    
    try {
      const success = await triggerUserJourneyEvent('profile_rejected', user, { rejection_reason: reason });
      
      if (success) {
        console.log(`Rejection email sent successfully to ${user.email}`);
      } else {
        console.error(`Failed to send rejection email to ${user.email}`);
      }
      
      return success;
    } catch (error) {
      console.error(`Error sending rejection email to ${user.email}:`, error);
      return false;
    }
  };
  
  /**
   * Send an email notification to a user when their connection request is approved
   */
  const sendConnectionApprovalEmail = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      console.error("Cannot send connection approval email: missing user or listing data");
      return false;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('enhanced-email-delivery', {
        body: {
          type: 'connection_status',
          recipientEmail: request.user.email,
          recipientName: `${request.user.first_name} ${request.user.last_name}`,
          data: {
            status: 'approved',
            listingName: request.listing.title,
            subject: '✅ Your connection request has been approved!',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Great news, ${request.user.first_name}!</h2>
                <p>Your connection request for <strong>${request.listing.title}</strong> has been approved.</p>
                <p>Please log in to your account to view the connection details.</p>
                <a href="https://marketplace.sourcecodeals.com/my-requests" 
                   style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
                  View Connection Details
                </a>
                <p>Best regards,<br>The SourceCo Team</p>
              </div>
            `
          },
          priority: 'high'
        }
      });
      
      if (error) {
        console.error("Error sending connection approval notification:", error);
        return false;
      }
      
      return data?.success || false;
    } catch (error) {
      console.error("Failed to send connection approval email:", error);
      return false;
    }
  };
  
  /**
   * Send an email notification to a user when their connection request is rejected
   */
  const sendConnectionRejectionEmail = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      console.error("Cannot send connection rejection email: missing user or listing data");
      return false;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('enhanced-email-delivery', {
        body: {
          type: 'connection_status',
          recipientEmail: request.user.email,
          recipientName: `${request.user.first_name} ${request.user.last_name}`,
          data: {
            status: 'rejected',
            listingName: request.listing.title,
            subject: '❌ Connection request update',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Hi ${request.user.first_name},</h2>
                <p>We wanted to let you know that your connection request for <strong>${request.listing.title}</strong> was not approved at this time.</p>
                <p>This could be due to various factors such as the business no longer being available or not meeting the current criteria.</p>
                <p>Please continue exploring other opportunities on our marketplace.</p>
                <a href="https://marketplace.sourcecodeals.com/marketplace" 
                   style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
                  Browse Marketplace
                </a>
                <p>If you have questions, please reply to this email.</p>
                <p>Best regards,<br>The SourceCo Team</p>
              </div>
            `
          },
          priority: 'medium'
        }
      });
      
      if (error) {
        console.error("Error sending connection rejection notification:", error);
        return false;
      }
      
      return data?.success || false;
    } catch (error) {
      console.error("Failed to send connection rejection email:", error);
      return false;
    }
  };
  
  /**
   * Send an email notification to admins when a new connection request is submitted
   */
  const sendAdminConnectionRequestEmail = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      console.error("Cannot send admin notification: missing user or listing data");
      return false;
    }
    
    try {
      // Format buyer name
      const buyerName = `${request.user.first_name} ${request.user.last_name}`.trim();
      
      // Format timestamp
      const timestamp = new Date(request.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }) + ' UTC';
      
      const { data, error } = await supabase.functions.invoke('enhanced-email-delivery', {
        body: {
          type: 'admin_notification',
          recipientEmail: 'adam.haile@sourcecodeals.com',
          recipientName: 'Admin',
          data: {
            subject: '🔔 New Connection Request - SourceCo Marketplace',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>New Connection Request</h2>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Listing:</strong> ${request.listing.title}</p>
                  <p><strong>Category:</strong> ${request.listing.category}</p>
                  <p><strong>Location:</strong> ${request.listing.location}</p>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Buyer:</strong> ${buyerName}</p>
                  <p><strong>Email:</strong> ${request.user.email}</p>
                  <p><strong>Company:</strong> ${request.user.company || 'N/A'}</p>
                </div>
                <p><strong>Message:</strong></p>
                <p style="background: #f8f9fa; padding: 10px; border-radius: 4px;">${request.user_message || 'No message provided'}</p>
                <p><strong>Submitted:</strong> ${timestamp}</p>
                <a href="https://marketplace.sourcecodeals.com/admin/requests" 
                   style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
                  Review Request
                </a>
              </div>
            `
          },
          priority: 'high'
        }
      });
      
      if (error) {
        console.error("Error sending admin notification:", error);
        return false;
      }
      
      return data?.success || false;
    } catch (error) {
      console.error("Failed to send admin notification:", error);
      return false;
    }
  };
  
  return {
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail,
    sendAdminConnectionRequestEmail
  };
}
