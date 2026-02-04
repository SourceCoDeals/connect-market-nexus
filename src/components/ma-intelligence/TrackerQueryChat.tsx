import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Loader2, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface TrackerQueryChatProps {
  trackerId: string;
  trackerName: string;
}

const EXAMPLE_QUERIES = [
  "Show me all buyers targeting $10M+ revenue",
  "Which buyers prefer add-on acquisitions?",
  "Who has the highest thesis confidence?",
  "Find buyers with recent acquisitions",
];

export function TrackerQueryChat({ trackerId, trackerName }: TrackerQueryChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, streamingContent]);

  const handleExampleClick = (query: string) => {
    setInput(query);
  };

  const highlightBuyerNames = (content: string): React.ReactNode => {
    // Regular expression to find potential buyer names (capitalized words or phrases)
    // This is a simple implementation - could be enhanced with actual buyer data
    const buyerPattern = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? (?:Inc|LLC|Corporation|Corp|Partners|Capital|Equity|Holdings)\.?))\b/g;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = buyerPattern.exec(content)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Add highlighted buyer name as a link
      const buyerName = match[0];
      parts.push(
        <span
          key={match.index}
          className="text-primary font-medium hover:underline cursor-pointer"
          onClick={() => {
            toast({
              title: "Buyer Details",
              description: `View details for ${buyerName}`,
            });
          }}
        >
          {buyerName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      // For streaming, we'd need to use fetch directly instead of supabase.functions.invoke
      // This is a simplified version that simulates streaming
      const { data, error } = await supabase.functions.invoke("query-tracker-universe", {
        body: {
          trackerId: trackerId,
          query: userMessage.content,
        },
      });

      if (error) throw error;

      // Simulate streaming effect for better UX
      const response = data.response || data.answer || "I'm not sure how to answer that.";
      let currentText = "";
      const words = response.split(" ");

      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? " " : "") + words[i];
        setStreamingContent(currentText);
        await new Promise(resolve => setTimeout(resolve, 30)); // Simulate streaming delay
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (error: any) {
      toast({
        title: "Error querying AI",
        description: error.message,
        variant: "destructive",
      });
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConversation = () => {
    setMessages([]);
    setStreamingContent("");
    toast({
      title: "Conversation cleared",
      description: "Chat history has been reset",
    });
  };

  return (
    <Card className="h-[700px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Query Assistant
            </CardTitle>
            <CardDescription>
              Ask questions about your buyer universe for {trackerName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="w-3 h-3" />
              AI-Powered
            </Badge>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearConversation}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Start a conversation with your AI research assistant</p>

              {/* Example Queries */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {EXAMPLE_QUERIES.map((query, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent transition-colors px-3 py-1"
                      onClick={() => handleExampleClick(query)}
                    >
                      {query}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.role === "assistant"
                        ? highlightBuyerNames(message.content)
                        : message.content
                      }
                    </div>
                    <p className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Streaming Message */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {highlightBuyerNames(streamingContent)}
                      <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {isLoading && !streamingContent && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your buyers..."
              disabled={isLoading}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </p>
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
