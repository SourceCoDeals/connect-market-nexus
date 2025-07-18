import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface FeedbackData {
  message: string;
  category?: "general" | "bug" | "feature" | "ui" | "other";
  priority?: "low" | "normal" | "high" | "urgent";
  pageUrl?: string;
  userAgent?: string;
}

export function useFeedback() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const submitFeedback = async (feedbackData: FeedbackData) => {
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
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send notification to admins
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
        console.error("Error sending notification:", notificationError);
        // Don't throw here - feedback was saved successfully
      }

      toast({
        title: "Feedback submitted successfully",
        description: "Thank you for your feedback! We'll review it shortly.",
      });

      return feedback;
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error submitting feedback",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
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

  return {
    submitFeedback,
    getFeedbackHistory,
    isLoading,
  };
}