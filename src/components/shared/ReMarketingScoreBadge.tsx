import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Shared score badge component used across ReMarketing, Pipeline, and admin
 * dashboards. Displays a numeric score (0-100) with colour coding:
 *
 *  - **>= 80** — emerald (high fit)
 *  - **60-79** — amber  (moderate fit)
 *  - **< 60**  — muted  (low fit)
 *
 * @param score     - Numeric score from 0 to 100.
 * @param className - Optional extra Tailwind classes.
 * @param size      - Badge size variant: "sm" | "md" (default "md").
 */

export type ScoreBadgeVariant = 'emerald' | 'amber' | 'muted';

export function getScoreBadgeVariant(score: number): ScoreBadgeVariant {
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'amber';
  return 'muted';
}

const VARIANT_STYLES: Record<ScoreBadgeVariant, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  amber: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
  muted: 'bg-muted text-muted-foreground border-border hover:bg-muted',
};

const SIZE_STYLES: Record<string, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 font-semibold',
  md: 'text-xs px-2 py-0.5 font-bold',
};

interface ReMarketingScoreBadgeProps {
  score: number;
  className?: string;
  size?: 'sm' | 'md';
}

export function ReMarketingScoreBadge({
  score,
  className,
  size = 'md',
}: ReMarketingScoreBadgeProps) {
  const variant = getScoreBadgeVariant(score);

  return (
    <Badge variant="outline" className={cn(VARIANT_STYLES[variant], SIZE_STYLES[size], className)}>
      {Math.round(score)}
    </Badge>
  );
}

export default ReMarketingScoreBadge;
