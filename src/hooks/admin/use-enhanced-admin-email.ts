
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
    // Sending approval email
    
    try {
      const success = await triggerUserJourneyEvent('profile_approved', user);
      
      if (success) {
        // Approval email sent successfully
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
    // Sending rejection email
    
    try {
      const success = await triggerUserJourneyEvent('profile_rejected', user, { rejection_reason: reason });
      
      if (success) {
        // Rejection email sent successfully
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
      // Get the current admin's profile for signature
      const { data: { user } } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', user?.id)
        .single();

      // Default signature
      let signature = `Adam Haile
Founder & CEO, SourceCo
adam.haile@sourcecodeals.com`;

      // Use dynamic signature if admin profile found
      if (adminProfile && adminProfile.email) {
        if (adminProfile.email === 'bill.martin@sourcecodeals.com') {
          signature = `Bill Martin
Principal & SVP - Growth, SourceCo
bill.martin@sourcecodeals.com`;
        } else if (adminProfile.email === 'adam.haile@sourcecodeals.com') {
          signature = `Adam Haile
Growth Marketing
adam.haile@sourcecodeals.com`;
        } else {
          // For other admins, use their name and email
          const name = `${adminProfile.first_name} ${adminProfile.last_name}`.trim();
          signature = `${name}
SourceCo
${adminProfile.email}`;
        }
      }

      const { data, error } = await supabase.functions.invoke('send-user-notification', {
        body: {
          email: request.user.email,
          subject: '✅ Connection Request Approved',
          message: `${request.user.first_name},

Great news! Your connection request for "${request.listing.title}" has been approved.

We're now coordinating next steps and will follow up with you shortly to move this forward.

If you have any questions, please reply to this email.

${signature}`,
          type: 'connection_approved',
          fromEmail: adminProfile?.email || 'adam.haile@sourcecodeals.com'
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
