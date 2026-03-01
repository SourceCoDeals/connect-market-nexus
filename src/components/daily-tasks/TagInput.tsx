/**
 * TagInput — Inline tag editor for tasks.
 *
 * Splits on Enter or comma, renders as pill badges.
 * Shows existing tags from the task system as autocomplete suggestions.
 */

import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add tags...',
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setInputValue('');
    },
    [value, onChange],
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      onChange(value.filter((t) => t !== tagToRemove));
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Split on comma immediately
    if (val.includes(',')) {
      const parts = val.split(',');
      for (const part of parts) {
        if (part.trim()) addTag(part);
      }
      return;
    }
    setInputValue(val);
  };

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(s.toLowerCase()),
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[36px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs h-5 px-2 py-0">
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200);
            if (inputValue.trim()) addTag(inputValue);
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && inputValue && filteredSuggestions.length > 0 && (
        <div className="rounded-md border bg-popover p-1 shadow-md max-h-32 overflow-auto">
          {filteredSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
