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
      <div className={cn("bg-slate-50/50 border border-slate-200/60 rounded-xl p-6", className)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">No message provided</p>
            <p className="text-xs text-slate-500">Contact initiated without specific interest message</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200/40 rounded-xl p-6", className)}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-100/80 flex items-center justify-center flex-shrink-0">
          <Send className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-blue-900">Interest Message</h3>
            <span className="px-2.5 py-1 bg-blue-100/80 text-blue-700 text-xs font-medium rounded-full">
              Why they're interested
            </span>
          </div>
          <blockquote className="text-sm text-blue-800/90 leading-relaxed font-medium">
            "{message}"
          </blockquote>
          {buyerName && (
            <p className="text-xs text-blue-600 mt-3 font-medium">— {buyerName}</p>
          )}
        </div>
      </div>
    </div>
  );
}