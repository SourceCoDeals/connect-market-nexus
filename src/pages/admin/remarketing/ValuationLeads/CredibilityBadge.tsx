/**
 * CredibilityBadge — surfaces the website credibility tier produced by
 * `enrich-valuation-lead-website` so reps can skip clearly-low-signal leads
 * without opening the drawer.
 *
 * Tiers:
 *  - established  → no badge (default, clean signal)
 *  - emerging     → small amber dot + tooltip
 *  - low_signal   → amber pill ("Low signal") with reasons in tooltip
 *  - shell        → red pill ("Shell site") with reasons in tooltip
 */

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type CredibilityTier = 'established' | 'emerging' | 'low_signal' | 'shell';

export interface CredibilitySignal {
  tier: CredibilityTier | null;
  reasons: string[];
  score: number | null;
}

/** Read credibility fields from the enrichment JSON. */
export function readCredibility(
  enrichment: Record<string, unknown> | null | undefined,
): CredibilitySignal {
  if (!enrichment) return { tier: null, reasons: [], score: null };
  const tier = enrichment.credibility_tier as CredibilityTier | undefined;
  const reasons = Array.isArray(enrichment.credibility_reasons)
    ? (enrichment.credibility_reasons as string[])
    : [];
  const score =
    typeof enrichment.credibility_score === 'number'
      ? (enrichment.credibility_score as number)
      : null;
  return { tier: tier ?? null, reasons, score };
}

interface Props {
  signal: CredibilitySignal;
  /** When true, render only a tiny dot + tooltip (used in dense table rows). */
  compact?: boolean;
}

export function CredibilityBadge({ signal, compact = false }: Props) {
  if (!signal.tier || signal.tier === 'established') return null;

  const config = {
    emerging: {
      label: 'Emerging',
      icon: null,
      className: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
      dotClassName: 'bg-amber-500',
      defaultTooltip: 'Real domain, but limited public business signal',
    },
    low_signal: {
      label: 'Low signal',
      icon: AlertTriangle,
      className: 'bg-amber-500/15 text-amber-800 border-amber-500/40 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
      defaultTooltip: 'Website looks placeholder or template-built',
    },
    shell: {
      label: 'Shell site',
      icon: ShieldAlert,
      className: 'bg-destructive/10 text-destructive border-destructive/30',
      dotClassName: 'bg-destructive',
      defaultTooltip: 'Site failed to load or has no real content',
    },
  }[signal.tier];

  const reasonText =
    signal.reasons.length > 0 ? signal.reasons.slice(0, 3).join(' · ') : config.defaultTooltip;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', config.dotClassName)}
            aria-label={`${config.label}: ${reasonText}`}
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-muted-foreground mt-0.5">{reasonText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const Icon = config.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium leading-tight shrink-0',
            config.className,
          )}
        >
          {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />}
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <p className="font-medium">{config.label}</p>
        <p className="text-muted-foreground mt-0.5">{reasonText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Detailed credibility note for the drawer (under the website link). */
export function CredibilityNote({ signal }: { signal: CredibilitySignal }) {
  if (!signal.tier || signal.tier === 'established') {
    if (signal.tier === 'established') {
      return (
        <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Established business signal
        </p>
      );
    }
    return null;
  }

  const config = {
    emerging: {
      label: 'Emerging',
      tone: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
    low_signal: {
      label: 'Low signal',
      tone: 'text-amber-800 dark:text-amber-300',
      dot: 'bg-amber-500',
    },
    shell: {
      label: 'Shell site',
      tone: 'text-destructive',
      dot: 'bg-destructive',
    },
  }[signal.tier];

  return (
    <div className="text-xs space-y-1">
      <p className={cn('flex items-center gap-1.5 font-medium', config.tone)}>
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full', config.dot)} />
        {config.label}
        {signal.score != null && (
          <span className="text-muted-foreground/60 font-normal">· {signal.score}/100</span>
        )}
      </p>
      {signal.reasons.length > 0 && (
        <ul className="text-muted-foreground space-y-0.5 pl-3.5">
          {signal.reasons.slice(0, 4).map((r, i) => (
            <li key={i} className="list-disc list-outside">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
