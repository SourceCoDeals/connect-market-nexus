import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Search,
  Phone,
  UserCheck,
  Mail as MailIcon,
  Zap,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useRecommendedBuyers } from '@/hooks/admin/use-recommended-buyers';
import { useAutoScoreDeal } from '@/hooks/admin/use-auto-score-deal';
import { useQueryClient } from '@tanstack/react-query';
import { BuyerRecommendationCard } from './recommended-buyers/BuyerRecommendationCard';
import { BuyerNarrativePanel } from './recommended-buyers/BuyerNarrativePanel';

interface PipelineDetailRecommendedBuyersProps {
  deal: Deal;
}

type SortOption = 'score' | 'engagement' | 'fee_agreement';

export function PipelineDetailRecommendedBuyers({ deal }: PipelineDetailRecommendedBuyersProps) {
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Only auto-score for active deals (NDA Sent and beyond, not closed)
  const isActiveDeal = deal.stage_position >= 3 && deal.stage_position <= 9;
  const isClosedDeal = deal.stage_position >= 10;

  const limit = showAll ? 100 : 25;
  const { data, isLoading, isError, isFetching, refetch } = useRecommendedBuyers(
    deal.listing_id,
    limit,
  );

  const hasScores = isLoading ? undefined : (data?.buyers?.length ?? 0) > 0;
  const autoScore = useAutoScoreDeal(deal.listing_id || undefined, hasScores);

  // Auto-trigger scoring ONLY for active deals (not leads, not closed)
  useEffect(() => {
    if (isActiveDeal && hasScores === false && autoScore.status === 'idle') {
      autoScore.triggerAutoScore();
    }
  }, [isActiveDeal, hasScores, autoScore.status, autoScore.triggerAutoScore]);

  const filteredAndSorted = useMemo(() => {
    if (!data?.buyers) return [];

    let buyers = [...data.buyers];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      buyers = buyers.filter(
        (b) =>
          b.company_name.toLowerCase().includes(q) ||
          (b.pe_firm_name && b.pe_firm_name.toLowerCase().includes(q)) ||
          (b.hq_state && b.hq_state.toLowerCase().includes(q)) ||
          (b.hq_city && b.hq_city.toLowerCase().includes(q)) ||
          (b.buyer_type && b.buyer_type.toLowerCase().includes(q)),
      );
    }

    // Sort
    switch (sortBy) {
      case 'engagement':
        buyers.sort((a, b) => {
          if (!a.last_engagement && !b.last_engagement)
            return b.composite_fit_score - a.composite_fit_score;
          if (!a.last_engagement) return 1;
          if (!b.last_engagement) return -1;
          return new Date(b.last_engagement).getTime() - new Date(a.last_engagement).getTime();
        });
        break;
      case 'fee_agreement':
        buyers.sort((a, b) => {
          if (a.has_fee_agreement !== b.has_fee_agreement) return a.has_fee_agreement ? -1 : 1;
          return b.composite_fit_score - a.composite_fit_score;
        });
        break;
      case 'score':
      default:
        // Already sorted by score from the hook
        break;
    }

    return buyers;
  }, [data?.buyers, searchQuery, sortBy]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['recommended-buyers', deal.listing_id] });
  };

  const handleDraftEmail = (buyerId: string) => {
    // Open AI command center with context for drafting outreach email
    // This triggers a custom event that the AI panel listens to
    window.dispatchEvent(
      new CustomEvent('ai-command-center:open', {
        detail: {
          query: `Draft an outreach email for this deal to buyer ${buyerId}. Use the deal context and buyer profile to personalize the email.`,
          context: {
            page: 'deal_detail',
            entity_id: deal.listing_id,
            entity_type: 'deal',
            tab: 'recommended_buyers',
          },
        },
      }),
    );
  };

  const handleViewProfile = (buyerId: string) => {
    navigate(`/admin/buyers/${buyerId}`);
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
    // Early-stage lead — show manual trigger button
    if (!isActiveDeal && !isClosedDeal) {
      return (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Buyer scoring runs automatically once a deal reaches NDA stage.
            </p>
            <p className="text-xs text-muted-foreground/60">
              You can also score this deal now if you want early recommendations.
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

  const dealTitle = deal.listing_real_company_name || deal.listing_title || deal.title;

  return (
    <ScrollArea className="flex-1">
      <div className="px-6 pb-8 space-y-4">
        {/* Header with tier summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Recommended Buyers</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {data.total} of {data.totalScored} scored
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {data.tierSummary.move_now}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {data.tierSummary.strong_candidate}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                {data.tierSummary.speculative}
              </span>
            </div>
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

        {/* Data enrichment stats */}
        {(data.dataStats.buyers_with_transcripts > 0 ||
          data.dataStats.buyers_with_outreach > 0 ||
          data.dataStats.buyers_with_ceo_engagement > 0) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            {data.dataStats.buyers_with_transcripts > 0 && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-blue-500" />
                {data.dataStats.buyers_with_transcripts} with calls
              </span>
            )}
            {data.dataStats.buyers_with_ceo_engagement > 0 && (
              <span className="flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-emerald-500" />
                {data.dataStats.buyers_with_ceo_engagement} CEO engaged
              </span>
            )}
            {data.dataStats.buyers_with_outreach > 0 && (
              <span className="flex items-center gap-1">
                <MailIcon className="h-3 w-3 text-violet-500" />
                {data.dataStats.buyers_with_outreach} contacted
              </span>
            )}
          </div>
        )}

        {/* Narrative Panel */}
        <BuyerNarrativePanel
          dealId={deal.deal_id}
          listingId={deal.listing_id!}
          dealTitle={dealTitle}
          buyers={data.buyers}
          totalScored={data.totalScored}
        />

        {/* Filters & Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Search buyers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Fit Score</SelectItem>
              <SelectItem value="engagement">Last Engagement</SelectItem>
              <SelectItem value="fee_agreement">Fee Agreement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Buyer Cards */}
        <div className="space-y-2">
          {filteredAndSorted.map((buyer, idx) => (
            <BuyerRecommendationCard
              key={buyer.buyer_id}
              buyer={buyer}
              rank={idx + 1}
              onDraftEmail={handleDraftEmail}
              onViewProfile={handleViewProfile}
            />
          ))}
        </div>

        {/* Show all toggle */}
        {!showAll && data.totalScored > 25 && (
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setShowAll(true)}
            >
              Show all {data.totalScored} buyers
            </Button>
          </div>
        )}

        {filteredAndSorted.length === 0 && searchQuery && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No buyers match "{searchQuery}"
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
