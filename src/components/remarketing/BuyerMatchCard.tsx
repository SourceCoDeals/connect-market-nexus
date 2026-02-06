import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
  Eye,
  MapPin,
  ChevronDown,
  FileText,
  Users,
  Globe,
  Building2,
  Landmark,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Target,
  Mail,
  Calendar,
  Phone,
} from "lucide-react";
import { ScoreTierBadge, getTierFromScore } from "./ScoreTierBadge";
import { IntelligenceBadge } from "./IntelligenceBadge";
import { OutreachStatusDialog, type OutreachStatus } from "./OutreachStatusDialog";
import type { ScoreTier, DataCompleteness, ReMarketingBuyer } from "@/types/remarketing";

interface OutreachData {
  status: OutreachStatus;
  contacted_at?: string;
  notes?: string;
}

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
    last_viewed_at?: string | null;
    buyer?: ReMarketingBuyer;
    universe?: { id: string; name: string } | null;
  };
  dealLocation?: string;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onApprove: (scoreId: string, scoreData: any) => void;
  onPass: (scoreId: string, buyerName: string, scoreData: any) => void;
  onOutreachUpdate?: (scoreId: string, status: OutreachStatus, notes: string) => Promise<void>;
  onViewed?: (scoreId: string) => void;
  outreach?: OutreachData | null;
  isPending?: boolean;
  universeName?: string; // Show universe badge when viewing "All Universes"
}

const getScoreColorClass = (score: number) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
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
// Uses specific patterns to avoid over-triggering (e.g., "size mismatch" just because reasoning mentions revenue)
const getDisqualificationReason = (reasoning: string | null, score?: any): string => {
  if (!reasoning) return 'criteria mismatch';
  const lower = reasoning.toLowerCase();

  // Check for explicit missing data flag first (highest priority)
  if (lower.includes('[missing_data:')) {
    return 'insufficient data';
  }

  // Check for explicit disqualification patterns (specific language from enforceHardRules)
  if (lower.includes('disqualified: deal revenue') || lower.includes('below buyer minimum') || lower.includes('below minimum')) {
    return 'size mismatch';
  }
  if (lower.includes('dealbreaker: deal includes excluded')) {
    return 'excluded criteria';
  }
  if (lower.includes('geography strict:') || lower.includes('not in buyer targets')) {
    return 'geography mismatch';
  }

  // Use individual scores to determine the weakest dimension (more accurate than keyword matching)
  if (score) {
    const dimensions = [
      { name: 'size mismatch', score: score.size_score ?? 100 },
      { name: 'no nearby presence', score: score.geography_score ?? 100 },
      { name: 'service mismatch', score: score.service_score ?? 100 },
      { name: 'owner goals mismatch', score: score.owner_goals_score ?? 100 },
    ];
    const weakest = dimensions.reduce((min, d) => d.score < min.score ? d : min, dimensions[0]);
    if (weakest.score < 40) {
      return weakest.name;
    }
  }

  // Fallback to keyword matching with more specific patterns
  if (lower.includes('no nearby presence') || lower.includes('no presence in') || lower.includes('distant')) {
    return 'no nearby presence';
  }
  if (lower.includes('too small') || lower.includes('too large') || lower.includes('size multiplier: ')) {
    return 'size mismatch';
  }
  if (lower.includes('no service overlap') || lower.includes('0% overlap') || lower.includes('weak service')) {
    return 'service mismatch';
  }
  return 'criteria mismatch';
};

// Calculate missing data fields (Whispers parity)
const getMissingDataFields = (buyer?: ReMarketingBuyer): string[] => {
  const missing: string[] = [];
  if (!buyer) return ['All buyer data'];
  
  // Location data
  if ((!buyer.geographic_footprint || buyer.geographic_footprint.length === 0) && !buyer.hq_state) {
    missing.push('HQ location');
  }
  if (!buyer.target_geographies || buyer.target_geographies.length === 0) {
    missing.push('Target geographies');
  }
  
  // Financial data
  if (!buyer.target_revenue_min && !buyer.target_revenue_max) {
    missing.push('Target revenue range');
  }
  
  // Thesis data
  if (!buyer.thesis_summary) {
    missing.push('Investment thesis');
  }
  if (!buyer.target_services || buyer.target_services.length === 0) {
    missing.push('Target services');
  }
  
  // Owner goals / preferences
  if (!buyer.deal_breakers?.length && !buyer.deal_preferences) {
    missing.push('Owner transition goals');
  }
  
  // Activity data
  if (!buyer.recent_acquisitions || buyer.recent_acquisitions.length === 0) {
    missing.push('Recent acquisitions');
  }
  
  // Transcript/call data
  if (!buyer.extraction_sources?.some(s => s.type === 'transcript')) {
    missing.push('Call quotes');
  }
  
  return missing;
};

