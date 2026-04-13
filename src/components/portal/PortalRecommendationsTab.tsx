import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Inbox } from 'lucide-react';
import {
  usePortalRecommendations,
  useDismissRecommendation,
  useMarkRecommendationPushed,
} from '@/hooks/portal/use-portal-recommendations';
import { RecommendationCard } from './RecommendationCard';
import { PushToPortalDialog } from './PushToPortalDialog';
import type { PortalDealRecommendationWithListing, RecommendationStatus } from '@/types/portal';

interface PortalRecommendationsTabProps {
  portalOrgId: string;
}

type StatusFilter = 'all' | RecommendationStatus;

const DISMISS_REASON_MAX = 500;

export function PortalRecommendationsTab({ portalOrgId }: PortalRecommendationsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [pushTarget, setPushTarget] = useState<PortalDealRecommendationWithListing | null>(null);

  const { data: recommendations, isLoading } = usePortalRecommendations(portalOrgId, statusFilter);
  const dismissMutation = useDismissRecommendation();
  const markPushed = useMarkRecommendationPushed();

  const pendingCount = recommendations?.filter((r) => r.status === 'pending').length ?? 0;

  const handleApproveAndPush = (reco: PortalDealRecommendationWithListing) => {
    setPushTarget(reco);
  };

  const handleDismissClick = (reco: PortalDealRecommendationWithListing) => {
    setDismissingId(reco.id);
    setDismissReason('');
  };

  const handleDismissConfirm = () => {
    if (!dismissingId) return;
    dismissMutation.mutate(
      { id: dismissingId, portalOrgId, reason: dismissReason || undefined },
      { onSettled: () => setDismissingId(null) },
    );
  };

  const handleDismissCancel = () => {
    setDismissingId(null);
    setDismissReason('');
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pushed">Pushed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="stale">Stale</SelectItem>
          </SelectContent>
        </Select>

        {statusFilter === 'all' && pendingCount > 0 && (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && recommendations?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium">No recommendations found</p>
          <p className="text-xs mt-1">
            {statusFilter === 'all'
              ? 'Recommendations will appear here once the matching engine runs.'
              : `No ${statusFilter} recommendations.`}
          </p>
        </div>
      )}

      {/* Recommendation list */}
      {!isLoading && recommendations && recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((reco) => (
            <div key={reco.id}>
              <RecommendationCard
                recommendation={reco}
                onApproveAndPush={handleApproveAndPush}
                onDismiss={handleDismissClick}
              />

              {/* Inline dismiss dialog */}
              {dismissingId === reco.id && (
                <div className="mt-2 ml-4 flex items-center gap-2">
                  <Input
                    placeholder="Reason for dismissing (optional)"
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                    maxLength={DISMISS_REASON_MAX}
                    className="h-8 text-xs max-w-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDismissConfirm();
                      if (e.key === 'Escape') handleDismissCancel();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    disabled={dismissMutation.isPending}
                    onClick={handleDismissConfirm}
                  >
                    {dismissMutation.isPending ? 'Dismissing...' : 'Confirm'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={handleDismissCancel}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Push dialog — opens when user clicks "Approve & Push". After a
          successful push, mark the recommendation row as pushed. */}
      <PushToPortalDialog
        open={pushTarget !== null}
        onOpenChange={(open) => !open && setPushTarget(null)}
        listingId={pushTarget?.listing_id}
        listingTitle={pushTarget?.listing_title}
        defaultPortalOrgId={pushTarget?.portal_org_id}
        onPushSuccess={({ pushId, portalOrgId: orgId, listingId }) => {
          markPushed.mutate({ portalOrgId: orgId, listingId, pushId });
        }}
      />
    </div>
  );
}
