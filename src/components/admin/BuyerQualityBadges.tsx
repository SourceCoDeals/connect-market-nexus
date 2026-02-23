import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const TIER_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: 'Platform Add-On', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  2: { label: 'Committed Capital', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  3: { label: 'Indep. Sponsor', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  4: { label: 'Unverified', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
};

export function BuyerTierBadge({
  tier,
  isOverride,
}: {
  tier?: number | null;
  isOverride?: boolean;
}) {
  if (tier == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const config = TIER_CONFIG[tier] || TIER_CONFIG[4];
  return (
    <Badge className={`text-[11px] px-2 py-0.5 leading-4 ${config.className}`}>
      {isOverride ? '★ ' : ''}T{tier} · {config.label}
    </Badge>
  );
}

export function BuyerTierBadgeFull({
  tier,
  isOverride,
}: {
  tier?: number | null;
  isOverride?: boolean;
}) {
  if (tier == null) {
    return <span className="text-xs text-muted-foreground">Not scored</span>;
  }
  const config = TIER_CONFIG[tier] || TIER_CONFIG[4];
  return (
    <Badge className={`text-xs px-2 py-0.5 ${config.className}`}>
      {isOverride ? '★ ' : ''}Tier {tier}: {config.label}
    </Badge>
  );
}

export function BuyerScoreBadge({ score, size = 'sm' }: { score?: number | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (score == null) {
    return <span className="text-xs text-red-500">—</span>;
  }

  const getScoreColor = (s: number) => {
    if (s >= 70) return 'bg-green-500/15 text-green-600 border-green-200';
    if (s >= 40) return 'bg-yellow-500/15 text-yellow-600 border-yellow-200';
    return 'bg-red-500/15 text-red-600 border-red-200';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 70) return 'Strong';
    if (s >= 40) return 'Moderate';
    return 'Weak';
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-0.5 gap-1',
    lg: 'text-base px-2.5 py-1 gap-1',
    xl: 'text-2xl px-3.5 py-1.5 gap-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
    xl: 'w-6 h-6',
  };

  const badge = (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-bold',
        getScoreColor(score),
        sizeClasses[size],
      )}
    >
      <TrendingUp className={iconSizes[size]} />
      {score}
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            <p className="font-semibold mb-1">Buyer Score: {score}/100</p>
            <p className="text-muted-foreground text-xs">
              {getScoreLabel(score)} buyer profile
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
