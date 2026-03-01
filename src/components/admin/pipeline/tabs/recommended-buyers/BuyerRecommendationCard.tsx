import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapPin, Check, X } from 'lucide-react';
import type { RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';

interface BuyerRecommendationCardProps {
  buyer: RecommendedBuyer;
  rank: number;
  onApprove?: (buyer: RecommendedBuyer) => void;
  onReject?: (buyer: RecommendedBuyer) => void;
}

export function BuyerRecommendationCard({
  buyer,
  rank,
  onApprove,
  onReject,
}: BuyerRecommendationCardProps) {
  const displayName = buyer.pe_firm_name
    ? `${buyer.company_name} (${buyer.pe_firm_name})`
    : buyer.company_name;

  const hqDisplay = [buyer.hq_city, buyer.hq_state].filter(Boolean).join(', ');

  // Build a concise fit summary: prefer fit_reasoning, fall back to first 2 fit signals
  const fitSummary =
    buyer.fit_reasoning ||
    (buyer.fit_signals.length > 0 ? buyer.fit_signals.slice(0, 2).join('. ') + '.' : null);

  return (
    <div className="flex items-center gap-4 p-3 border border-border/40 rounded-lg hover:border-border/60 transition-colors">
      {/* Rank */}
      <span className="text-xs font-mono text-muted-foreground/60 w-4 text-right flex-shrink-0">
        {rank}
      </span>

      {/* Score - prominently displayed */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full h-10 w-10 text-sm font-bold flex-shrink-0',
          buyer.composite_fit_score >= 80
            ? 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30'
            : buyer.composite_fit_score >= 60
              ? 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30'
              : 'bg-muted text-muted-foreground ring-1 ring-border/40',
        )}
      >
        {buyer.composite_fit_score}
      </div>

      {/* Content - name, geography, fit reason */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
        {hqDisplay && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {hqDisplay}
          </p>
        )}
        {fitSummary && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {fitSummary}
          </p>
        )}
      </div>

      {/* Approve / Reject buttons on the right */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onReject && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onReject(buyer);
            }}
            title="Reject"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {onApprove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onApprove(buyer);
            }}
            title="Approve - Introduce to firm"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
