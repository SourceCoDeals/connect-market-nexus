import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  X,
  Minimize2,
  Trash2,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

export type ChatContext = 
  | { type: "deal"; dealId: string; dealName?: string }
  | { type: "deals"; totalDeals?: number }
  | { type: "buyers"; totalBuyers?: number }
  | { type: "universe"; universeId: string; universeName?: string };

interface ReMarketingChatProps {
  context: ChatContext;
  onHighlightItems?: (ids: string[]) => void;
  className?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const getExampleQueries = (context: ChatContext): string[] => {
  switch (context.type) {
    case "deal":
      return [
        "Who are the top 5 buyers for this deal?",
        "Which buyers have presence in this state?",
        "Show me the most active acquirers",
      ];
    case "deals":
      return [
        "Which deals have the highest quality scores?",
        "Show me deals that need enrichment",
        "What industries have the most deals?",
      ];
    case "buyers":
      return [
        "Which buyers are most active acquirers?",
        "Show me PE firms focused on the Southeast",
        "Find buyers with fee agreements",
      ];
    case "universe":
      return [
        "Who are the best matched buyers?",
        "Which deals need more buyer matches?",
        "Show buyers with high alignment scores",
      ];
  }
};

const getChatTitle = (context: ChatContext): string => {
  switch (context.type) {
    case "deal":
      return "AI Buyer Assistant";
    case "deals":
      return "AI Deals Assistant";
    case "buyers":
      return "AI Buyers Assistant";
    case "universe":
      return "AI Universe Assistant";
  }
};

const getSubtitle = (context: ChatContext): string | null => {
  switch (context.type) {
    case "deal":
      return context.dealName || null;
    case "deals":
      return context.totalDeals ? `${context.totalDeals} deals` : null;
    case "buyers":
      return context.totalBuyers ? `${context.totalBuyers} buyers` : null;
    case "universe":
      return context.universeName || null;
  }
};

const getPlaceholder = (context: ChatContext): string => {
  switch (context.type) {
    case "deal":
      return "Ask about buyers for this deal...";
    case "deals":
      return "Ask about your deals...";
    case "buyers":
      return "Ask about your buyers...";
    case "universe":
      return "Ask about this universe...";
  }
};

export function ReMarketingChat({
  context,
  onHighlightItems,
  className,
}: ReMarketingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const exampleQueries = getExampleQueries(context);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Extract item IDs from hidden marker
  const extractItemIds = useCallback((content: string): string[] => {
    const match = content.match(/<!-- HIGHLIGHT: \[(.*?)\] -->/);
    if (match) {
      try {
        return JSON.parse(`[${match[1]}]`);
      } catch {
        return [];
      }
    }
    // Also check old format
    const buyerMatch = content.match(/<!-- BUYER_HIGHLIGHT: \[(.*?)\] -->/);
    if (buyerMatch) {
      try {
        return JSON.parse(`[${buyerMatch[1]}]`);
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  // Clean content of hidden markers
  const cleanContent = useCallback((content: string): string => {
    return content
      .replace(/<!-- HIGHLIGHT:.*?-->/g, "")
      .replace(/<!-- BUYER_HIGHLIGHT:.*?-->/g, "")
      .trim();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("You must be logged in to use chat");
      }

      // Build request body based on context
      const requestBody: Record<string, unknown> = {
        query: userMessage.content,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        contextType: context.type,
      };

      // Add context-specific params
      if (context.type === "deal") {
        requestBody.listingId = context.dealId;
      } else if (context.type === "universe") {
        requestBody.universeId = context.universeId;
      }

      const response = await fetch(
        `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/chat-remarketing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTcxMTMsImV4cCI6MjA2MjE5MzExM30.M653TuQcthJx8vZW4jPkUTdB67D_Dm48ItLcu_XBh2g",
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        }
      );

      if (response.status === 429) {
        throw new Error("Rate limits exceeded. Please wait a moment and try again.");
      }
      if (response.status === 402) {
        throw new Error("AI credits depleted. Please add credits in Settings → Workspace → Usage.");
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setStreamingContent(cleanContent(fullContent));
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) fullContent += content;
          } catch {
            /* ignore */
          }
        }
      }

      // Extract item IDs and notify parent
      const itemIds = extractItemIds(fullContent);
      if (itemIds.length > 0 && onHighlightItems) {
        onHighlightItems(itemIds);
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: cleanContent(fullContent),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return; // User cancelled, don't show error
      }
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    inputRef.current?.focus();
  };

  const clearConversation = () => {
    setMessages([]);
    setStreamingContent("");
  };

  // Floating chat bubble (closed state)
  if (!isOpen) {
    return (
      <div className={cn("fixed bottom-8 right-8 z-50", className)}>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg hover:scale-105 transition-transform"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className={cn("fixed bottom-8 right-8 z-50", className)}>
        <Button
          onClick={() => setIsMinimized(false)}
          className="gap-2 shadow-lg rounded-full px-4"
        >
          <MessageSquare className="h-4 w-4" />
          {getChatTitle(context)}
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {messages.length}
            </Badge>
          )}
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Full chat panel
  return (
    <div className={cn("fixed bottom-8 right-8 z-50 w-[624px] max-w-[calc(100vw-64px)]", className)}>
      <Card className="flex flex-col h-[845px] max-h-[85vh] shadow-2xl border-2 bg-background">
        <CardHeader className="py-3 px-4 border-b flex-shrink-0 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {getChatTitle(context)}
              {getSubtitle(context) && (
                <span className="text-sm text-muted-foreground font-normal truncate max-w-[200px]">
                  · {getSubtitle(context)}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearConversation}
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 && !streamingContent ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles className="h-10 w-10 mx-auto text-primary/50 mb-3" />
                <p className="text-base font-medium">How can I help?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask me anything about your {context.type === "deal" ? "buyers" : context.type}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground px-1">Try asking:</p>
                {exampleQueries.map((example, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-sm h-auto py-2.5 px-3"
                    onClick={() => handleExampleClick(example)}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg px-3 py-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-base prose prose-base dark:prose-invert max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-base">{message.content}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 px-1">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}

              {/* Streaming content */}
              {streamingContent && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[90%] rounded-lg px-3 py-2 bg-muted">
                    <div className="text-base prose prose-base dark:prose-invert max-w-none">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && !streamingContent && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t flex-shrink-0 bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={getPlaceholder(context)}
              className="text-base"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export default ReMarketingChat;
