/**
 * EngagementBadge.tsx
 *
 * Displays an engagement status badge (active / warm / cold).
 *
 * Extracted from ContactHistoryTracker.tsx
 */

interface EngagementBadgeProps {
  status: 'active' | 'warm' | 'cold' | 'none';
}

export function EngagementBadge({ status }: EngagementBadgeProps) {
  if (status === 'none') return null;

  const config = {
    active: {
      classes:
        'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      label: 'Actively Engaged',
    },
    warm: {
      classes:
        'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400',
      dot: 'bg-amber-500',
      label: 'Warm Lead',
    },
    cold: {
      classes: 'bg-muted border-border text-muted-foreground',
      dot: 'bg-muted-foreground',
      label: 'Gone Cold',
    },
  }[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${config.classes}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
    </div>
  );
}
