import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Trophy,
  X,
  Clock,
  Mail,
  Phone,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';
import { RejectionModal, type RejectionData } from './RejectionModal';

interface Top5PanelProps {
  buyers: RecommendedBuyer[];
  rejectedBuyerIds: Set<string>;
  onReject: (buyerId: string, data: RejectionData) => void;
  onDraftEmail: (buyerId: string) => void;
  onViewProfile: (buyerId: string) => void;
  newlyAddedIds?: Set<string>;
}

function TierBadge({ tier, label }: { tier: string; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium',
        tier === 'move_now'
          ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
          : tier === 'strong_candidate'
            ? 'border-amber-500/30 text-amber-600 bg-amber-500/5'
            : 'border-border/40 text-muted-foreground bg-muted/30',
      )}
    >
      {label}
    </Badge>
  );
}

function IntentTrend({ buyer }: { buyer: RecommendedBuyer }) {
  const trend = useMemo(() => {
    // Compute trend from engagement data
    // Compare recent engagement (last 30 days) vs prior 30 days
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    let recentSignals = 0;
    let priorSignals = 0;

    // Use last_engagement and call data as proxy
    if (buyer.last_engagement) {
      const engDate = new Date(buyer.last_engagement).getTime();
      if (engDate > thirtyDaysAgo) recentSignals += 2;
      else if (engDate > sixtyDaysAgo) priorSignals += 2;
    }

    if (buyer.transcript_insights.latest_call_date) {
      const callDate = new Date(buyer.transcript_insights.latest_call_date).getTime();
      if (callDate > thirtyDaysAgo) recentSignals += 1;
      else if (callDate > sixtyDaysAgo) priorSignals += 1;
    }

    if (buyer.outreach_info.meeting_scheduled) recentSignals += 1;
    if (buyer.outreach_info.cim_sent) recentSignals += 1;

    if (recentSignals > priorSignals) return 'increasing';
    if (recentSignals < priorSignals) return 'cooling';
    return 'stable';
  }, [buyer]);

  const config = {
    increasing: { icon: TrendingUp, color: 'text-emerald-500', label: 'Increasing' },
    stable: { icon: Minus, color: 'text-amber-500', label: 'Stable' },
    cooling: { icon: TrendingDown, color: 'text-muted-foreground/60', label: 'Cooling' },
  };

  const { icon: Icon, color, label } = config[trend];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('flex items-center gap-0.5', color)}>
            <Icon className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Intent trend: {label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProfileCompleteness({ buyer }: { buyer: RecommendedBuyer }) {
  const score = useMemo(() => {
    let filled = 0;
    const total = 7;
    if (buyer.acquisition_appetite) filled++;
    if (buyer.thesis_summary) filled++;
    if (buyer.total_acquisitions > 0) filled++;
    if (buyer.hq_state || buyer.hq_city) filled++;
    if (buyer.buyer_type) filled++;
    if (buyer.has_fee_agreement) filled++;
    if (buyer.composite_fit_score > 0) filled++;
    return Math.round((filled / total) * 100);
  }, [buyer]);

  if (score >= 80) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
            <AlertTriangle className="h-2.5 w-2.5" />
            {score}%
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Profile {score}% complete — score may be imprecise
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Top5Card({
  buyer,
  rank,
  isNew,
  onReject,
  onDraftEmail,
  onViewProfile,
}: {
  buyer: RecommendedBuyer;
  rank: number;
  isNew: boolean;
  onReject: (buyerId: string) => void;
  onDraftEmail: (buyerId: string) => void;
  onViewProfile: (buyerId: string) => void;
}) {
  const displayName = buyer.pe_firm_name
    ? `${buyer.company_name} (${buyer.pe_firm_name})`
    : buyer.company_name;

  const primaryReason = buyer.fit_signals[0] || buyer.fit_reasoning || 'General alignment match';

  return (
    <div className="relative p-3 border border-border/50 rounded-lg bg-card hover:border-border/80 transition-colors">
      {isNew && (
        <Badge className="absolute -top-2 right-2 text-[9px] px-1.5 py-0 bg-blue-500 text-white border-0">
          New
        </Badge>
      )}
      <div className="flex items-start gap-2.5">
        {/* Rank */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
          {rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className="text-sm font-medium text-foreground truncate max-w-[200px] cursor-pointer hover:underline"
              onClick={() => onViewProfile(buyer.buyer_id)}
            >
              {displayName}
            </p>
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums min-w-[36px]',
                buyer.composite_fit_score >= 80
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : buyer.composite_fit_score >= 60
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'bg-muted text-muted-foreground border border-border/40',
              )}
            >
              {buyer.composite_fit_score}
            </span>
            <TierBadge tier={buyer.tier} label={buyer.tier_label} />
            <IntentTrend buyer={buyer} />
            <ProfileCompleteness buyer={buyer} />
          </div>

          {/* Primary match reason */}
          <p className="text-xs text-muted-foreground line-clamp-1">{primaryReason}</p>

          {/* Engagement & signals row */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {buyer.transcript_insights.call_count > 0 && (
              <span className="flex items-center gap-0.5 text-blue-500">
                <Phone className="h-2.5 w-2.5" />
                {buyer.transcript_insights.call_count}
              </span>
            )}
            {buyer.transcript_insights.ceo_detected && (
              <span className="flex items-center gap-0.5 text-emerald-600">
                <UserCheck className="h-2.5 w-2.5" />
                CEO
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {buyer.last_engagement
                ? formatDistanceToNow(new Date(buyer.last_engagement), { addSuffix: true })
                : 'No engagement'}
            </span>
            {buyer.engagement_cold && buyer.last_engagement && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 border-orange-500/30 text-orange-500 bg-orange-500/5"
              >
                Cold
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                  onClick={() => onDraftEmail(buyer.buyer_id)}
                >
                  <Mail className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Draft Outreach</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onReject(buyer.buyer_id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject from Top 5</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

export function Top5Panel({
  buyers,
  rejectedBuyerIds,
  onReject,
  onDraftEmail,
  onViewProfile,
  newlyAddedIds,
}: Top5PanelProps) {
  const [rejectingBuyerId, setRejectingBuyerId] = useState<string | null>(null);

  // Build the Top 5 from the available pool, excluding rejected buyers
  const top5 = useMemo(() => {
    return buyers
      .filter((b) => !rejectedBuyerIds.has(b.buyer_id))
      .slice(0, 5);
  }, [buyers, rejectedBuyerIds]);

  const handleRejectClick = useCallback((buyerId: string) => {
    setRejectingBuyerId(buyerId);
  }, []);

  const handleRejectConfirm = useCallback(
    (data: RejectionData) => {
      if (rejectingBuyerId) {
        onReject(rejectingBuyerId, data);
        setRejectingBuyerId(null);
      }
    },
    [rejectingBuyerId, onReject],
  );

  const rejectingBuyer = useMemo(
    () => buyers.find((b) => b.buyer_id === rejectingBuyerId),
    [buyers, rejectingBuyerId],
  );

  if (top5.length === 0) {
    return null;
  }

  return (
    <>
      <div className="border border-primary/20 rounded-lg bg-primary/[0.02] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-primary/10">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Top 5 Recommended Buyers</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {top5.length} of 5
          </span>
        </div>

        {/* Cards */}
        <div className="p-3 space-y-2">
          {top5.map((buyer, idx) => (
            <Top5Card
              key={buyer.buyer_id}
              buyer={buyer}
              rank={idx + 1}
              isNew={newlyAddedIds?.has(buyer.buyer_id) ?? false}
              onReject={handleRejectClick}
              onDraftEmail={onDraftEmail}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>

        {/* Shortfall message */}
        {top5.length < 5 && top5.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {buyers.filter((b) => !rejectedBuyerIds.has(b.buyer_id)).length < 5
                ? 'Fewer than 5 scored buyers available for this deal'
                : 'No further recommendations available — run a new buyer match to expand the pool'}
            </p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      <RejectionModal
        open={!!rejectingBuyerId}
        onOpenChange={(open) => !open && setRejectingBuyerId(null)}
        buyerName={
          rejectingBuyer
            ? rejectingBuyer.pe_firm_name
              ? `${rejectingBuyer.company_name} (${rejectingBuyer.pe_firm_name})`
              : rejectingBuyer.company_name
            : ''
        }
        onConfirm={handleRejectConfirm}
      />
    </>
  );
}
