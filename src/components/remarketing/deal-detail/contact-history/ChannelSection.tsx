/**
 * ChannelSection.tsx
 *
 * Collapsible section wrapper for a communication channel
 * (email / call / LinkedIn).
 *
 * Extracted from ContactHistoryTracker.tsx
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { Mail } from 'lucide-react';

interface ChannelSectionProps {
  icon: typeof Mail;
  title: string;
  count: number;
  color: 'blue' | 'green' | 'violet';
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ChannelSection({
  icon: Icon,
  title,
  count,
  color,
  expanded,
  onToggle,
  children,
}: ChannelSectionProps) {
  const colorStyles = {
    blue: {
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
    },
    green: {
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-500 bg-green-50 dark:bg-green-950/30',
    },
    violet: {
      border: 'border-violet-200 dark:border-violet-800',
      icon: 'text-violet-500 bg-violet-50 dark:bg-violet-950/30',
    },
  }[color];

  return (
    <div className={`rounded-lg border ${colorStyles.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${colorStyles.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {count} {count === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && <div className="border-t px-4 pb-4 pt-2 space-y-2">{children}</div>}
    </div>
  );
}
