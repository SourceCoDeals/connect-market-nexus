/**
 * AI-Generated Note Renderer (Feature 3)
 *
 * Renders deal notes that were auto-generated from Fireflies transcript summaries.
 * Shows special formatting for: AI badge, signals, action items with checkboxes,
 * and notable quotes.
 *
 * Detection: Notes with source='ai_transcript_summary' or body starting with
 * '## AI Meeting Summary' are rendered with this component.
 */

import { Badge } from '@/components/ui/badge';
import { Sparkles, CheckCircle, AlertTriangle, Quote, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIGeneratedNoteRendererProps {
  body: string;
  source?: string | null;
  className?: string;
}

function isAIGeneratedNote(body: string, source?: string | null): boolean {
  return source === 'ai_transcript_summary' || body.startsWith('## AI Meeting Summary');
}

function parseSignalType(text: string): 'positive' | 'negative' | 'neutral' {
  if (text.includes('[POSITIVE]')) return 'positive';
  if (text.includes('[NEGATIVE]')) return 'negative';
  return 'neutral';
}

export function AIGeneratedNoteRenderer({ body, source, className }: AIGeneratedNoteRendererProps) {
  if (!isAIGeneratedNote(body, source)) {
    return null;
  }

  const lines = body.split('\n');
  const sections: Array<{
    type: 'header' | 'meta' | 'text' | 'signal' | 'action' | 'quote' | 'participants';
    content: string;
  }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      sections.push({ type: 'header', content: trimmed.replace('## ', '') });
    } else if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
      sections.push({ type: 'meta', content: trimmed.replace(/^\*|\*$/g, '') });
    } else if (trimmed.startsWith('**Participants:**')) {
      sections.push({ type: 'participants', content: trimmed.replace('**Participants:** ', '') });
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      sections.push({ type: 'header', content: trimmed.replace(/^\*\*|\*\*$/g, '') });
    } else if (
      trimmed.startsWith('- [POSITIVE]') ||
      trimmed.startsWith('- [NEGATIVE]') ||
      trimmed.startsWith('- [NEUTRAL]')
    ) {
      sections.push({ type: 'signal', content: trimmed.replace(/^- /, '') });
    } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      sections.push({ type: 'action', content: trimmed.replace(/^- \[[ x]\] /, '') });
    } else if (trimmed.startsWith('> ')) {
      sections.push({ type: 'quote', content: trimmed.replace(/^> /, '') });
    } else {
      sections.push({ type: 'text', content: trimmed });
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* AI badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="text-[10px] font-medium border-violet-500/30 text-violet-600 bg-violet-500/5 gap-1"
        >
          <Sparkles className="h-3 w-3" />
          AI Summary
        </Badge>
      </div>

      {sections.map((section, i) => {
        switch (section.type) {
          case 'header':
            return (
              <p key={i} className="text-sm font-medium text-foreground">
                {section.content}
              </p>
            );
          case 'meta':
            return (
              <p key={i} className="text-[11px] text-muted-foreground italic">
                {section.content}
              </p>
            );
          case 'participants':
            return (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-medium">Participants:</span> {section.content}
              </p>
            );
          case 'text':
            return (
              <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                {section.content}
              </p>
            );
          case 'signal': {
            const signalType = parseSignalType(section.content);
            const cleanText = section.content
              .replace('[POSITIVE] ', '')
              .replace('[NEGATIVE] ', '')
              .replace('[NEUTRAL] ', '');
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 text-xs px-2 py-1.5 rounded-md',
                  signalType === 'positive'
                    ? 'bg-emerald-500/5 text-emerald-700'
                    : signalType === 'negative'
                      ? 'bg-red-500/5 text-red-700'
                      : 'bg-muted/30 text-muted-foreground',
                )}
              >
                {signalType === 'positive' ? (
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                ) : signalType === 'negative' ? (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                ) : null}
                <span>{cleanText}</span>
              </div>
            );
          }
          case 'action':
            return (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground pl-1">
                <ListChecks className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                <span>{section.content}</span>
              </div>
            );
          case 'quote':
            return (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-muted-foreground italic pl-2 border-l-2 border-amber-500/30"
              >
                <Quote className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
                <span>{section.content}</span>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export { isAIGeneratedNote };
