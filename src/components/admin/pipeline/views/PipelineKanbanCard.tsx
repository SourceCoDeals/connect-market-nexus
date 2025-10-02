import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Edit, CheckSquare, Clock, Building2, Calendar, FileCheck, FileX, User } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';

interface PipelineKanbanCardProps {
  deal: Deal;
  onDealClick: (deal: Deal) => void;
  isDragging?: boolean;
}

export function PipelineKanbanCard({ deal, onDealClick, isDragging }: PipelineKanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const logContact = useLogDealContact();
  
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

// Apple/Stripe-style design helpers - Clean, minimal approach
  // Apple/Stripe-style design helpers - Clean, minimal approach
  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !Number.isNaN(time);
  };
  const getBuyerTypeColor = (buyerType?: string) => {
    if (!buyerType) return 'bg-[hsl(var(--buyer-individual))] text-[hsl(var(--buyer-individual-foreground))] border-[hsl(var(--buyer-individual-border))]';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 'bg-[hsl(var(--buyer-pe))] text-[hsl(var(--buyer-pe-foreground))] border-[hsl(var(--buyer-pe-border))]';
      case 'familyoffice':
        return 'bg-[hsl(var(--buyer-family))] text-[hsl(var(--buyer-family-foreground))] border-[hsl(var(--buyer-family-border))]';
      case 'searchfund':
        return 'bg-[hsl(var(--buyer-search))] text-[hsl(var(--buyer-search-foreground))] border-[hsl(var(--buyer-search-border))]';
      case 'corporate':
        return 'bg-[hsl(var(--buyer-corporate))] text-[hsl(var(--buyer-corporate-foreground))] border-[hsl(var(--buyer-corporate-border))]';
      case 'individual':
        return 'bg-[hsl(var(--buyer-individual))] text-[hsl(var(--buyer-individual-foreground))] border-[hsl(var(--buyer-individual-border))]';
      case 'independentsponsor':
        return 'bg-[hsl(var(--buyer-sponsor))] text-[hsl(var(--buyer-sponsor-foreground))] border-[hsl(var(--buyer-sponsor-border))]';
      default:
        return 'bg-[hsl(var(--buyer-individual))] text-[hsl(var(--buyer-individual-foreground))] border-[hsl(var(--buyer-individual-border))]';
    }
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
          color: 'bg-[hsl(var(--status-signed-border))]', 
          label: 'Signed',
          textColor: 'text-[hsl(var(--status-signed-foreground))]'
        };
      case 'sent':
        return { 
          color: 'bg-[hsl(var(--status-sent-border))]', 
          label: 'Sent',
          textColor: 'text-[hsl(var(--status-sent-foreground))]'
        };
      case 'declined':
        return { 
          color: 'bg-[hsl(var(--status-declined-border))]', 
          label: 'Declined',
          textColor: 'text-[hsl(var(--status-declined-foreground))]'
        };
      default:
        return { 
          color: 'bg-[hsl(var(--status-pending-border))]', 
          label: 'Not Sent',
          textColor: 'text-[hsl(var(--status-pending-foreground))]'
        };
    }
  };

  // Enhanced Buyer Priority Logic - Clean priority system
  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', dot: 'bg-[hsl(var(--status-signed-border))]' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', dot: 'bg-[hsl(var(--status-sent-border))]' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', dot: 'bg-[hsl(var(--status-signed-border))]' };
        if (score && score >= 40) return { level: 'Medium', dot: 'bg-[hsl(var(--status-sent-border))]' };
        return { level: 'Standard', dot: 'bg-[hsl(var(--status-pending-border))]' };
      default:
        return { level: 'Standard', dot: 'bg-[hsl(var(--status-pending-border))]' };
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

  // Quick action handlers with real contact logging
  const handleEmailClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
        contactType: 'email',
        details: { recipient: deal.contact_email || deal.buyer_email }
      });
    } catch (error) {
      console.error('Failed to log email contact:', error);
    }
  };

  const handlePhoneClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
        contactType: 'phone',
        details: { phone: deal.contact_phone }
      });
    } catch (error) {
      console.error('Failed to log phone contact:', error);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[Pipeline Card] Edit button clicked', {
      dealId: deal.deal_id,
      title: deal.deal_title,
      contact: deal.contact_name
    });
    onDealClick(deal);
  };

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
        "group relative mb-3 cursor-pointer transition-all duration-300 ease-out",
        "bg-white/95 backdrop-blur-sm border border-border/40 rounded-lg shadow-sm",
        "hover:shadow-md hover:shadow-black/5 hover:border-border hover:-translate-y-0.5",
        "hover:bg-white hover:backdrop-blur-md",
        isBeingDragged && "shadow-lg shadow-black/10 scale-[1.02] z-50 border-[hsl(var(--sourceco-primary))] bg-white/95 opacity-90",
        buyerPriority.level === 'High' && "ring-1 ring-[hsl(var(--status-signed-border))]/20",
        buyerPriority.level === 'Medium' && "ring-1 ring-[hsl(var(--status-sent-border))]/20"
      )}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4 space-y-3">
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
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                    {companyDealCount} active
                  </Badge>
                )}
              </div>
              <Badge className={cn("text-[10px] px-2 py-0.5 font-semibold border", getBuyerTypeColor(actualBuyerType))}>
                {getBuyerTypeLabel(actualBuyerType)}
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

        {/* Document Status - Clean Apple/Stripe design */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', 
              deal.nda_status === 'signed' ? 'bg-[hsl(var(--status-signed-border))]' :
              deal.nda_status === 'sent' ? 'bg-[hsl(var(--status-sent-border))]' : 'bg-[hsl(var(--status-pending-border))]'
            )} />
            <span className="text-muted-foreground">NDA:</span>
            <span className={cn('font-medium',
              deal.nda_status === 'signed' ? 'text-[hsl(var(--status-signed-foreground))]' :
              deal.nda_status === 'sent' ? 'text-[hsl(var(--status-sent-foreground))]' : 'text-[hsl(var(--status-pending-foreground))]'
            )}>
              {ndaStatus.label}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full',
              deal.fee_agreement_status === 'signed' ? 'bg-[hsl(var(--status-signed-border))]' :
              deal.fee_agreement_status === 'sent' ? 'bg-[hsl(var(--status-sent-border))]' : 'bg-[hsl(var(--status-pending-border))]'
            )} />
            <span className="text-muted-foreground">Fee:</span>
            <span className={cn('font-medium',
              deal.fee_agreement_status === 'signed' ? 'text-[hsl(var(--status-signed-foreground))]' :
              deal.fee_agreement_status === 'sent' ? 'text-[hsl(var(--status-sent-foreground))]' : 'text-[hsl(var(--status-pending-foreground))]'
            )}>
              {feeStatus.label}
            </span>
          </div>
        </div>

        {/* Task Progress - Only show if there are actual tasks */}
        {taskInfo.hasAnyTasks && (
          <div className="flex items-center gap-1.5 text-xs">
            <CheckSquare className={cn(
              'h-3 w-3',
              taskInfo.pending === 0 ? 'text-gray-700' : 'text-gray-400'
            )} />
            <span className={cn('font-medium',
              taskInfo.pending === 0 ? 'text-gray-700' : 'text-gray-500'
            )}>
              {taskInfo.pending === 0 ? `${taskInfo.total} tasks completed` : 
               `${taskInfo.pending}/${taskInfo.total} tasks pending`}
            </span>
          </div>
        )}

        {/* Next Action & Last Activity */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--sourceco-primary))]" />
            <span className="text-muted-foreground">Next:</span>
            <span className="font-medium text-foreground">{nextAction}</span>
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
            lastContactInfo.isOverdue && 'text-amber-600',
            lastContactInfo.context === 'contact_needed' && 'text-slate-500'
          )}>
            {lastContactInfo.text}
          </span>
        </div>

        {/* Premium Quick Actions on Hover */}
        {isHovered && !isBeingDragged && (
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button
              onClick={handleEmailClick}
              disabled={logContact.isPending}
              className="h-7 w-7 p-0 bg-white border border-border rounded-md shadow-sm hover:shadow-md flex items-center justify-center transition-all duration-200 hover:bg-[hsl(var(--sourceco-muted))]"
              title="Send Email"
            >
              <Mail className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={handlePhoneClick}
              disabled={logContact.isPending}
              className="h-7 w-7 p-0 bg-white border border-border rounded-md shadow-sm hover:shadow-md flex items-center justify-center transition-all duration-200 hover:bg-[hsl(var(--sourceco-muted))]"
              title="Log Call"
            >
              <Phone className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={handleEditClick}
              className="h-7 w-7 p-0 bg-white border border-border rounded-md shadow-sm hover:shadow-md flex items-center justify-center transition-all duration-200 hover:bg-[hsl(var(--sourceco-muted))]"
              title="View Details"
            >
              <Edit className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}