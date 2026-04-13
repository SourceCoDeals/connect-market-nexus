import { format } from 'date-fns';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PortalDealRecommendationWithListing } from '@/types/portal';

interface RecommendationCardProps {
  recommendation: PortalDealRecommendationWithListing;
  onApproveAndPush: (reco: PortalDealRecommendationWithListing) => void;
  onDismiss: (reco: PortalDealRecommendationWithListing) => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  approved: 'bg-blue-100 text-blue-800',
  pushed: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-600',
  stale: 'bg-gray-100 text-gray-500',
};

function formatEbitda(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function RecommendationCard({
  recommendation: reco,
  onApproveAndPush,
  onDismiss,
}: RecommendationCardProps) {
  const scoreColor =
    reco.match_score >= 70
      ? 'text-green-700 bg-green-50 border-green-200'
      : reco.match_score >= 45
        ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
        : 'text-gray-600 bg-gray-50 border-gray-200';

  const scoreLabel =
    reco.match_score >= 70 ? 'Strong' : reco.match_score >= 45 ? 'Moderate' : 'Weak';

  return (
    <Card className="relative">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm truncate">{reco.listing_title}</h4>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {reco.listing_industry && (
                <Badge variant="secondary" className="text-xs">
                  {reco.listing_industry}
                </Badge>
              )}
              {reco.listing_state && (
                <Badge variant="outline" className="text-xs">
                  {reco.listing_state}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                EBITDA: {formatEbitda(reco.listing_ebitda)}
              </span>
            </div>
          </div>

          {/* Match score */}
          <div className={cn('shrink-0 rounded-md border px-2.5 py-1 text-center', scoreColor)}>
            <div className="text-lg font-bold leading-tight">{reco.match_score}</div>
            <div className="text-[10px] uppercase tracking-wide">{scoreLabel}</div>
          </div>
        </div>

        {/* Match reasons */}
        {reco.match_reasons.length > 0 && (
          <p className="text-xs text-muted-foreground">{reco.match_reasons.join(', ')}</p>
        )}

        {/* Portfolio company & thesis */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {reco.portfolio_company_name && (
            <span className="text-muted-foreground">&rarr; {reco.portfolio_company_name}</span>
          )}
          {reco.thesis_label && (
            <span className="text-muted-foreground">
              Matches: <span className="font-medium text-foreground">{reco.thesis_label}</span>
            </span>
          )}
        </div>

        {/* Footer: status, date, actions */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="flex items-center gap-2">
            <Badge className={cn('text-[10px] capitalize', STATUS_STYLES[reco.status])}>
              {reco.status}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {format(new Date(reco.created_at), 'MMM d, yyyy')}
            </span>
          </div>

          {reco.status === 'pending' && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                onClick={() => onApproveAndPush(reco)}
              >
                <Check className="h-3.5 w-3.5" />
                Approve &amp; Push
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() => onDismiss(reco)}
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
