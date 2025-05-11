
import { supabase } from "@/integrations/supabase/client";
import { AdminConnectionRequest } from "@/types/admin";
import { format } from "date-fns";

export function useAdminNotifications() {
  /**
   * Notify admins about a new connection request
   */
  const notifyAdminsOfNewRequest = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      console.error("Cannot send notification: missing user or listing data");
      return;
    }

    try {
      // Format buyer name
      const buyerName = `${request.user.first_name} ${request.user.last_name}`;
      
      // Format timestamp
      const timestamp = format(new Date(request.created_at), "MMM d, yyyy – HH:mm 'UTC'");
      
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
      
      const { error } = await supabase.functions.invoke(
        "send-connection-notification", 
        { 
          body: JSON.stringify(notificationPayload) 
        }
      );
      
      if (error) {
        console.error("Error sending admin notification:", error);
        throw error;
      }
      
      console.log("Admin notification sent successfully");
      return true;
    } catch (error) {
      console.error("Failed to send admin notification:", error);
      return false;
    }
  };

  return {
    notifyAdminsOfNewRequest
  };
}
