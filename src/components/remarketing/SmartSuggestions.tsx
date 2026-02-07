/**
 * Smart Query Suggestions
 * Shows intelligent follow-up query suggestions
 */

import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export interface Suggestion {
  text: string;
  intent: string;
  reasoning?: string;
}

interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  onSelectSuggestion: (suggestion: string) => void;
  className?: string;
}

export function SmartSuggestions({
  suggestions,
  onSelectSuggestion,
  className,
}: SmartSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Sparkles className="h-3 w-3" />
        <span>You might want to ask:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-2 px-3 text-sm text-left justify-start hover:bg-accent"
            onClick={() => onSelectSuggestion(suggestion.text)}
          >
            {suggestion.text}
          </Button>
        ))}
      </div>
    </div>
  );
}