// Get buyer location display (prefer HQ city/state)
const getBuyerLocationDisplay = (buyer?: ReMarketingBuyer): string => {
  if (!buyer) return 'Unknown';
  
  // Prefer HQ location if available (Whispers format: "City, ST")
  if (buyer.hq_city && buyer.hq_state) {
    return `${buyer.hq_city}, ${buyer.hq_state}`;
  }
  
  // Fall back to footprint
  if (buyer.geographic_footprint && buyer.geographic_footprint.length > 0) {
    return buyer.geographic_footprint.slice(0, 2).join(', ');
  }
  
  return 'Unknown';
};

// Get score description for tooltip
const getScoreDescription = (score: number, disqualified: boolean): string => {
  if (disqualified) return 'Does not meet minimum criteria - not recommended';
  if (score >= 70) return 'Good alignment on key criteria - strong candidate';
  if (score >= 55) return 'Partial alignment - worth considering for outreach';
  return 'Limited alignment - review carefully before proceeding';
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

// Get fit label based on score
const getFitLabel = (score: number, disqualified: boolean): string => {
  if (disqualified) return '❌ DISQUALIFIED:';
  if (score >= 70) return '✅ Strong fit:';
  if (score >= 55) return '✓ Moderate fit:';
  return '⚠ Poor fit:';
};

// Outreach status colors and labels
const getOutreachBadge = (status: OutreachStatus) => {
  const config: Record<OutreachStatus, { label: string; className: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700', icon: Mail },
    contacted: { label: 'Contacted', className: 'bg-blue-100 text-blue-700', icon: Mail },
    responded: { label: 'Responded', className: 'bg-cyan-100 text-cyan-700', icon: Mail },
    meeting_scheduled: { label: 'Meeting', className: 'bg-purple-100 text-purple-700', icon: Calendar },
    loi_sent: { label: 'LOI Sent', className: 'bg-indigo-100 text-indigo-700', icon: FileText },
    closed_won: { label: 'Won', className: 'bg-emerald-100 text-emerald-700', icon: Check },
    closed_lost: { label: 'Lost', className: 'bg-red-100 text-red-700', icon: X },
  };
  return config[status] || config.pending;
};

export const BuyerMatchCard = ({
  score,
  dealLocation,
  isSelected = false,
  onSelect,
  onApprove,
  onPass,
  onOutreachUpdate,
  onViewed,
  outreach,
  isPending = false,
  universeName,
}: BuyerMatchCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [outreachDialogOpen, setOutreachDialogOpen] = useState(false);
  
  // Track when card is expanded for the first time
  const handleExpand = (expanded: boolean) => {
    if (expanded && !isExpanded && onViewed) {
      onViewed(score.id);
    }
    setIsExpanded(expanded);
  };
  
  const buyer = score.buyer;
  const tier = score.tier || getTierFromScore(score.composite_score);
  const disqualified = isDisqualified(score.composite_score, score.fit_reasoning);
  const missingData = getMissingDataFields(buyer);
  
  // Format financial range
  const financialRange = buyer?.target_revenue_min || buyer?.target_revenue_max
    ? `${formatCurrency(buyer?.target_revenue_min) || '?'}-${formatCurrency(buyer?.target_revenue_max) || '?'}`
    : null;
  
  // Buyer footprint summary
  const buyerFootprint = buyer?.geographic_footprint?.slice(0, 3).join(', ') || 'Unknown';
  
  // Handle outreach save
  const handleOutreachSave = async (status: OutreachStatus, notes: string) => {
    if (onOutreachUpdate) {
      await onOutreachUpdate(score.id, status, notes);
    }
  };
  
  // Get outreach badge info
  const outreachBadge = outreach ? getOutreachBadge(outreach.status) : null;
  
  // Determine reasoning panel background - only this panel gets colored
  const getReasoningBackground = () => {
    if (disqualified) return 'bg-red-50 border-red-200';
    if (score.composite_score >= 70) return 'bg-emerald-50 border-emerald-200';
    if (score.composite_score >= 55) return 'bg-amber-50 border-amber-200';
    return 'bg-muted/50 border-border';
  };

  return (
    <div className={cn(
      "border rounded-lg transition-all bg-background",
      score.status === 'passed' && "opacity-60"
    )}>
      {/* Main Header Row - White background */}
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
              
              {/* Eye icon for preview */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link 
                      to={`/admin/remarketing/buyers/${buyer?.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>View buyer profile</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {buyer?.company_website && (
                <a 
                  href={buyer.company_website.startsWith('http') ? buyer.company_website : `https://${buyer.company_website}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              
              {/* Disqualified Badge - inline with name */}
              {disqualified && (
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Disqualified
                </Badge>
              )}
              
              {/* Universe Badge - when viewing all universes */}
              {(universeName || score.universe?.name) && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  <Target className="h-3 w-3 mr-1" />
                  {universeName || score.universe?.name}
                </Badge>
              )}
              
              {/* Fee Status Badge - based on actual has_fee_agreement field */}
              {(buyer as any)?.has_fee_agreement ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Fee Signed
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  No Fee
                </Badge>
              )}
            </div>
            
            {/* Row 2: Location (HQ preferred, then footprint) */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{getBuyerLocationDisplay(buyer)}</span>
            </div>
            
            {/* Row 3: Website links (Company + PE Firm) */}
            <div className="flex items-center gap-4 text-sm mb-1">
              {buyer?.company_website && (
                <a 
                  href={buyer.company_website.startsWith('http') ? buyer.company_website : `https://${buyer.company_website}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[180px]">
                    {buyer.company_website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </span>
                </a>
              )}
              
              {/* PE Firm Website (separate link if available) */}
              {(buyer as any)?.pe_firm_website && (
                <a 
                  href={(buyer as any).pe_firm_website.startsWith('http') ? (buyer as any).pe_firm_website : `https://${(buyer as any).pe_firm_website}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[180px]">
                    {(buyer as any).pe_firm_website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </span>
                </a>
              )}
            </div>
            
            {/* Row 4: PE Firm Name (if available) */}
            {(buyer as any)?.pe_firm_name && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <Landmark className="h-3.5 w-3.5" />
                <span>{(buyer as any).pe_firm_name}</span>
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
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {financialRange}
                </span>
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
                    {score.data_completeness === 'high' ? '✅ Complete Data' :
                     score.data_completeness === 'medium' ? '⚠ Partial Data' : '❌ Needs Research'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {score.data_completeness === 'high' 
                      ? 'Buyer profile has sufficient data for confident scoring'
                      : 'Some data points are missing which may affect score accuracy'}
                  </p>
                  {missingData.length > 0 && (
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
            
            {/* Intelligence Badge with missing fields */}
            <IntelligenceBadge 
              completeness={score.data_completeness} 
              missingFields={missingData}
              size="sm" 
            />
            
            {/* Score Badge with Rich Tooltip - "→Strong 77" format or "Not Eligible" */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    {disqualified ? (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                        Not Eligible
                      </Badge>
                    ) : (
                      <ScoreTierBadge 
                        tier={tier} 
                        score={score.composite_score}
                        variant="full"
                        size="sm"
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-medium">{getScoreDescription(score.composite_score, disqualified)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Score: {score.composite_score}/100</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Expand Chevron - Circular Button Style */}
            <Collapsible open={isExpanded} onOpenChange={handleExpand}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
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
                <X className="mr-1 h-3.5 w-3.5" />
                Not A Fit
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onApprove(score.id, score)}
                disabled={isPending}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Approve
              </Button>
            </>
          ) : score.status === 'approved' ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <Check className="h-3 w-3 mr-1" />
                Approved
              </Badge>
              {/* Outreach Status Badge */}
              {outreachBadge && outreach?.status !== 'pending' && (
                <Badge className={cn("border", outreachBadge.className)}>
                  <outreachBadge.icon className="h-3 w-3 mr-1" />
                  {outreachBadge.label}
                </Badge>
              )}
              {/* Track Outreach Button */}
              {onOutreachUpdate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setOutreachDialogOpen(true)}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  {outreach ? 'Update' : 'Track'}
                </Button>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <X className="h-3 w-3 mr-1" />
              Passed
              {score.pass_reason && ` - ${score.pass_category}`}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Outreach Status Dialog */}
      <OutreachStatusDialog
        open={outreachDialogOpen}
        onOpenChange={setOutreachDialogOpen}
        buyerName={buyer?.company_name || 'Unknown Buyer'}
        currentStatus={outreach?.status}
        onSave={handleOutreachSave}
      />
      
      {/* Score Breakdown Panel - Colored background based on tier */}
      <div className={cn(
        "border-t p-4",
        getReasoningBackground()
      )}>
        {/* AI Reasoning with Fit Label */}
        <p className={cn(
          "text-sm mb-4",
          disqualified ? "text-red-700" : "text-foreground"
        )}>
          {getFitLabel(score.composite_score, disqualified)} {score.fit_reasoning || 'No reasoning available'}
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
        
        {/* Disqualification Warning (repeated at bottom) */}
        {disqualified && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>Reason: {getDisqualificationReason(score.fit_reasoning, score)}</span>
          </div>
        )}
        
        {/* Expandable Thesis */}
        <Collapsible open={isExpanded} onOpenChange={handleExpand}>
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
