
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types";

export function useEmailNotifications() {
  /**
   * Trigger user journey notification
   */
  const triggerUserJourneyEvent = async (
    eventType: 'user_created' | 'email_verified' | 'profile_approved' | 'profile_rejected',
    user: User,
    metadata?: Record<string, any>
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('user-journey-notifications', {
        body: {
          event_type: eventType,
          user_id: user.id,
          user_email: user.email,
          user_name: `${user.first_name} ${user.last_name}`,
          metadata
        }
      });

      if (error) {
        console.error('Failed to trigger user journey event:', error);
        return false;
      }

      return data?.success || false;
    } catch (error) {
      console.error('Error triggering user journey event:', error);
      return false;
    }
  };

  /**
   * Send welcome email after user creation
   */
  const sendWelcomeEmail = async (user: User) => {
    return await triggerUserJourneyEvent('user_created', user);
  };

  /**
   * Send approval notification
   */
  const sendApprovalNotification = async (user: User) => {
    return await triggerUserJourneyEvent('profile_approved', user);
  };

  /**
   * Send rejection notification
   */
  const sendRejectionNotification = async (user: User, reason?: string) => {
    return await triggerUserJourneyEvent('profile_rejected', user, { rejection_reason: reason });
  };

  /**
   * Send email verification confirmation
   */
  const sendEmailVerificationConfirmation = async (user: User) => {
    return await triggerUserJourneyEvent('email_verified', user);
  };


  /**
   * Request daily admin digest
   */
  const requestAdminDigest = async (type: 'daily' | 'weekly' | 'urgent' = 'daily') => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-digest', {
        body: { type }
      });

      if (error) {
        console.error('Failed to request admin digest:', error);
        return false;
      }

      return data?.success || false;
    } catch (error) {
      console.error('Error requesting admin digest:', error);
      return false;
    }
  };

  return {
    triggerUserJourneyEvent,
    sendWelcomeEmail,
    sendApprovalNotification,
    sendRejectionNotification,
    sendEmailVerificationConfirmation,
    requestAdminDigest
  };
}
