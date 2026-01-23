import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Check,
  X,
  ExternalLink,
  MapPin,
  ChevronDown,
  FileText,
  Users,
  Globe,
  Building2,
  AlertCircle,
} from "lucide-react";
import { ScoreTierBadge, getTierFromScore } from "./ScoreTierBadge";
import { IntelligenceBadge } from "./IntelligenceBadge";
import type { ScoreTier, DataCompleteness, ReMarketingBuyer } from "@/types/remarketing";

interface BuyerMatchCardProps {
  score: {
    id: string;
    composite_score: number;
    geography_score: number;
    size_score: number;
    service_score: number;
    owner_goals_score: number;
    tier: ScoreTier | null;
    fit_reasoning: string | null;
    data_completeness: DataCompleteness | null;
    status: string;
    pass_reason?: string | null;
    pass_category?: string | null;
    buyer?: ReMarketingBuyer;
  };
  dealLocation?: string;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onApprove: (scoreId: string, scoreData: any) => void;
  onPass: (scoreId: string, buyerName: string, scoreData: any) => void;
  isPending?: boolean;
}

const getScoreColorClass = (score: number) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
};

const getScoreDot = (score: number) => {
  if (score < 50) return <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />;
  return null;
};

// Determine if buyer is disqualified
const isDisqualified = (score: number, reasoning: string | null) => {
  if (score < 55) return true;
  if (reasoning?.toLowerCase().includes('disqualified')) return true;
  return false;
};

// Get disqualification reason from reasoning text
const getDisqualificationReason = (reasoning: string | null) => {
  if (!reasoning) return null;
  const match = reasoning.match(/disqualified[:\s]+(.+?)(?:\.|$)/i);
  return match ? match[1].trim() : null;
};

// Calculate missing data fields
const getMissingDataFields = (buyer?: ReMarketingBuyer): string[] => {
  const missing: string[] = [];
  if (!buyer) return ['All buyer data'];
  
  if (!buyer.geographic_footprint || buyer.geographic_footprint.length === 0) {
    missing.push('HQ/Footprint location');
  }
  if (!buyer.target_revenue_min && !buyer.target_revenue_max) {
    missing.push('Target revenue range');
  }
  if (!buyer.thesis_summary) {
    missing.push('Investment thesis');
  }
  if (!buyer.target_services || buyer.target_services.length === 0) {
    missing.push('Target services');
  }
  if (!buyer.recent_acquisitions || buyer.recent_acquisitions.length === 0) {
    missing.push('Recent acquisitions');
  }
  
  return missing;
};

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return null;
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(0)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
};

