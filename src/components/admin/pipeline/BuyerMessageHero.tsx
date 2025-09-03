import React from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuyerMessageHeroProps {
  message?: string;
  buyerName?: string;
  className?: string;
}

export function BuyerMessageHero({ message, buyerName, className }: BuyerMessageHeroProps) {
  if (!message) {
    return (
      <div className={cn("bg-muted/50 border border-border/60 rounded-lg p-6", className)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No message provided</p>
            <p className="text-xs text-muted-foreground">Contact initiated without specific interest message</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-8", className)}>
      <div className="flex items-start gap-5">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Send className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground mb-4">Interest Message</h2>
          <blockquote className="text-base text-foreground/90 leading-relaxed font-medium border-l-4 border-primary/20 pl-4">
            "{message}"
          </blockquote>
          {buyerName && (
            <p className="text-sm text-primary mt-4 font-medium">— {buyerName}</p>
          )}
        </div>
      </div>
    </div>
  );
}