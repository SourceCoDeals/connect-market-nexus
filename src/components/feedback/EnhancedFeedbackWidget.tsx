
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, X, Send, Paperclip, Star, ChevronDown, ChevronUp, Mail, Bug, Lightbulb, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { ConversationThread } from './ConversationThread';
import { useEnhancedFeedback } from '@/hooks/use-enhanced-feedback';

interface FeedbackWidgetProps {
  className?: string;
}

export function EnhancedFeedbackWidget({ className }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [priority, setPriority] = useState<string>('normal');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { submitFeedback, getFeedbackHistory, isLoading } = useEnhancedFeedback();

  // Load conversation history on mount
  useEffect(() => {
    if (user && isOpen) {
      loadConversationHistory();
    }
  }, [user, isOpen]);

  const loadConversationHistory = async () => {
    try {
      const history = await getFeedbackHistory();
      setConversationHistory(history);
    } catch (error) {
      console.error('Error loading conversation history:', error);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await submitFeedback({
        message: message.trim(),
        category: category as any,
        priority: priority as any,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent
      });

      if (result?.id) {
        setCurrentThreadId(result.id);
      }

      setMessage('');
      setAttachments([]);
      
      // Refresh conversation history
      await loadConversationHistory();
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      // Error handling is done in the hook
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startNewConversation = () => {
    setCurrentThreadId(null);
    setMessage('');
    setAttachments([]);
    setCategory('general');
    setPriority('normal');
  };

  const openConversation = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const categories = [
    { value: 'general', label: 'Contact Us', icon: Mail },
    { value: 'bug', label: 'Bug Report', icon: Bug },
    { value: 'feature', label: 'Feature Request', icon: Lightbulb },
    { value: 'ui', label: 'UI/UX Feedback', icon: User },
    { value: 'other', label: 'Other', icon: MessageSquare }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
    { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
  ];

  if (!user) return null;

  // Floating widget when closed
  if (!isOpen) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          size="icon"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Card className="w-80 shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Feedback & Support</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(false)}
                  className="h-6 w-6 p-0"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Card className="w-96 h-[600px] shadow-xl flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Get in Touch
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
                className="h-6 w-6 p-0"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{user?.email || "Guest"}</span>
          </div>
          
          {/* Navigation */}
          <div className="flex gap-2 mt-2">
            <Button
              variant={!currentThreadId ? "default" : "outline"}
              size="sm"
              onClick={startNewConversation}
            >
              New Message
            </Button>
            <Button
              variant={showHistory ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              History ({conversationHistory.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-4 overflow-hidden">
          {showHistory ? (
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {conversationHistory.map((conversation, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => {
                      openConversation(conversation.id);
                      setShowHistory(false);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium line-clamp-2 mb-1">
                            {conversation.message}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {conversation.category}
                            </Badge>
                            <Badge 
                              variant={conversation.priority === 'urgent' ? 'destructive' : 'outline'}
                              className="text-xs capitalize"
                            >
                              {conversation.priority}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(conversation.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : currentThreadId ? (
            <ConversationThread
              threadId={currentThreadId}
              initialMessages={[]}
              onNewMessage={(message) => {
                console.log('New message:', message);
              }}
              isAdmin={false}
            />
          ) : (
            <div className="h-full flex flex-col space-y-4">
              {/* Quick Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {categories.slice(0, 3).map((cat) => (
                  <Button
                    key={cat.value}
                    type="button"
                    variant={category === cat.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategory(cat.value)}
                    className="flex flex-col items-center gap-1 h-auto py-2"
                  >
                    <cat.icon className="h-3 w-3" />
                    <span className="text-xs">{cat.label}</span>
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((prio) => (
                        <SelectItem key={prio.value} value={prio.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${prio.color.split(' ')[0]} ${prio.color.split(' ')[1]}`}></div>
                            {prio.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">
                  Your Message *
                  {category === "general" && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (We'll respond via email)
                    </span>
                  )}
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    category === "general" 
                      ? "How can we help you today? We'll get back to you soon..." 
                      : category === "bug"
                      ? "Describe the issue you encountered. Include steps to reproduce if possible..."
                      : category === "feature"
                      ? "What feature would you like to see? How would it help you..."
                      : "Tell us what's on your mind..."
                  }
                  className="h-32 resize-none"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {category === "general" 
                    ? "Our team will respond to your message within 24 hours."
                    : "Be specific and detailed to help us understand better."
                  }
                </p>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Attachments</label>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {file.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                          className="ml-1 h-4 w-4 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="feedback-file-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('feedback-file-upload')?.click()}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={isLoading || !message.trim()}
                  className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                  size="sm"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {category === "general" ? "Send Message" : "Send Feedback"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
