
import { User } from "@/types";
import { AdminConnectionRequest } from "@/types/admin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmailDeliveryMonitoring } from "./use-email-delivery-monitoring";

/**
 * Hook for sending email notifications from admin actions
 */
export function useAdminEmail() {
  const { toast } = useToast();
  const { trackEmailDelivery } = useEmailDeliveryMonitoring();
  /**
   * Send an email notification to a user when their account is approved
   */
  const sendUserApprovalEmail = async (user: User) => {
    console.log(`🔔 Sending approval email to ${user.email} for user ${user.first_name} ${user.last_name}`);
    const correlationId = `approval-${user.id}-${Date.now()}`;
    
    try {
      const notificationPayload = {
        type: 'approved',
        userEmail: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      };
      
      const { data, error } = await supabase.functions.invoke(
        "send-user-notification", 
        { 
          body: notificationPayload
        }
      );
      
      if (error) {
        console.error("❌ Error sending user approval notification:", error);
        trackEmailDelivery(correlationId, {
          success: false,
          error: error.message || 'Failed to send approval email'
        });
        throw error;
      }
      
      if (data && !data.success) {
        console.error("❌ Failed to send user approval email:", data.message);
        trackEmailDelivery(correlationId, {
          success: false,
          error: data.message || 'Failed to send approval email'
        });
        throw new Error(data.message || 'Failed to send approval email');
      }
      
      console.log("✅ User approval email sent successfully");
      trackEmailDelivery(correlationId, {
        success: true,
        messageId: data?.messageId,
        emailProvider: data?.emailProvider
      });
      
      toast({
        title: "Email sent",
        description: `Approval email sent to ${user.email}`,
      });
      
      return true;
    } catch (error) {
      console.error("💥 Failed to send user approval email:", error);
      trackEmailDelivery(correlationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        variant: "destructive",
        title: "Email failed",
        description: "Failed to send approval email. Please try again.",
      });
      throw error;
    }
  };
  
  /**
   * Send an email notification to a user when their account is rejected
   */
  const sendUserRejectionEmail = async (user: User, reason?: string) => {
    console.log(`🔔 Sending rejection email to ${user.email} for user ${user.first_name} ${user.last_name}. Reason: ${reason || 'No reason provided'}`);
    const correlationId = `rejection-${user.id}-${Date.now()}`;
    
    try {
      const notificationPayload = {
        type: 'rejected',
        userEmail: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        reason: reason
      };
      
      const { data, error } = await supabase.functions.invoke(
        "send-user-notification", 
        { 
          body: notificationPayload
        }
      );
      
      if (error) {
        console.error("❌ Error sending user rejection notification:", error);
        trackEmailDelivery(correlationId, {
          success: false,
          error: error.message || 'Failed to send rejection email'
        });
        throw error;
      }
      
      if (data && !data.success) {
        console.error("❌ Failed to send user rejection email:", data.message);
        trackEmailDelivery(correlationId, {
          success: false,
          error: data.message || 'Failed to send rejection email'
        });
        throw new Error(data.message || 'Failed to send rejection email');
      }
      
      console.log("✅ User rejection email sent successfully");
      trackEmailDelivery(correlationId, {
        success: true,
        messageId: data?.messageId,
        emailProvider: data?.emailProvider
      });
      
      toast({
        title: "Email sent",
        description: `Rejection email sent to ${user.email}`,
      });
      
      return true;
    } catch (error) {
      console.error("💥 Failed to send user rejection email:", error);
      trackEmailDelivery(correlationId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        variant: "destructive",
        title: "Email failed",
        description: "Failed to send rejection email. Please try again.",
      });
      throw error;
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
      const notificationPayload = {
        type: 'approved',
        userEmail: request.user.email,
        firstName: request.user.first_name,
        listingName: request.listing.title
      };
      
      const { data, error } = await supabase.functions.invoke(
        "send-connection-notification", 
        { 
          body: JSON.stringify(notificationPayload) 
        }
      );
      
      if (error) {
        console.error("Error sending connection approval notification:", error);
        return false;
      }
      
      if (data && !data.success) {
        console.error("Failed to send connection approval email:", data.message);
        return false;
      }
      
      return true;
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
      const notificationPayload = {
        type: 'rejected',
        userEmail: request.user.email,
        firstName: request.user.first_name,
        listingName: request.listing.title
      };
      
      const { data, error } = await supabase.functions.invoke(
        "send-connection-notification", 
        { 
          body: JSON.stringify(notificationPayload) 
        }
      );
      
      if (error) {
        console.error("Error sending connection rejection notification:", error);
        return false;
      }
      
      if (data && !data.success) {
        console.error("Failed to send connection rejection email:", data.message);
        return false;
      }
      
      return true;
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
      
      const notificationPayload = {
        type: 'new_request',
        listing: {
          title: request.listing.title || 'Unknown Listing',
          category: request.listing.category || 'Uncategorized',
          location: request.listing.location || 'Unknown Location',
        },
        buyer: {
          name: buyerName,
          email: request.user.email,
          company: request.user.company,
        },
        timestamp: timestamp,
      };
      
      const { data, error } = await supabase.functions.invoke(
        "send-connection-notification", 
        { 
          body: JSON.stringify(notificationPayload) 
        }
      );
      
      if (error) {
        console.error("Error sending admin notification:", error);
        return false;
      }
      
      if (data && !data.success) {
        console.error("Failed to send admin notification:", data.message);
        return false;
      }
      
      return true;
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
