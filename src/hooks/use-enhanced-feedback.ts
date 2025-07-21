import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface EnhancedFeedbackData {
  message: string;
  category?: "general" | "bug" | "feature" | "ui" | "other";
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

// Valid database categories mapping
const CATEGORY_MAPPING = {
  'contact': 'general',
  'general': 'general',
  'bug': 'bug',
  'feature': 'feature',
  'ui': 'ui',
  'other': 'other'
};

export function useEnhancedFeedback() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const submitFeedback = async (feedbackData: EnhancedFeedbackData) => {
    console.log('🚀 Starting feedback submission:', { 
      category: feedbackData.category, 
      messageLength: feedbackData.message?.length,
      userExists: !!user 
    });

    if (!user) {
      console.error('❌ No authenticated user found');
      toast({
        title: "Authentication required",
        description: "You must be logged in to submit feedback.",
        variant: "destructive",
      });
      throw new Error("User must be authenticated to submit feedback");
    }

    if (!feedbackData.message?.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message before submitting.",
        variant: "destructive",
      });
      throw new Error("Message is required");
    }

    setIsLoading(true);
    
    try {
      console.log('📝 Processing feedback submission...');
      
      // Map category to valid database value
      const originalCategory = feedbackData.category || 'general';
      const dbCategory = CATEGORY_MAPPING[originalCategory as keyof typeof CATEGORY_MAPPING] || 'general';
      
      console.log('🔄 Category mapping:', { original: originalCategory, database: dbCategory });
      
      // Insert feedback into database with comprehensive validation
      const feedbackPayload = {
        user_id: user.id,
        message: feedbackData.message.trim(),
        category: dbCategory,
        priority: feedbackData.priority || "normal",
        page_url: feedbackData.pageUrl || window?.location?.href,
        user_agent: feedbackData.userAgent || navigator?.userAgent,
        status: "unread",
        thread_id: feedbackData.threadId || undefined,
        parent_message_id: feedbackData.parentMessageId || undefined,
      };

      console.log('📊 Feedback payload:', { ...feedbackPayload, message: '[HIDDEN]' });

      const { data: feedback, error: insertError } = await supabase
        .from("feedback_messages")
        .insert(feedbackPayload)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Database insertion failed:', insertError);
        
        // Provide user-friendly error messages
        if (insertError.code === '23514') {
          toast({
            title: "Invalid category",
            description: "Please select a valid feedback category.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Submission failed",
            description: `Failed to save your message: ${insertError.message}. Please try again.`,
            variant: "destructive",
          });
        }
        throw new Error(`Database error: ${insertError.message}`);
      }

      if (!feedback) {
        console.error('❌ No feedback data returned after insertion');
        toast({
          title: "Submission failed",
          description: "Failed to save feedback. Please try again.",
          variant: "destructive",
        });
        throw new Error("Failed to save feedback - no data returned");
      }

      console.log('✅ Feedback saved successfully:', feedback.id);

      // Get user profile for personalized email
      console.log('👤 Fetching user profile for email...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.warn('⚠️ Could not fetch user profile:', profileError);
      }

      const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';
      const userEmail = profile?.email || user.email;
      
      console.log('📧 Preparing to send confirmation email to:', userEmail);

      // Send confirmation email with enhanced error handling
      try {
        const emailPayload = {
          to: userEmail,
          subject: originalCategory === 'contact' 
            ? `Thank you for contacting us${userName ? `, ${userName}` : ''}` 
            : `Thank you for your ${originalCategory || 'feedback'}${userName ? `, ${userName}` : ''}`,
          content: feedbackData.message,
          feedbackId: feedback.id,
          userName: userName || undefined,
          category: originalCategory || 'general'
        };

        console.log('📬 Email payload:', { ...emailPayload, content: '[CONTENT_HIDDEN]' });

        const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-contact-response', {
          body: emailPayload
        });

        if (emailError) {
          console.error('❌ Email sending failed:', emailError);
          
          // Show success since feedback was saved, but mention email issue
          toast({
            title: originalCategory === "contact" ? "Message sent!" : "Feedback submitted!",
            description: "Your message was saved successfully. We'll respond to you soon.",
          });
        } else {
          console.log('✅ Confirmation email sent successfully:', emailResult);
          
          toast({
            title: originalCategory === "contact" ? "Message sent successfully!" : "Feedback submitted successfully!",
            description: originalCategory === "contact" 
              ? "Thank you for contacting us! We'll get back to you within 24 hours."
              : "Thank you for your feedback! We'll review it shortly.",
          });
        }
      } catch (emailError) {
        console.warn('⚠️ Email delivery attempt failed:', emailError);
        
        // Still show success since feedback was saved
        toast({
          title: originalCategory === "contact" ? "Message sent!" : "Feedback submitted!",
          description: "Your message was saved successfully. We'll respond to you soon.",
        });
      }

      // Try to send admin notification (optional)
      try {
        console.log('🔔 Sending admin notification...');
        
        const { error: notificationError } = await supabase.functions.invoke(
          "send-feedback-notification",
          {
            body: {
              feedbackId: feedback.id,
              message: feedbackData.message,
              category: dbCategory,
              priority: feedbackData.priority,
              pageUrl: feedbackData.pageUrl,
              userAgent: feedbackData.userAgent,
              userId: user.id,
              userEmail: user.email,
              userName: userName || user.email,
            },
          }
        );

        if (notificationError) {
          console.warn("⚠️ Admin notification failed (non-critical):", notificationError);
        } else {
          console.log('✅ Admin notification sent');
        }
      } catch (notificationError) {
        console.warn("⚠️ Admin notification attempt failed (non-critical):", notificationError);
      }

      console.log('🎉 Feedback submission completed successfully');
      return feedback;

    } catch (error: any) {
      console.error("💥 Critical error in feedback submission:", error);
      
      // Only show toast if we haven't already shown one
      if (!error.message.includes("Database error") && !error.message.includes("Message is required")) {
        toast({
          title: "Submission error",
          description: `Failed to submit your message: ${error.message || 'Unknown error'}. Please try again.`,
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getFeedbackWithUserDetails = async (): Promise<FeedbackMessageWithUser[]> => {
    try {
      console.log('📊 Fetching feedback with user details...');
      
      // Get feedback messages first
      const { data: messages, error: messagesError } = await supabase
        .from("feedback_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error('❌ Error fetching feedback messages:', messagesError);
        throw messagesError;
      }

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, company, phone_number");

      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
        throw profilesError;
      }

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

      console.log('✅ Successfully fetched feedback with user details:', result.length);
      return result as FeedbackMessageWithUser[];
    } catch (error) {
      console.error("❌ Error fetching feedback with user details:", error);
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