export const BuyerMatchCard = ({
  score,
  dealLocation,
  isSelected = false,
  onSelect,
  onApprove,
  onPass,
  isPending = false,
}: BuyerMatchCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const buyer = score.buyer;
  const tier = score.tier || getTierFromScore(score.composite_score);
  const disqualified = isDisqualified(score.composite_score, score.fit_reasoning);
  const disqualificationReason = getDisqualificationReason(score.fit_reasoning);
  const missingData = getMissingDataFields(buyer);
  
  // Format financial range
  const financialRange = buyer?.target_revenue_min || buyer?.target_revenue_max
    ? `${formatCurrency(buyer?.target_revenue_min) || '?'}-${formatCurrency(buyer?.target_revenue_max) || '?'}`
    : null;
  
  // Buyer footprint summary
  const buyerFootprint = buyer?.geographic_footprint?.slice(0, 3).join(', ') || 'Unknown';
  
  // Determine background color based on status/tier
  const getCardBackground = () => {
    if (score.status === 'passed') return 'bg-muted/30';
    if (score.status === 'approved') return 'bg-emerald-50/50 border-emerald-200';
    if (disqualified) return 'bg-red-50/50 border-red-200';
    if (score.composite_score >= 70) return 'bg-emerald-50/30 border-emerald-100';
    if (score.composite_score >= 55) return 'bg-amber-50/30 border-amber-100';
    return 'bg-background';
  };
  
  // Determine reasoning panel background
  const getReasoningBackground = () => {
    if (disqualified) return 'bg-red-50 border-red-200';
    if (score.composite_score >= 70) return 'bg-emerald-50 border-emerald-200';
    if (score.composite_score >= 55) return 'bg-amber-50 border-amber-200';
    return 'bg-muted/50 border-border';
  };

  return (
    <div className={cn(
      "border rounded-lg transition-all",
      getCardBackground(),
      score.status === 'passed' && "opacity-60"
    )}>
      {/* Main Header Row */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          {onSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(score.id, checked as boolean)}
              className="mt-1"
            />
          )}
          
          {/* Buyer Info */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Name + Links + Status Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link 
                to={`/admin/remarketing/buyers/${buyer?.id}`}
                className="font-semibold text-base hover:underline"
              >
                {buyer?.company_name || 'Unknown Buyer'}
              </Link>
              
              {buyer?.company_website && (
                <a 
                  href={buyer.company_website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              
              {/* Fee Status Badge - placeholder for now */}
              {/* <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Fee Signed
              </span> */}
            </div>
            
            {/* Row 2: Location */}
            {buyer?.geographic_footprint && buyer.geographic_footprint.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{buyer.geographic_footprint.slice(0, 3).join(', ')}</span>
                {buyer.geographic_footprint.length > 3 && (
                  <span className="text-xs">+{buyer.geographic_footprint.length - 3} more</span>
                )}
              </div>
            )}
            
            {/* Row 3: Website links */}
            <div className="flex items-center gap-3 text-sm mb-1">
              {buyer?.company_website && (
                <a 
                  href={buyer.company_website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </a>
              )}
            </div>
            
            {/* Row 4: Buyer Type / PE Firm */}
            {buyer?.buyer_type && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <Building2 className="h-3.5 w-3.5" />
                <span className="capitalize">{buyer.buyer_type.replace('_', ' ')}</span>
              </div>
            )}
            
            {/* Row 5: Thesis Summary (truncated) */}
            {buyer?.thesis_summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {buyer.thesis_summary}
              </p>
            )}
            
            {/* Row 6: Financial Range + Contacts */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {financialRange && (
                <span className="font-medium">{financialRange}</span>
              )}
              {buyer?.contacts && buyer.contacts.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {buyer.contacts.length} contacts
                </span>
              )}
            </div>
          </div>
          
          {/* Right Side: Data + Score + Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Data Completeness Icon with Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 rounded hover:bg-muted">
                    <FileText className={cn(
                      "h-4 w-4",
                      score.data_completeness === 'high' ? "text-emerald-500" :
                      score.data_completeness === 'medium' ? "text-amber-500" : "text-muted-foreground"
                    )} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-medium mb-1">
                    {score.data_completeness === 'high' ? '✓ Complete Data' :
                     score.data_completeness === 'medium' ? '⚠ Partial Data' : '✗ Incomplete Data'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {score.data_completeness === 'high' 
                      ? 'Buyer profile has sufficient data for confident scoring'
                      : 'Some data points are missing which may affect score accuracy'}
                  </p>
                  {missingData.length > 0 && score.data_completeness !== 'high' && (
                    <div>
                      <p className="text-xs font-medium mb-1">Missing data:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {missingData.map((field, i) => (
                          <li key={i}>• {field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Intelligence Badge */}
            <IntelligenceBadge completeness={score.data_completeness} size="sm" />
            
            {/* Score Badge */}
            {disqualified ? (
              <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded">
                Not Eligible
              </span>
            ) : (
              <ScoreTierBadge tier={tier} size="md" />
            )}
            
            {/* Expand Chevron */}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    isExpanded && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-2">
          {score.status === 'pending' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => onPass(score.id, buyer?.company_name || 'Unknown', score)}
                disabled={isPending}
              >
                Not A Fit
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onApprove(score.id, score)}
                disabled={isPending}
              >
                <Check className="mr-1 h-4 w-4" />
                Approve
              </Button>
            </>
          ) : score.status === 'approved' ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" />
              Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <X className="h-4 w-4" />
              Passed
              {score.pass_reason && ` - ${score.pass_category}`}
            </span>
          )}
        </div>
      </div>
      
      {/* Score Breakdown Panel */}
      <div className={cn(
        "border-t p-4",
        getReasoningBackground()
      )}>
        {/* Disqualification Warning */}
        {disqualified && disqualificationReason && (
          <div className="flex items-start gap-2 text-red-700 mb-3">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">
              DISQUALIFIED: {disqualificationReason}
            </p>
          </div>
        )}
        
        {/* AI Reasoning */}
        <p className={cn(
          "text-sm mb-4",
          disqualified ? "text-red-700" : "text-foreground"
        )}>
          {disqualified ? '❌ ' : score.composite_score >= 70 ? '✅ ' : '✓ '}
          {score.fit_reasoning || 'No reasoning available'}
        </p>
        
        {/* Inline Score Breakdown */}
        <div className="grid grid-cols-4 gap-4 mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Size</p>
            <p className={cn("text-lg font-bold", getScoreColorClass(score.size_score))}>
              {getScoreDot(score.size_score)}{Math.round(score.size_score)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Geography</p>
            <p className={cn("text-lg font-bold", getScoreColorClass(score.geography_score))}>
              {getScoreDot(score.geography_score)}{Math.round(score.geography_score)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Services</p>
            <p className={cn("text-lg font-bold", getScoreColorClass(score.service_score))}>
              {getScoreDot(score.service_score)}{Math.round(score.service_score)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Owner Goals</p>
            <p className={cn("text-lg font-bold", getScoreColorClass(score.owner_goals_score))}>
              {getScoreDot(score.owner_goals_score)}{Math.round(score.owner_goals_score)}%
            </p>
          </div>
        </div>
        
        {/* Buyer Footprint Context */}
        <p className="text-xs text-muted-foreground">
          Buyer footprint: {buyerFootprint} → Deal: {dealLocation || 'Unknown'}
        </p>
        
        {/* Expandable Thesis */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="pt-4">
            {buyer?.thesis_summary && (
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Investment Thesis</p>
                <p className="text-sm italic text-muted-foreground">
                  "{buyer.thesis_summary}"
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default BuyerMatchCard;
