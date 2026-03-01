import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Zap,
  Globe,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  X,
  MapPin,
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useRecommendedBuyers, type RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';
import { useAutoScoreDeal } from '@/hooks/admin/use-auto-score-deal';
import { useBuyerIntroductions } from '@/hooks/use-buyer-introductions';
import { useQueryClient } from '@tanstack/react-query';
import { BuyerRecommendationCard } from './recommended-buyers/BuyerRecommendationCard';
import { cn } from '@/lib/utils';

interface PipelineDetailRecommendedBuyersProps {
  deal: Deal;
}

const PAGE_SIZE = 5;

export function PipelineDetailRecommendedBuyers({ deal }: PipelineDetailRecommendedBuyersProps) {
  const [page, setPage] = useState(0);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [approvedBuyers, setApprovedBuyers] = useState<RecommendedBuyer[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Lead sources don't auto-score — only active deals do
  const LEAD_SOURCES = ['captarget', 'gp_partners', 'valuation_calculator', 'referral'];
  const isLeadSource = LEAD_SOURCES.includes((deal.deal_source || '').toLowerCase());
  const isActiveDeal = !isLeadSource;

  const { data, isLoading, isError, isFetching, refetch } = useRecommendedBuyers(
    deal.listing_id,
    100,
  );

  const hasScores = isLoading ? undefined : (data?.buyers?.length ?? 0) > 0;
  const autoScore = useAutoScoreDeal(deal.listing_id || undefined, hasScores);

  const { createIntroduction } = useBuyerIntroductions(deal.listing_id || undefined);

  // Auto-trigger scoring for active deals (not lead sources)
  useEffect(() => {
    if (isActiveDeal && hasScores === false && autoScore.status === 'idle') {
      autoScore.triggerAutoScore();
    }
  }, [isActiveDeal, hasScores, autoScore.status, autoScore.triggerAutoScore]);

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
      if (deal.listing_id) {
        createIntroduction({
          buyer_name: buyer.company_name,
          buyer_firm_name: buyer.pe_firm_name || buyer.company_name,
          listing_id: deal.listing_id,
          company_name: deal.listing_real_company_name || deal.listing_title || deal.title || '',
          targeting_reason: buyer.fit_reasoning || buyer.fit_signals.slice(0, 2).join('. ') || undefined,
        });
      }
    },
    [deal, createIntroduction],
  );

  const handleReject = useCallback((buyer: RecommendedBuyer) => {
    setRejectedIds((prev) => new Set(prev).add(buyer.buyer_id));
  }, []);

  const handleRemoveApproved = useCallback((buyerId: string) => {
    setApprovedBuyers((prev) => prev.filter((b) => b.buyer_id !== buyerId));
  }, []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['recommended-buyers', deal.listing_id] });
  };

  if (!deal.listing_id) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            No listing linked to this deal — buyer recommendations require a listing.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading recommended buyers...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive/60 mx-auto" />
          <p className="text-sm text-muted-foreground">Failed to load recommended buyers</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Auto-scoring in progress
  if (autoScore.isAutoScoring) {
    const isDiscovering = autoScore.status === 'discovering';
    const isImporting = autoScore.status === 'importing_buyers';
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center space-y-4 max-w-xs">
          <div className="flex items-center justify-center gap-2">
            {isDiscovering ? (
              <Globe className="h-5 w-5 text-blue-500 animate-pulse" />
            ) : (
              <Zap className="h-5 w-5 text-primary animate-pulse" />
            )}
            <span className="text-sm font-medium text-foreground">
              {isDiscovering
                ? 'Discovering Buyers via Google'
                : isImporting
                  ? 'Importing Buyers'
                  : 'Auto-Scoring Buyers'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{autoScore.message}</p>
          <Progress value={autoScore.progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground/50">
            {isDiscovering
              ? 'Searching Google for potential acquisition buyers matching this deal profile.'
              : 'Scoring all buyers across every universe. You can navigate away and come back.'}
          </p>
        </div>
      </div>
    );
  }

  if (autoScore.status === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center space-y-3">
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
              onClick={() => navigate(`/admin/remarketing/matching/${deal.listing_id}`)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Score Manually
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (autoScore.status === 'no_universes') {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No buyer universes configured yet</p>
          <p className="text-xs text-muted-foreground/60">
            Create a buyer universe and import buyers to enable recommendations.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/buyers/universes')}>
            Go to Universes
          </Button>
        </div>
      </div>
    );
  }

  if (!data || data.buyers.length === 0) {
    // Lead source deal — show manual trigger button instead of auto-scoring
    if (isLeadSource) {
      return (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Lead-source deals are not auto-scored.</p>
            <p className="text-xs text-muted-foreground/60">
              You can score this deal now if you want buyer recommendations.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => autoScore.triggerAutoScore()}
              disabled={autoScore.isAutoScoring}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Recommend Buyers Now
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No scored buyers for this deal yet</p>
          <p className="text-xs text-muted-foreground/60">
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
              onClick={() => navigate(`/admin/remarketing/matching/${deal.listing_id}`)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Match Buyers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="px-6 pb-8 space-y-6">
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
    </ScrollArea>
  );
}
