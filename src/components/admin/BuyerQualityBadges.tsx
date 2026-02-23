import { Badge } from '@/components/ui/badge';

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
    <Badge className={`text-[10px] px-1.5 py-0 leading-4 ${config.className}`}>
      {isOverride ? '★ ' : ''}T{tier}
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

export function BuyerScoreBadge({ score }: { score?: number | null }) {
  if (score == null) {
    return <span className="text-xs text-red-500">—</span>;
  }
  let color = 'text-red-600';
  if (score >= 70) color = 'text-green-600 font-semibold';
  else if (score >= 45) color = 'text-blue-600 font-medium';
  else if (score >= 15) color = 'text-amber-600';

  return <span className={`text-xs ${color}`}>{score}</span>;
}
