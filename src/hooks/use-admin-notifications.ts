
import { supabase } from "@/integrations/supabase/client";
import { AdminConnectionRequest } from "@/types/admin";
import { format } from "date-fns";

export function useAdminNotifications() {
  /**
   * Notify admins about a new connection request
   */
  const notifyAdminsOfNewRequest = async (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      // Debug log removed
      return false;
    }

    try {
      // Format buyer name
      const buyerName = `${request.user.first_name} ${request.user.last_name}`.trim();
      
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
      
      const { data, error } = await supabase.functions.invoke(
        "send-connection-notification", 
        { 
          body: JSON.stringify(notificationPayload) 
        }
      );
      
      if (error) {
        // Debug log removed
        return false;
      }
      
      if (data && !data.success) {
        // Debug log removed
        return false;
      }
      
      // Debug log removed
      return true;
    } catch (error) {
      // Debug log removed
      return false;
    }
  };

  return {
    notifyAdminsOfNewRequest
  };
}
