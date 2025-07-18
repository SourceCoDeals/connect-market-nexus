import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface FeedbackRealtimeData {
  id: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  user_id: string;
}

export function useRealtimeFeedback() {
  const [isConnected, setIsConnected] = useState(false);
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackRealtimeData[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("feedback-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feedback_messages",
        },
        (payload) => {
          console.log("New feedback message:", payload);
          const newFeedback = payload.new as FeedbackRealtimeData;
          setFeedbackMessages((prev) => [newFeedback, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "feedback_messages",
        },
        (payload) => {
          console.log("Feedback message updated:", payload);
          const updatedFeedback = payload.new as FeedbackRealtimeData;
          setFeedbackMessages((prev) =>
            prev.map((msg) => (msg.id === updatedFeedback.id ? updatedFeedback : msg))
          );
        }
      )
      .subscribe((status) => {
        console.log("Feedback realtime subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      console.log("Unsubscribing from feedback realtime");
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [user]);

  return {
    isConnected,
    feedbackMessages,
  };
}