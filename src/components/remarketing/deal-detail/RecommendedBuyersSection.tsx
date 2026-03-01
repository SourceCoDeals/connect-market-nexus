import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Zap,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  X,
  MapPin,
} from 'lucide-react';
import { useRecommendedBuyers, type RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';
import { useAutoScoreDeal } from '@/hooks/admin/use-auto-score-deal';
import { useBuyerIntroductions } from '@/hooks/use-buyer-introductions';
import { useQueryClient } from '@tanstack/react-query';
import { BuyerRecommendationCard } from '@/components/admin/pipeline/tabs/recommended-buyers/BuyerRecommendationCard';
import { cn } from '@/lib/utils';

interface RecommendedBuyersSectionProps {
  listingId: string;
  listingTitle?: string;
}

const PAGE_SIZE = 5;

export function RecommendedBuyersSection({
  listingId,
  listingTitle,
}: RecommendedBuyersSectionProps) {
  const [page, setPage] = useState(0);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [approvedBuyers, setApprovedBuyers] = useState<RecommendedBuyer[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching, refetch } = useRecommendedBuyers(listingId, 100);

  const hasScores = isLoading ? undefined : (data?.buyers?.length ?? 0) > 0;
  const autoScore = useAutoScoreDeal(listingId, hasScores);

  const { createIntroduction } = useBuyerIntroductions(listingId);

  // Auto-trigger scoring when we detect no scores exist
  useEffect(() => {
    if (hasScores === false && autoScore.status === 'idle') {
      autoScore.triggerAutoScore();
    }
  }, [hasScores, autoScore.status, autoScore.triggerAutoScore]);

  // Filter out rejected and approved buyers from recommendations
  const availableBuyers = useMemo(() => {
    if (!data?.buyers) return [];
    const approvedIdSet = new Set(approvedBuyers.map((b) => b.buyer_id));
    return data.buyers.filter(
      (b) => !rejectedIds.has(b.buyer_id) && !approvedIdSet.has(b.buyer_id),
    );
  }, [data?.buyers, rejectedIds, approvedBuyers]);

  // Paginate to show 5 at a time
  const totalPages = Math.max(1, Math.ceil(availableBuyers.length / PAGE_SIZE));
  const paginatedBuyers = useMemo(() => {
    const start = page * PAGE_SIZE;
    return availableBuyers.slice(start, start + PAGE_SIZE);
  }, [availableBuyers, page]);

  // Reset page when filters change
  useEffect(() => {
    if (page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const handleApprove = useCallback(
    (buyer: RecommendedBuyer) => {
      setApprovedBuyers((prev) => [...prev, buyer]);

      // Create an introduction record
      createIntroduction({
        buyer_name: buyer.company_name,
        buyer_firm_name: buyer.pe_firm_name || buyer.company_name,
        listing_id: listingId,
        company_name: listingTitle || '',
        targeting_reason: buyer.fit_reasoning || buyer.fit_signals.slice(0, 2).join('. ') || undefined,
      });
    },
    [listingId, listingTitle, createIntroduction],
  );

  const handleReject = useCallback((buyer: RecommendedBuyer) => {
    setRejectedIds((prev) => new Set(prev).add(buyer.buyer_id));
  }, []);

  const handleRemoveApproved = useCallback((buyerId: string) => {
    setApprovedBuyers((prev) => prev.filter((b) => b.buyer_id !== buyerId));
  }, []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['recommended-buyers', listingId] });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading recommended buyers...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Query error state
  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive/60 mx-auto" />
          <p className="text-sm text-muted-foreground">Failed to load recommended buyers</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Auto-scoring in progress
  if (autoScore.isAutoScoring) {
    const isImporting = autoScore.status === 'importing_buyers';
    return (
      <Card>
        <CardContent className="py-10 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              {isImporting ? 'Importing Buyers' : 'Scoring Buyers'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-center">{autoScore.message}</p>
          <Progress value={autoScore.progress} className="h-1.5 max-w-xs mx-auto" />
          <p className="text-[10px] text-muted-foreground/50 text-center">
            {isImporting
              ? 'Pulling in marketplace buyers so they can be scored.'
              : 'Scoring buyers in assigned universes. This runs in the background — you can navigate away and come back.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (autoScore.status === 'error') {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive/60 mx-auto" />
          <p className="text-sm text-muted-foreground">Auto-scoring failed: {autoScore.message}</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => autoScore.triggerAutoScore()}
              disabled={autoScore.isAutoScoring}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/remarketing/matching/${listingId}`)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Score Manually
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No universes assigned to this deal
  if (autoScore.status === 'no_universes') {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            This deal has not been assigned to a buyer universe yet
          </p>
          <p className="text-xs text-muted-foreground/60">
            Assign this deal to a buyer universe to enable buyer recommendations.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/remarketing/deals')}>
            Go to Remarketing Deals
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No data after scoring completed
  if (!data || data.buyers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No scored buyers for this deal yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Scoring may still be running in the background. Refresh in a moment.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/remarketing/matching/${listingId}`)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              View Matching
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Recommended Buyers Section ─── */}
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Recommended Buyers</h3>
            <span className="text-xs text-muted-foreground">
              {availableBuyers.length} remaining
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="tabular-nums min-w-[48px] text-center">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Buyer Cards - 5 at a time */}
        {paginatedBuyers.length > 0 ? (
          <div className="space-y-2">
            {paginatedBuyers.map((buyer, idx) => (
              <BuyerRecommendationCard
                key={buyer.buyer_id}
                buyer={buyer}
                rank={page * PAGE_SIZE + idx + 1}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            All recommendations have been reviewed.
          </div>
        )}
      </div>

      {/* ─── Approved: Introduce to Firm ─── */}
      {approvedBuyers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-medium text-foreground">Introduce to Firm</h3>
            <Badge
              variant="outline"
              className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
            >
              {approvedBuyers.length}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {approvedBuyers.map((buyer) => {
              const hqDisplay = [buyer.hq_city, buyer.hq_state].filter(Boolean).join(', ');
              return (
                <div
                  key={buyer.buyer_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5"
                >
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full h-8 w-8 text-xs font-bold flex-shrink-0',
                      buyer.composite_fit_score >= 80
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : buyer.composite_fit_score >= 60
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {buyer.composite_fit_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {buyer.pe_firm_name
                        ? `${buyer.company_name} (${buyer.pe_firm_name})`
                        : buyer.company_name}
                    </p>
                    {hqDisplay && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {hqDisplay}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveApproved(buyer.buyer_id)}
                    title="Remove from introductions"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cache indicator */}
      <div className="text-center text-[10px] text-muted-foreground/40">
        Last updated: {new Date(data.cachedAt).toLocaleString()}
      </div>
    </div>
  );
}
