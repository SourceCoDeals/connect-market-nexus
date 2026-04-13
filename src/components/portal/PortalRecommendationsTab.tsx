import { useState, useEffect, useMemo } from 'react';
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
import { ChevronLeft, ChevronRight, HelpCircle, Inbox, Sparkles, Upload } from 'lucide-react';
import {
  usePortalRecommendations,
  useDismissRecommendation,
  useMarkRecommendationPushed,
  useUnseenStrongMatchCount,
  useMarkStrongMatchesSeen,
  useRecommendationCount,
  DEFAULT_RECOMMENDATIONS_PAGE_SIZE,
} from '@/hooks/portal/use-portal-recommendations';
import { RecommendationCard } from './RecommendationCard';
import { PushToPortalDialog } from './PushToPortalDialog';
import { WhyNotDialog } from './WhyNotDialog';
import type { PortalDealRecommendationWithListing, RecommendationStatus } from '@/types/portal';

interface PortalRecommendationsTabProps {
  portalOrgId: string;
}

type StatusFilter = 'all' | RecommendationStatus;

const DISMISS_REASON_MAX = 500;

export function PortalRecommendationsTab({ portalOrgId }: PortalRecommendationsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [pushTarget, setPushTarget] = useState<PortalDealRecommendationWithListing | null>(null);
  const [bulkQueue, setBulkQueue] = useState<PortalDealRecommendationWithListing[] | null>(null);
  const [whyNotOpen, setWhyNotOpen] = useState(false);

  // Reset to page 0 when the filter changes.
  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const { data, isLoading } = usePortalRecommendations(portalOrgId, {
    statusFilter,
    page,
    pageSize: DEFAULT_RECOMMENDATIONS_PAGE_SIZE,
  });
  const recommendations = data?.rows;
  const total = data?.total ?? 0;

  const { data: pendingCount } = useRecommendationCount(portalOrgId);
  const { data: unseenStrong } = useUnseenStrongMatchCount(portalOrgId);
  const markStrongSeen = useMarkStrongMatchesSeen();

  const dismissMutation = useDismissRecommendation();
  const markPushed = useMarkRecommendationPushed();

  // When the tab mounts and has unseen strong matches, mark them seen
  // so the badge clears for next visit. Fires once per mount.
  useEffect(() => {
    if (unseenStrong && unseenStrong > 0) {
      markStrongSeen.mutate({ portalOrgId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalOrgId, unseenStrong]);

  const approvedRecs = useMemo(
    () => (recommendations ?? []).filter((r) => r.status === 'approved'),
    [recommendations],
  );

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

  const handleBulkPush = () => {
    if (approvedRecs.length === 0) return;
    setBulkQueue(approvedRecs);
    setPushTarget(approvedRecs[0]);
  };

  // When a single push succeeds, advance to the next item in the bulk queue
  // if one exists. Otherwise, close the push dialog.
  const handlePushSuccess = ({
    pushId,
    portalOrgId: orgId,
    listingId,
  }: {
    pushId: string;
    portalOrgId: string;
    listingId: string;
  }) => {
    markPushed.mutate({ portalOrgId: orgId, listingId, pushId });

    if (bulkQueue && bulkQueue.length > 0) {
      const remaining = bulkQueue.slice(1);
      if (remaining.length > 0) {
        setBulkQueue(remaining);
        // Slight delay so the dialog finishes its close animation before reopening.
        setTimeout(() => setPushTarget(remaining[0]), 100);
      } else {
        setBulkQueue(null);
        setPushTarget(null);
      }
    } else {
      setPushTarget(null);
    }
  };

  const handlePushCancel = () => {
    setPushTarget(null);
    setBulkQueue(null);
  };

  const pageCount = Math.max(1, Math.ceil(total / DEFAULT_RECOMMENDATIONS_PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  return (
    <div className="space-y-4">
      {/* Filter + actions bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
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

          {pendingCount != null && pendingCount > 0 && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
              {pendingCount} pending
            </Badge>
          )}

          {unseenStrong != null && unseenStrong > 0 && (
            <Badge className="bg-green-600 text-white text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              {unseenStrong} new strong
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWhyNotOpen(true)}
            title="Score any deal against every thesis (including below threshold)"
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            Why Not?
          </Button>
          {statusFilter === 'approved' && approvedRecs.length > 0 && (
            <Button size="sm" onClick={handleBulkPush}>
              <Upload className="h-4 w-4 mr-1" />
              Push All Approved ({approvedRecs.length})
            </Button>
          )}
        </div>
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

      {/* Pagination */}
      {!isLoading && total > DEFAULT_RECOMMENDATIONS_PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {pageCount} · {total} total
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Push dialog */}
      <PushToPortalDialog
        open={pushTarget !== null}
        onOpenChange={(open) => !open && handlePushCancel()}
        listingId={pushTarget?.listing_id}
        listingTitle={
          bulkQueue && bulkQueue.length > 0
            ? `${pushTarget?.listing_title} (${bulkQueue.length} remaining in bulk queue)`
            : pushTarget?.listing_title
        }
        defaultPortalOrgId={pushTarget?.portal_org_id}
        onPushSuccess={handlePushSuccess}
      />

      {/* Why-Not debugging dialog */}
      <WhyNotDialog open={whyNotOpen} onOpenChange={setWhyNotOpen} portalOrgId={portalOrgId} />
    </div>
  );
}
