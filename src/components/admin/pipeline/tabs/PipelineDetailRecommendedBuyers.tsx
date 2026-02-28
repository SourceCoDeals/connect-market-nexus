import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useRecommendedBuyers } from '@/hooks/admin/use-recommended-buyers';
import { useTop5Management } from '@/hooks/admin/use-top5-management';
import { useQueryClient } from '@tanstack/react-query';
import { BuyerRecommendationCard } from './recommended-buyers/BuyerRecommendationCard';
import { BuyerNarrativePanel } from './recommended-buyers/BuyerNarrativePanel';
import { Top5Panel } from './recommended-buyers/Top5Panel';
import { RejectionHistory } from './recommended-buyers/RejectionHistory';

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

  const limit = showAll ? 100 : 25;
  const { data, isLoading, isFetching } = useRecommendedBuyers(deal.listing_id, limit);

  const {
    rejections,
    rejectedBuyerIds,
    isReversing,
    newlyAddedIds,
    handleReject,
    handleReverse,
    markNewlyAdded,
  } = useTop5Management(deal.listing_id);

  // Track Top 5 changes to mark newly added buyers
  const prevTop5Ref = useRef<Set<string>>(new Set());
  const top5Buyers = useMemo(() => {
    if (!data?.buyers) return [];
    return data.buyers.filter((b) => !rejectedBuyerIds.has(b.buyer_id)).slice(0, 5);
  }, [data?.buyers, rejectedBuyerIds]);

  useEffect(() => {
    const currentIds = new Set(top5Buyers.map((b) => b.buyer_id));
    const prevIds = prevTop5Ref.current;
    if (prevIds.size > 0) {
      const added = [...currentIds].filter((id) => !prevIds.has(id));
      if (added.length > 0) {
        markNewlyAdded(added);
      }
    }
    prevTop5Ref.current = currentIds;
  }, [top5Buyers, markNewlyAdded]);

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
        break;
    }

    return buyers;
  }, [data?.buyers, searchQuery, sortBy]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['recommended-buyers', deal.listing_id] });
  };

  // Enriched draft email handler — populates AI Command Center with deal & buyer context
  const handleDraftEmail = useCallback(
    (buyerId: string) => {
      const buyer = data?.buyers.find((b) => b.buyer_id === buyerId);
      const dealTitle = deal.listing_real_company_name || deal.listing_title || deal.title;

      const buyerName = buyer
        ? buyer.pe_firm_name
          ? `${buyer.company_name} (${buyer.pe_firm_name})`
          : buyer.company_name
        : buyerId;

      const fitSignals = buyer?.fit_signals?.join(', ') || 'General alignment';
      const callInfo =
        buyer && buyer.transcript_insights.call_count > 0
          ? `${buyer.transcript_insights.call_count} call(s) on record${buyer.transcript_insights.ceo_detected ? ', CEO participated' : ''}`
          : 'No calls recorded';
      const outreachStage = buyer
        ? [
            buyer.outreach_info.meeting_scheduled && 'Meeting scheduled',
            buyer.outreach_info.cim_sent && 'CIM sent',
            buyer.outreach_info.nda_signed && 'NDA signed',
            buyer.outreach_info.contacted && 'Contacted',
          ]
            .filter(Boolean)
            .join(', ') || 'Not yet contacted'
        : 'Unknown';

      window.dispatchEvent(
        new CustomEvent('ai-command-center:open', {
          detail: {
            query: `Draft a personalized outreach email for the deal "${dealTitle}" to buyer "${buyerName}".

Context:
- Deal: ${dealTitle}
- Buyer: ${buyerName}
- Fit Score: ${buyer?.composite_fit_score ?? 'N/A'}/100 (${buyer?.tier_label ?? 'Unknown tier'})
- Top Fit Signals: ${fitSignals}
- Call Activity: ${callInfo}
- Outreach Stage: ${outreachStage}
- Fee Agreement: ${buyer?.has_fee_agreement ? 'Signed' : 'Not signed'}

Use this context to create a highly personalized email. Reference their specific fit signals and engagement history.`,
            context: {
              page: 'deal_detail',
              entity_id: deal.listing_id,
              entity_type: 'deal',
              tab: 'recommended_buyers',
              buyer_id: buyerId,
            },
          },
        }),
      );
    },
    [data?.buyers, deal],
  );

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

  if (!data || data.buyers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No scored buyers for this deal yet</p>
          <p className="text-xs text-muted-foreground/60">
            Run buyer matching in Remarketing to generate recommendations.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigate(`/admin/remarketing/matching/${deal.listing_id}`)}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Match Buyers
          </Button>
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

        {/* Top 5 Pinned Panel */}
        <Top5Panel
          buyers={data.buyers}
          rejectedBuyerIds={rejectedBuyerIds}
          onReject={handleReject}
          onDraftEmail={handleDraftEmail}
          onViewProfile={handleViewProfile}
          newlyAddedIds={newlyAddedIds}
        />

        {/* Rejection History */}
        <RejectionHistory
          rejections={rejections}
          onReverse={handleReverse}
          isReversing={isReversing}
        />

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
          listingId={deal.listing_id}
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
