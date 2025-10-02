import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Clock, Building2, User, Globe, FileText, Zap } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';
import { useDealStages } from '@/hooks/admin/use-deals';

interface PipelineKanbanCardProps {
  deal: Deal;
  onDealClick: (deal: Deal) => void;
  isDragging?: boolean;
}

export function PipelineKanbanCard({ deal, onDealClick, isDragging }: PipelineKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: `deal:${deal.deal_id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const isBeingDragged = isDragging || isSortableDragging;
  const { data: stages } = useDealStages(true); // Include closed stages to get total count

// Apple/Stripe-style design helpers - Clean, minimal approach
  // Apple/Stripe-style design helpers - Clean, minimal approach
  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !Number.isNaN(time);
  };
  const getBuyerTypeColor = (buyerType?: string) => {
    // Uniform styling for all buyer types - clean and minimal
    return 'bg-muted/50 text-muted-foreground border-border/50';
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    if (!buyerType) return 'Individual';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 'PE';
      case 'familyoffice':
        return 'Family Office';
      case 'searchfund':
        return 'Search Fund';
      case 'corporate':
        return 'Corporate';
      case 'individual':
        return 'Individual';
      case 'independentsponsor':
        return 'Ind. Sponsor';
      default:
        return 'Individual';
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'signed':
        return { 
          color: 'bg-secondary', 
          label: 'Signed',
          textColor: 'text-secondary-foreground'
        };
      case 'sent':
        return { 
          color: 'bg-accent', 
          label: 'Sent',
          textColor: 'text-accent-foreground'
        };
      case 'declined':
        return { 
          color: 'bg-destructive/60', 
          label: 'Declined',
          textColor: 'text-destructive-foreground'
        };
      default:
        return { 
          color: 'bg-muted', 
          label: 'Not Sent',
          textColor: 'text-muted-foreground'
        };
    }
  };

  // Enhanced Buyer Priority Logic - Clean priority system
  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', dot: 'bg-primary' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', dot: 'bg-accent' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', dot: 'bg-primary' };
        if (score && score >= 40) return { level: 'Medium', dot: 'bg-accent' };
        return { level: 'Standard', dot: 'bg-muted-foreground' };
      default:
        return { level: 'Standard', dot: 'bg-muted-foreground' };
    }
  };

  // Fix buyer type detection - use actual buyer_type from profiles
  const actualBuyerType = deal.buyer_type;

  // Task calculation using real task data only
  const getTaskInfo = () => {
    // Only show task info if we actually have task data from the database
    const total = deal.total_tasks;
    const completed = deal.completed_tasks;
    
    // If no task data or total is 0/null, don't show any task info
    if (!total || total === 0) {
      return { completed: 0, total: 0, pending: 0, hasAnyTasks: false };
    }
    
    const pending = total - (completed || 0);
    return { completed: completed || 0, total, pending, hasAnyTasks: true };
  };

  // Calculate meaningful data
  const taskInfo = getTaskInfo();
  const buyerPriority = getBuyerPriority(actualBuyerType, deal.buyer_priority_score);
  const ndaStatus = getStatusIndicator(deal.nda_status);
  const feeStatus = getStatusIndicator(deal.fee_agreement_status);
  const assignedAdmin = useAdminProfile(deal.assigned_to);
  // Key information display - Clean data extraction
  const listingTitle = deal.listing_title || 'Business Acquisition Opportunity';
  
  // Only use real listing company name (admin-only internal name), show nothing if missing
  const companyName = (deal.listing_real_company_name || '').trim();
  const contactName = deal.contact_name || deal.buyer_name || 'Unknown Contact';
  const companyDealCount = deal.company_deal_count || 0;

  // Calculate time in stage precisely (seconds/minutes/hours/days)
  const { daysInStage, stageDurationLabel } = (() => {
    const invalid = !deal.deal_stage_entered_at || !isValidDate(deal.deal_stage_entered_at);
    if (invalid) {
      return { daysInStage: 0, stageDurationLabel: '-' };
    }
    const entered = new Date(deal.deal_stage_entered_at).getTime();
    const diffMs = Math.max(0, Date.now() - entered);
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    let label: string;
    if (minutes < 1) label = 'just now';
    else if (minutes < 60) label = `${minutes}m`;
    else if (hours < 24) label = `${hours}h`;
    else label = `${days}d`;

    return { daysInStage: days, stageDurationLabel: label };
  })();
  
  const daysInStageText = `${stageDurationLabel} in ${deal.stage_name || 'Stage'}`;

  // Enhanced last contact logic with real context
  const getLastContactInfo = () => {
    const lastContactDate = deal.last_contact_at || deal.followed_up_at;
    
    if (!lastContactDate || !isValidDate(lastContactDate)) {
      return {
        text: 'No contact yet',
        isOverdue: daysInStage > 3,
        context: 'contact_needed'
      };
    }
    
    const daysSinceContact = Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      text: formatDistanceToNow(new Date(lastContactDate), { addSuffix: true }),
      isOverdue: daysSinceContact > 7,
      context: 'contacted'
    };
  };

  const lastContactInfo = getLastContactInfo();

  // Smart next action based on document status and contact history
  const getNextAction = () => {
    if (deal.nda_status === 'not_sent') return 'Send NDA';
    if (deal.nda_status === 'sent' && deal.fee_agreement_status === 'not_sent') return 'Follow up NDA';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'not_sent') return 'Send Fee Agreement';
    if (deal.fee_agreement_status === 'sent') return 'Follow up Fee Agreement';
    if (deal.fee_agreement_status === 'signed') return 'Schedule Meeting';
    if (lastContactInfo.isOverdue) return 'Follow up';
    return 'Continue engagement';
  };

  const nextAction = getNextAction();

  // Last activity tracking
  const getLastActivity = () => {
    if (deal.last_contact_at && isValidDate(deal.last_contact_at)) {
      return `Contact: ${formatDistanceToNow(new Date(deal.last_contact_at), { addSuffix: true })}`;
    }
    if (deal.followed_up_at && isValidDate(deal.followed_up_at)) {
      return `Follow-up: ${formatDistanceToNow(new Date(deal.followed_up_at), { addSuffix: true })}`;
    }
    if (deal.deal_created_at && isValidDate(deal.deal_created_at)) {
      return `Created: ${formatDistanceToNow(new Date(deal.deal_created_at), { addSuffix: true })}`;
    }
    return 'Recently created';
  };

  const lastActivity = getLastActivity();

  // Calculate progression bar - current stage position out of 12 total stages
  const getProgressionData = () => {
    if (!stages) return { current: 0, total: 12, percentage: 0 };
    
    // We have 12 stages total: 10 active stages (positions 0-9) + Closed Won (10) + Closed Lost (11)
    const activeStages = stages.filter(s => s.stage_type === 'active');
    const totalStages = activeStages.length + 2; // +2 for closed won/lost (should be 12)
    
    // Find current stage and get its position
    const currentStage = activeStages.find(s => s.id === deal.stage_id);
    
    // Check if it's a closed stage
    const closedStage = stages.find(s => s.id === deal.stage_id && s.stage_type !== 'active');
    
    let currentPosition = 0;
    if (currentStage) {
      currentPosition = currentStage.position + 1; // +1 because positions are 0-indexed
    } else if (closedStage) {
      // If it's Closed Won or Closed Lost, use their positions
      currentPosition = closedStage.position + 1;
    }
    
    return {
      current: currentPosition,
      total: totalStages,
      percentage: totalStages > 0 ? (currentPosition / totalStages) * 100 : 0
    };
  };

  const progression = getProgressionData();

  // Get source badge info
  const getSourceBadge = () => {
    const source = deal.source || 'manual';
    switch (source) {
      case 'marketplace':
        return { icon: Globe, label: 'Marketplace', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' };
      case 'webflow':
        return { icon: FileText, label: 'Webflow', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' };
      case 'manual':
        return { icon: Zap, label: 'Manual', color: 'bg-orange-500/10 text-orange-700 border-orange-500/20' };
      default:
        return { icon: Globe, label: source, color: 'bg-muted/50 text-muted-foreground border-border/50' };
    }
  };

  const sourceBadge = getSourceBadge();
  const SourceIcon = sourceBadge.icon;

  const handleCardClick = () => {
    if (isBeingDragged) {
      console.log('[Pipeline Card] Click ignored - card is being dragged');
      return;
    }
    console.log('[Pipeline Card] Card clicked - FULL DEAL OBJECT:', deal);
    console.log('[Pipeline Card] Card clicked properties check:', {
      has_deal_id: 'deal_id' in deal,
      has_id: 'id' in deal,
      actual_deal_id: deal.deal_id,
      actual_id: (deal as any).id,
      deal_title: deal.deal_title,
      listing_title: deal.listing_title,
      contact: deal.contact_name,
      company: deal.contact_company
    });
    onDealClick(deal);
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative mb-3 cursor-pointer transition-all duration-200",
        "bg-card border border-border rounded-xl shadow-sm",
        "hover:shadow-lg hover:border-border/80 hover:-translate-y-0.5",
        isBeingDragged && "shadow-2xl shadow-black/10 scale-[1.02] z-50 border-primary/30 bg-card opacity-95"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Progression Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-medium">Stage {progression.current} of {progression.total}</span>
            <span className="font-medium">{Math.round(progression.percentage)}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 rounded-full"
              style={{ width: `${progression.percentage}%` }}
            />
          </div>
        </div>

        {/* Header with priority indicator and clean typography */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-sm font-medium text-gray-900 leading-tight truncate">
              {companyName ? `${companyName} / ${listingTitle}` : listingTitle}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-700 truncate">{companyName}</span>
                {companyDealCount > 1 && (
                  <Badge className="text-[10px] px-2 py-0.5 h-4 bg-primary/10 text-primary border border-primary/30 font-bold shadow-sm">
                    {companyDealCount} active
                  </Badge>
                )}
              </div>
              <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold border", getBuyerTypeColor(actualBuyerType))}>
                {getBuyerTypeLabel(actualBuyerType)}
              </Badge>
              <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold border flex items-center gap-1", sourceBadge.color)}>
                <SourceIcon className="w-2.5 h-2.5" />
                {sourceBadge.label}
              </Badge>
            </div>
          </div>
          <div className={cn("w-2 h-2 rounded-full ml-3 mt-0.5 flex-shrink-0", buyerPriority.dot)} />
        </div>

        {/* Contact person */}
        <div className="text-xs text-gray-600">
          Contact: {contactName}
        </div>
        {/* Deal Owner */}
        {assignedAdmin && (
          <div className="text-xs text-gray-600 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span>Owner: {assignedAdmin.displayName}</span>
          </div>
        )}

        {/* Document Status - Clean design with brand colors */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', ndaStatus.color)} />
            <span className="text-muted-foreground">NDA:</span>
            <span className={cn('font-medium', ndaStatus.textColor)}>
              {ndaStatus.label}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', feeStatus.color)} />
            <span className="text-muted-foreground">Fee:</span>
            <span className={cn('font-medium', feeStatus.textColor)}>
              {feeStatus.label}
            </span>
          </div>
        </div>

        {/* Task Progress - Only show if there are actual tasks */}
        {taskInfo.hasAnyTasks && (
          <div className="flex items-center gap-1.5 text-xs">
            <CheckSquare className={cn(
              'h-3 w-3',
              taskInfo.pending === 0 ? 'text-foreground' : 'text-muted-foreground'
            )} />
            <span className={cn('font-medium',
              taskInfo.pending === 0 ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {taskInfo.pending === 0 ? `${taskInfo.total} tasks completed` : 
               `${taskInfo.pending}/${taskInfo.total} tasks pending`}
            </span>
          </div>
        )}

        {/* Next Action & Last Activity */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            <span className="text-muted-foreground">Next:</span>
            <span className="font-medium text-primary">{nextAction}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground truncate">{lastActivity}</span>
          </div>
        </div>

        {/* Bottom metadata row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/5">
          <span className="font-medium text-foreground/80">
            {daysInStageText}
          </span>
          <span className={cn(
            'truncate font-medium',
            lastContactInfo.isOverdue && 'text-accent-foreground',
            lastContactInfo.context === 'contact_needed' && 'text-muted-foreground'
          )}>
            {lastContactInfo.text}
          </span>
        </div>

      </CardContent>
    </Card>
  );
}