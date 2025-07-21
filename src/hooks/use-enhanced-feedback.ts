import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface EnhancedFeedbackData {
  message: string;
  category?: "contact" | "general" | "bug" | "feature" | "ui" | "other";
  priority?: "low" | "normal" | "high" | "urgent";
  pageUrl?: string;
  userAgent?: string;
  threadId?: string;
  parentMessageId?: string;
}

export interface FeedbackMessageWithUser {
  id: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  page_url: string | null;
  user_agent: string | null;
  admin_response: string | null;
  thread_id: string;
  parent_message_id: string | null;
  is_internal_note: boolean;
  attachments: any[];
  read_by_user: boolean;
  read_by_admin: boolean;
  satisfaction_rating: number | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  admin_id: string | null;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  user_company: string;
  user_phone_number: string;
}

export function useEnhancedFeedback() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const submitFeedback = async (feedbackData: EnhancedFeedbackData) => {
    if (!user) {
      throw new Error("User must be authenticated to submit feedback");
    }

    setIsLoading(true);
    
    try {
      // Insert feedback into database
      const { data: feedback, error: insertError } = await supabase
        .from("feedback_messages")
        .insert({
          user_id: user.id,
          message: feedbackData.message,
          category: feedbackData.category || "general",
          priority: feedbackData.priority || "normal",
          page_url: feedbackData.pageUrl,
          user_agent: feedbackData.userAgent,
          status: "unread",
          thread_id: feedbackData.threadId,
          parent_message_id: feedbackData.parentMessageId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('Feedback saved successfully:', feedback);

      // Send automatic response email to user for all feedback types
      try {
        console.log('Sending confirmation response email...');
        
        // Get user profile for name
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.warn('Could not fetch user profile for email:', profileError);
        }

        const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';
        
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-contact-response', {
          body: {
            to: user.email,
            subject: feedbackData.category === 'contact' 
              ? `Thank you for contacting us${userName ? `, ${userName}` : ''}` 
              : `Thank you for your feedback${userName ? `, ${userName}` : ''}`,
            content: feedbackData.message,
            feedbackId: feedback.id,
            userName: userName || undefined,
            category: feedbackData.category
          }
        });

        if (emailError) {
          console.error('Email sending failed:', emailError);
          // Don't throw - feedback was saved successfully
        } else {
          console.log('Confirmation response email sent successfully:', emailResult);
        }
      } catch (emailError) {
        console.warn('Failed to send confirmation response email:', emailError);
        // Don't fail the whole operation
      }

      // Try to send admin notification, but don't fail if it errors
      try {
        const { error: notificationError } = await supabase.functions.invoke(
          "send-feedback-notification",
          {
            body: {
              feedbackId: feedback.id,
              message: feedbackData.message,
              category: feedbackData.category,
              priority: feedbackData.priority,
              pageUrl: feedbackData.pageUrl,
              userAgent: feedbackData.userAgent,
              userId: user.id,
              userEmail: user.email,
              userName: user.email,
            },
          }
        );

        if (notificationError) {
          console.warn("Admin notification failed but feedback was saved:", notificationError);
        }
      } catch (notificationError) {
        console.warn("Failed to send admin notification:", notificationError);
        // Continue - feedback was saved successfully
      }

      toast({
        title: feedbackData.category === "contact" ? "Message sent successfully!" : "Feedback submitted successfully",
        description: feedbackData.category === "contact" 
          ? "Thank you for contacting us! We'll get back to you within 24 hours."
          : "Thank you for your feedback! We'll review it shortly.",
      });

      return feedback;
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error sending message",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getFeedbackWithUserDetails = async (): Promise<FeedbackMessageWithUser[]> => {
    try {
      // Get feedback messages first
      const { data: messages, error: messagesError } = await supabase
        .from("feedback_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, company, phone_number");

      if (profilesError) throw profilesError;

      // Combine data
      const result = (messages || []).map(msg => {
        const profile = profiles?.find(p => p.id === msg.user_id);
        return {
          ...msg,
          user_email: profile?.email || '',
          user_first_name: profile?.first_name || '',
          user_last_name: profile?.last_name || '',
          user_company: profile?.company || '',
          user_phone_number: profile?.phone_number || '',
          attachments: (msg as any).attachments || [],
          read_by_user: (msg as any).read_by_user || false,
          read_by_admin: (msg as any).read_by_admin || false,
          is_internal_note: (msg as any).is_internal_note || false,
          thread_id: (msg as any).thread_id || msg.id,
          parent_message_id: (msg as any).parent_message_id || null,
          satisfaction_rating: (msg as any).satisfaction_rating || null,
        };
      });

      return result as FeedbackMessageWithUser[];
    } catch (error) {
      console.error("Error fetching feedback with user details:", error);
      return [];
    }
  };

  const getFeedbackHistory = async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from("feedback_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching feedback history:", error);
      return [];
    }
  };

  const markAsRead = async (messageId: string, isUser: boolean = false) => {
    try {
      const updateField = isUser ? "read_by_user" : "read_by_admin";
      const { error } = await supabase
        .from("feedback_messages")
        .update({ [updateField]: true })
        .eq("id", messageId);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  return {
    submitFeedback,
    getFeedbackWithUserDetails,
    getFeedbackHistory,
    markAsRead,
    isLoading,
  };
}
