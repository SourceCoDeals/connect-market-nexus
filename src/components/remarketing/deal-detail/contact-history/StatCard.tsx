/**
 * StatCard.tsx
 *
 * A small metric card showing a label, value, and colored icon.
 *
 * Extracted from ContactHistoryTracker.tsx
 */
import type { Mail } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: typeof Mail;
  color: 'blue' | 'green' | 'violet';
}

export function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const iconColor = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    violet: 'text-violet-500',
  }[color];

  return (
    <div className="rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
