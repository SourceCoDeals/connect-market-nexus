import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  Loader2,
  Building2,
  MapPin,
  Briefcase,
  ExternalLink,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { IntelligenceBadge } from "./IntelligenceBadge";
import type { DataCompleteness, BuyerType } from "@/types/remarketing";

interface BuyerQueryChatProps {
  universeId?: string;
  className?: string;
  defaultOpen?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  buyers?: MatchedBuyer[];
  reasoning?: string;
  suggestions?: string;
  timestamp: Date;
}

interface MatchedBuyer {
  id: string;
  company_name: string;
  company_website: string | null;
  buyer_type: BuyerType | null;
  thesis_summary: string | null;
  target_geographies: string[];
  target_services: string[];
  data_completeness: DataCompleteness | null;
}

const EXAMPLE_QUERIES = [
  "Find PE firms targeting HVAC companies",
  "Buyers interested in Texas or Florida",
  "Show me strategic acquirers with multi-location footprints",
  "Platforms looking for $5-15M revenue deals",
];

export const BuyerQueryChat = ({ universeId, className, defaultOpen = false }: BuyerQueryChatProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const { data, error } = await supabase.functions.invoke('query-buyer-universe', {
        body: { query: searchQuery, universeId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, searchQuery) => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.buyers?.length > 0 
          ? `Found ${data.buyers.length} matching buyer${data.buyers.length === 1 ? '' : 's'}:`
          : 'No buyers found matching your criteria.',
        buyers: data.buyers,
        reasoning: data.reasoning,
        suggestions: data.suggestions,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: any) => {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || searchMutation.isPending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    searchMutation.mutate(query);
    setQuery("");
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    inputRef.current?.focus();
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn("gap-2", className)}
        variant="outline"
      >
        <Sparkles className="h-4 w-4" />
        AI Search
      </Button>
    );
  }

  if (isMinimized) {
    return (
      <div className={cn("fixed bottom-4 right-4 z-50", className)}>
        <Button
          onClick={() => setIsMinimized(false)}
          className="gap-2 shadow-lg"
        >
          <MessageSquare className="h-4 w-4" />
          Buyer AI Chat
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {messages.length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn("flex flex-col h-[500px] max-h-[80vh]", className)}>
      <CardHeader className="py-3 px-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Buyer Search
          </CardTitle>
          <div className="flex items-center gap-1">
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
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask questions in natural language to find buyers. For example:
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1.5 px-2"
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
                  message.role === 'user' ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-lg px-3 py-2",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                </div>

                {/* Show reasoning */}
                {message.reasoning && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-[90%]">
                    {message.reasoning}
                  </p>
                )}

                {/* Show matched buyers */}
                {message.buyers && message.buyers.length > 0 && (
                  <div className="mt-2 space-y-2 w-full max-w-[90%]">
                    {message.buyers.map((buyer) => (
                      <Link
                        key={buyer.id}
                        to={`/admin/buyers/${buyer.id}`}
                        className="block"
                      >
                        <div className="bg-background border rounded-lg p-3 hover:border-primary/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-sm">
                                {buyer.company_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {buyer.buyer_type?.replace('_', ' ') || 'Unknown'}
                              </Badge>
                              <IntelligenceBadge 
                                completeness={buyer.data_completeness} 
                                size="sm" 
                              />
                            </div>
                          </div>

                          {buyer.thesis_summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {buyer.thesis_summary}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mt-2">
                            {buyer.target_geographies?.slice(0, 3).map((geo, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <MapPin className="h-2.5 w-2.5 mr-1" />
                                {geo}
                              </Badge>
                            ))}
                            {buyer.target_services?.slice(0, 2).map((svc, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <Briefcase className="h-2.5 w-2.5 mr-1" />
                                {svc}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Show suggestions */}
                {message.suggestions && (
                  <p className="text-xs text-primary mt-2 max-w-[90%]">
                    💡 {message.suggestions}
                  </p>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {searchMutation.isPending && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Searching buyers...</span>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about buyers..."
            className="text-sm"
            disabled={searchMutation.isPending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!query.trim() || searchMutation.isPending}
          >
            {searchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default BuyerQueryChat;
