import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, Paperclip, ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface ConversationMessage {
  id: string;
  message: string;
  user_id: string | null;
  admin_id: string | null;
  created_at: string;
  is_internal_note: boolean;
  attachments: any[];
  satisfaction_rating: number | null;
  user_first_name?: string;
  user_last_name?: string;
  admin_first_name?: string;
  admin_last_name?: string;
}

interface ConversationThreadProps {
  threadId: string;
  initialMessages: ConversationMessage[];
  onNewMessage: (message: ConversationMessage) => void;
  isAdmin?: boolean;
}

export function ConversationThread({ 
  threadId, 
  initialMessages, 
  onNewMessage, 
  isAdmin = false 
}: ConversationThreadProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showSatisfactionRating, setShowSatisfactionRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('conversation-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          const newMsg = payload.new as ConversationMessage;
          setMessages(prev => [...prev, newMsg]);
          onNewMessage(newMsg);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, onNewMessage]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;

    setIsLoading(true);
    try {
      // Upload attachments if any
      const uploadedAttachments = [];
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${threadId}/${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('feedback-attachments')
          .upload(fileName, file);

        if (error) throw error;
        uploadedAttachments.push({
          name: file.name,
          path: data.path,
          size: file.size,
          type: file.type
        });
      }

      // Auto-categorize and assign priority (simplified for now)
      let category = 'general';
      let priority = 'normal';
      
      if (newMessage.toLowerCase().includes('bug') || newMessage.toLowerCase().includes('error')) {
        category = 'bug';
        priority = 'high';
      } else if (newMessage.toLowerCase().includes('urgent')) {
        priority = 'urgent';
      }

      // Insert message
      const { data, error } = await supabase
        .from('feedback_messages')
        .insert({
          message: newMessage,
          user_id: isAdmin ? null : user?.id,
          admin_id: isAdmin ? user?.id : null,
          category,
          priority,
          status: 'unread'
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Track user engagement
      await supabase
        .from('user_activity')
        .insert({
          user_id: user?.id,
          activity_type: isAdmin ? 'admin_reply' : 'user_reply',
          metadata: {
            thread_id: threadId,
            message_id: data.id,
            has_attachments: attachments.length > 0
          }
        });

      setNewMessage('');
      setAttachments([]);
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSatisfactionRating = async (rating: number) => {
    try {
      const { error } = await supabase
        .from('feedback_messages')
        .update({ satisfaction_rating: rating } as any)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      setSelectedRating(rating);
      setShowSatisfactionRating(false);
      toast({
        title: "Thank you for your feedback!",
        description: `You rated this conversation ${rating} star${rating > 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderMessage = (message: ConversationMessage) => {
    const isFromAdmin = message.admin_id !== null;
    const isFromUser = message.user_id !== null;

    return (
      <div
        key={message.id}
        className={`flex ${isFromAdmin ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`flex max-w-[80%] ${isFromAdmin ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
          <Avatar className="w-8 h-8">
            <AvatarFallback className={isFromAdmin ? 'bg-primary text-primary-foreground' : 'bg-secondary'}>
              {isFromAdmin 
                ? `${message.admin_first_name?.[0] || 'A'}${message.admin_last_name?.[0] || ''}`
                : `${message.user_first_name?.[0] || 'U'}${message.user_last_name?.[0] || ''}`
              }
            </AvatarFallback>
          </Avatar>
          
          <div className={`rounded-lg p-3 ${
            isFromAdmin 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary text-secondary-foreground'
          }`}>
            <p className="text-sm">{message.message}</p>
            
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map((attachment: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-xs opacity-80">
                    <Paperclip className="w-3 h-3" />
                    <span>{attachment.name}</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs opacity-60">
                {new Date(message.created_at).toLocaleString()}
              </span>
              
              {message.satisfaction_rating && (
                <div className="flex items-center gap-1">
                  {[...Array(message.satisfaction_rating)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Conversation</h3>
          {!isAdmin && !selectedRating && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSatisfactionRating(true)}
            >
              Rate Conversation
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4">
            {messages.map(renderMessage)}
          </div>
        </ScrollArea>
        
        {showSatisfactionRating && (
          <div className="p-4 border-t">
            <p className="text-sm font-medium mb-2">How satisfied are you with this conversation?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSatisfactionRating(rating)}
                  className="p-1"
                >
                  <Star className="w-4 h-4" />
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <Separator />
        
        <div className="p-4 space-y-3">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {file.name}
                </Badge>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 min-h-[80px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <input
                type="file"
                multiple
                onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                className="hidden"
                id="file-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || (!newMessage.trim() && attachments.length === 0)}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}