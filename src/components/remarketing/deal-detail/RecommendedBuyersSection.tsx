import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
  AlertCircle,
  Globe,
} from 'lucide-react';
import { useRecommendedBuyers } from '@/hooks/admin/use-recommended-buyers';
import { useAutoScoreDeal } from '@/hooks/admin/use-auto-score-deal';
import { useQueryClient } from '@tanstack/react-query';
import { BuyerRecommendationCard } from '@/components/admin/pipeline/tabs/recommended-buyers/BuyerRecommendationCard';
import { BuyerNarrativePanel } from '@/components/admin/pipeline/tabs/recommended-buyers/BuyerNarrativePanel';

interface RecommendedBuyersSectionProps {
  listingId: string;
  listingTitle?: string;
}

type SortOption = 'score' | 'engagement' | 'fee_agreement';

export function RecommendedBuyersSection({
  listingId,
  listingTitle,
}: RecommendedBuyersSectionProps) {
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const limit = showAll ? 100 : 25;
  const { data, isLoading, isError, isFetching, refetch } = useRecommendedBuyers(listingId, limit);

  const hasScores = isLoading ? undefined : (data?.buyers?.length ?? 0) > 0;

  const autoScore = useAutoScoreDeal(listingId, hasScores);

  // Auto-trigger scoring when we detect no scores exist
  useEffect(() => {
    if (hasScores === false && autoScore.status === 'idle') {
      autoScore.triggerAutoScore();
    }
  }, [hasScores, autoScore.status, autoScore.triggerAutoScore]);

  const filteredAndSorted = useMemo(() => {
    if (!data?.buyers) return [];

    let buyers = [...data.buyers];

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
        break;
    }

    return buyers;
  }, [data?.buyers, searchQuery, sortBy]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['recommended-buyers', listingId] });
  };

  const handleDraftEmail = (buyerId: string) => {
    window.dispatchEvent(
      new CustomEvent('ai-command-center:open', {
        detail: {
          query: `Draft an outreach email for this deal to buyer ${buyerId}. Use the deal context and buyer profile to personalize the email.`,
          context: {
            page: 'deal_detail',
            entity_id: listingId,
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
    const isDiscovering = autoScore.status === 'discovering';
    const isImporting = autoScore.status === 'importing_buyers';
    return (
      <Card>
        <CardContent className="py-10 space-y-4">
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
          <p className="text-xs text-muted-foreground text-center">{autoScore.message}</p>
          <Progress value={autoScore.progress} className="h-1.5 max-w-xs mx-auto" />
          <p className="text-[10px] text-muted-foreground/50 text-center">
            {isDiscovering
              ? 'Searching Google for potential acquisition buyers matching this deal profile.'
              : isImporting
                ? 'Pulling in marketplace buyers and unassigned buyers so every buyer gets scored.'
                : 'Scoring all buyers across the entire buyer pool. This runs in the background — you can navigate away and come back.'}
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

  // No universes exist at all
  if (autoScore.status === 'no_universes') {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No buyer universes configured yet</p>
          <p className="text-xs text-muted-foreground/60">
            Create a buyer universe and import buyers to enable recommendations.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/buyers/universes')}>
            Go to Universes
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No data after scoring completed (edge case — universe has no buyers)
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

  const dealTitle = listingTitle || 'This Deal';

  return (
    <div className="space-y-4">
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
        dealId={listingId}
        listingId={listingId}
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
  );
}
