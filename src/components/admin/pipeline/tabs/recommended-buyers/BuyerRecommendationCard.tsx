import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  MapPin,
  FileCheck,
  Clock,
  Mail,
  ChevronDown,
  ChevronUp,
  Phone,
  UserCheck,
  Shield,
  FileText,
  CalendarCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { RecommendedBuyer } from '@/hooks/admin/use-recommended-buyers';

interface BuyerRecommendationCardProps {
  buyer: RecommendedBuyer;
  rank: number;
  onDraftEmail?: (buyerId: string) => void;
  onViewProfile?: (buyerId: string) => void;
  onReject?: (buyerId: string, buyerName: string) => void;
}

const BUYER_TYPE_LABELS: Record<string, string> = {
  pe_firm: 'PE Firm',
  pe_platform: 'PE Platform',
  platform: 'Platform',
  strategic: 'Strategic',
  family_office: 'Family Office',
  independent_sponsor: 'Independent Sponsor',
  search_fund: 'Search Fund',
  other: 'Other',
};

function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums min-w-[44px]',
        score >= 80
          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
          : score >= 60
            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
            : 'bg-muted text-muted-foreground border border-border/40',
      )}
    >
      {score}
    </div>
  );
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

export function BuyerRecommendationCard({
  buyer,
  rank,
  onDraftEmail,
  onViewProfile,
  onReject,
}: BuyerRecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const displayName = buyer.pe_firm_name
    ? `${buyer.company_name} (${buyer.pe_firm_name})`
    : buyer.company_name;

  const hqDisplay = [buyer.hq_city, buyer.hq_state].filter(Boolean).join(', ');
  const typeLabel = BUYER_TYPE_LABELS[buyer.buyer_type || ''] || buyer.buyer_type || 'Buyer';

  return (
    <div className="p-4 border border-border/40 rounded-lg hover:border-border/60 transition-colors space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="text-xs font-mono text-muted-foreground/60 mt-0.5 w-5 text-right flex-shrink-0">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate max-w-[300px]">
              {displayName}
            </p>
            <ScoreBadge score={buyer.composite_fit_score} />
            <TierBadge tier={buyer.tier} label={buyer.tier_label} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{typeLabel}</span>
            {hqDisplay && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {hqDisplay}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fit signals */}
      {buyer.fit_signals.length > 0 && (
        <div className="flex items-center gap-1.5 pl-8 flex-wrap">
          {buyer.fit_signals.map((signal, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/30"
            >
              {signal}
            </span>
          ))}
        </div>
      )}

      {/* Status row */}
      <div className="flex items-center gap-4 pl-8 text-xs text-muted-foreground flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <FileCheck
                  className={cn(
                    'h-3 w-3',
                    buyer.has_fee_agreement ? 'text-emerald-500' : 'text-muted-foreground/40',
                  )}
                />
                {buyer.has_fee_agreement ? 'Signed' : 'No Fee Agmt'}
              </span>
            </TooltipTrigger>
            <TooltipContent>Fee Agreement Status</TooltipContent>
          </Tooltip>

          {/* Transcript call count */}
          {buyer.transcript_insights.call_count > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-blue-500">
                  <Phone className="h-3 w-3" />
                  {buyer.transcript_insights.call_count} call
                  {buyer.transcript_insights.call_count !== 1 ? 's' : ''}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {buyer.transcript_insights.call_count} recorded call
                {buyer.transcript_insights.call_count !== 1 ? 's' : ''}
                {buyer.transcript_insights.latest_call_date &&
                  ` · Last: ${new Date(buyer.transcript_insights.latest_call_date).toLocaleDateString()}`}
              </TooltipContent>
            </Tooltip>
          )}

          {/* CEO detection */}
          {buyer.transcript_insights.ceo_detected && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-emerald-600">
                  <UserCheck className="h-3 w-3" />
                  CEO
                </span>
              </TooltipTrigger>
              <TooltipContent>CEO/owner participated in call</TooltipContent>
            </Tooltip>
          )}

          {/* Outreach funnel indicators */}
          {buyer.outreach_info.nda_signed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-emerald-600">
                  <Shield className="h-3 w-3" />
                  NDA
                </span>
              </TooltipTrigger>
              <TooltipContent>NDA executed</TooltipContent>
            </Tooltip>
          )}
          {buyer.outreach_info.cim_sent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-blue-600">
                  <FileText className="h-3 w-3" />
                  CIM
                </span>
              </TooltipTrigger>
              <TooltipContent>CIM sent to buyer</TooltipContent>
            </Tooltip>
          )}
          {buyer.outreach_info.meeting_scheduled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-violet-600">
                  <CalendarCheck className="h-3 w-3" />
                  Meeting
                </span>
              </TooltipTrigger>
              <TooltipContent>Meeting scheduled</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>

        <span className="text-muted-foreground/30">|</span>

        <span className="flex items-center gap-1">
          <Clock
            className={cn(
              'h-3 w-3',
              buyer.engagement_cold ? 'text-muted-foreground/40' : 'text-blue-500',
            )}
          />
          {buyer.last_engagement
            ? formatDistanceToNow(new Date(buyer.last_engagement), { addSuffix: true })
            : 'No engagement'}
        </span>

        {buyer.engagement_cold && buyer.last_engagement && (
          <Badge
            variant="outline"
            className="text-[10px] border-orange-500/30 text-orange-500 bg-orange-500/5"
          >
            Cold
          </Badge>
        )}
      </div>

      {/* Actions & expand */}
      <div className="flex items-center justify-between pl-8">
        <div className="flex items-center gap-2">
          {onDraftEmail && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onDraftEmail(buyer.buyer_id)}
            >
              <Mail className="h-3 w-3 mr-1" />
              Draft Outreach
            </Button>
          )}
          {onReject && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => onReject(buyer.buyer_id, buyer.company_name)}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Reject
            </Button>
          )}
          {onViewProfile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onViewProfile(buyer.buyer_id)}
            >
              View Profile
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="pl-8 pt-2 border-t border-border/30 space-y-3">
          {/* Score breakdown */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Geography</span>
              <div className="font-medium mt-0.5">{buyer.geography_score}/100</div>
            </div>
            <div>
              <span className="text-muted-foreground">Size Fit</span>
              <div className="font-medium mt-0.5">{buyer.size_score}/100</div>
            </div>
            <div>
              <span className="text-muted-foreground">Service</span>
              <div className="font-medium mt-0.5">{buyer.service_score}/100</div>
            </div>
            <div>
              <span className="text-muted-foreground">Owner Goals</span>
              <div className="font-medium mt-0.5">{buyer.owner_goals_score}/100</div>
            </div>
          </div>

          {/* Outreach funnel progress */}
          {buyer.outreach_info.contacted && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">Outreach Funnel:</span>
              <div className="flex items-center gap-1 mt-1">
                {[
                  { done: buyer.outreach_info.contacted, label: 'Contacted' },
                  { done: buyer.outreach_info.nda_signed, label: 'NDA Signed' },
                  { done: buyer.outreach_info.cim_sent, label: 'CIM Sent' },
                  { done: buyer.outreach_info.meeting_scheduled, label: 'Meeting' },
                ].map((step, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && (
                      <span
                        className={cn('w-3 h-px', step.done ? 'bg-emerald-500' : 'bg-border')}
                      />
                    )}
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px]',
                        step.done
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-muted/30 text-muted-foreground/50 border border-border/30',
                      )}
                    >
                      {step.label}
                    </span>
                  </span>
                ))}
                {buyer.outreach_info.outcome && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    {buyer.outreach_info.outcome}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Transcript insights */}
          {buyer.transcript_insights.call_count > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">Call Activity:</span>
              <span className="ml-1.5">
                {buyer.transcript_insights.call_count} call
                {buyer.transcript_insights.call_count !== 1 ? 's' : ''}
                {buyer.transcript_insights.ceo_detected && ' · CEO/owner participated'}
                {buyer.transcript_insights.latest_call_date &&
                  ` · Last call ${formatDistanceToNow(new Date(buyer.transcript_insights.latest_call_date), { addSuffix: true })}`}
              </span>
            </div>
          )}

          {buyer.fit_reasoning && (
            <p className="text-xs text-muted-foreground leading-relaxed">{buyer.fit_reasoning}</p>
          )}
          {buyer.thesis_summary && (
            <p className="text-xs text-muted-foreground/70 leading-relaxed italic">
              Thesis: {buyer.thesis_summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
