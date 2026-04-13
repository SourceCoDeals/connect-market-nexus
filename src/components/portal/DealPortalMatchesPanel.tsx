import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useDealPortalMatches,
  useApproveRecommendation,
  useDismissRecommendation,
} from '@/hooks/portal/use-portal-recommendations';

interface DealPortalMatchesPanelProps {
  listingId: string;
}

const SCORE_COLOR = (score: number) =>
  score >= 70
    ? 'text-green-700 bg-green-50'
    : score >= 45
      ? 'text-yellow-700 bg-yellow-50'
      : 'text-gray-600 bg-gray-50';

const CATEGORY_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  strong: 'default',
  moderate: 'secondary',
  weak: 'outline',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-800',
  approved: 'bg-blue-100 text-blue-800',
  pushed: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-600',
};

export function DealPortalMatchesPanel({ listingId }: DealPortalMatchesPanelProps) {
  const { data: matches, isLoading } = useDealPortalMatches(listingId);
  const approveRecommendation = useApproveRecommendation();
  const dismissRecommendation = useDismissRecommendation();

  const count = matches?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Portal Matches ({count})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading matches...</p>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">No portal matches</p>
        ) : (
          <div className="space-y-3">
            {matches!.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{match.portal_org_name}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold',
                        SCORE_COLOR(match.match_score),
                      )}
                    >
                      {match.match_score}
                    </span>
                    <Badge
                      variant={CATEGORY_VARIANT[match.match_category] ?? 'outline'}
                      className="text-[10px] capitalize"
                    >
                      {match.match_category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {match.portfolio_company_name && (
                      <span>&rarr; {match.portfolio_company_name}</span>
                    )}
                    <Badge className={cn('text-[10px] capitalize', STATUS_STYLES[match.status])}>
                      {match.status}
                    </Badge>
                  </div>
                </div>

                {match.status === 'pending' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        approveRecommendation.mutate({
                          id: match.id,
                          portalOrgId: match.portal_org_id,
                        })
                      }
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() =>
                        dismissRecommendation.mutate({
                          id: match.id,
                          portalOrgId: match.portal_org_id,
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
