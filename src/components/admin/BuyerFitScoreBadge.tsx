import { cn } from '@/lib/utils';
import { Shield, Target } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Tier config ────────────────────────────────────────────────────────
export const BUYER_FIT_TIERS: Record<
  number,
  {
    label: string;
    shortLabel: string;
    color: string;
    bg: string;
    border: string;
    description: string;
  }
> = {
  1: {
    label: 'Platform + Add-On',
    shortLabel: 'Tier 1',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    description: 'PE firm or corporate with existing platform — highest close probability',
  },
  2: {
    label: 'Committed Capital',
    shortLabel: 'Tier 2',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    description: 'Closed fund, family office, or corporate with dedicated M&A budget',
  },
  3: {
    label: 'Indep. Sponsor / Search',
    shortLabel: 'Tier 3',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    description: 'Independent sponsor or search fund — deal-by-deal capital raise',
  },
  4: {
    label: 'Unverified',
    shortLabel: 'Tier 4',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    description: 'Incomplete profile — needs more information to classify',
  },
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-700 dark:text-emerald-400';
  if (score >= 45) return 'text-blue-700 dark:text-blue-400';
  if (score >= 15) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}

// ── Tier Badge — compact badge showing tier label ──────────────────────
interface BuyerTierBadgeProps {
  tier: number | null | undefined;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function BuyerTierBadge({ tier, size = 'sm', showLabel = true }: BuyerTierBadgeProps) {
  if (!tier || tier < 1 || tier > 4) return null;
  const config = BUYER_FIT_TIERS[tier];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded border font-medium',
              config.color,
              config.bg,
              config.border,
              size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
            )}
          >
            <Shield className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
            {showLabel ? config.label : config.shortLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p className="font-medium">
            {config.shortLabel}: {config.label}
          </p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Score Badge — shows numeric score with color ───────────────────────
interface BuyerFitScoreBadgeProps {
  score: number | null | undefined;
  tier?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showTier?: boolean;
}

export function BuyerFitScoreBadge({
  score,
  tier,
  size = 'sm',
  showTier = false,
}: BuyerFitScoreBadgeProps) {
  if (score == null) return null;

  const scoreColor = getScoreColor(score);
  const effectiveTier = tier ?? (score >= 70 ? 1 : score >= 45 ? 2 : score >= 15 ? 3 : 4);
  const tierConfig = BUYER_FIT_TIERS[effectiveTier];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded border font-semibold',
              tierConfig.bg,
              tierConfig.border,
              scoreColor,
              size === 'sm' && 'px-1.5 py-0.5 text-[11px]',
              size === 'md' && 'px-2 py-0.5 text-xs',
              size === 'lg' && 'px-2.5 py-1 text-sm',
            )}
          >
            {score}
            {showTier && <span className="font-normal opacity-70">/ T{effectiveTier}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p className="font-medium">Buyer Fit Score: {score}/100</p>
          <p className="text-xs text-muted-foreground">
            {tierConfig.shortLabel}: {tierConfig.label}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Platform Signal Indicator ──────────────────────────────────────────
interface PlatformSignalBadgeProps {
  detected: boolean | null | undefined;
  source?: string | null;
}

export function PlatformSignalBadge({ detected, source }: PlatformSignalBadgeProps) {
  if (!detected) return null;

  const sourceLabel =
    source === 'message' ? 'Deal message' : source === 'profile' ? 'Profile' : 'Enrichment';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <Target className="w-3 h-3" />
            Add-On
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="font-medium">Platform/Add-On Signal Detected</p>
          <p className="text-xs text-muted-foreground">Source: {sourceLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
