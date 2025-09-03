import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Edit, CheckCircle2, Clock, User, Calendar, MessageCircle } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PipelineKanbanCardProps {
  deal: Deal;
  onDealClick: (deal: Deal) => void;
  isDragging?: boolean;
}

export function PipelineKanbanCard({ deal, onDealClick, isDragging }: PipelineKanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: deal.deal_id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  // Helper functions for colors and labels - Using semantic design tokens
  const getBuyerTypeColor = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'bg-[hsl(var(--buyer-pe))] text-[hsl(var(--buyer-pe-foreground))] border-[hsl(var(--buyer-pe-border))] border';
      case 'familyOffice':
        return 'bg-[hsl(var(--buyer-family))] text-[hsl(var(--buyer-family-foreground))] border-[hsl(var(--buyer-family-border))] border';
      case 'searchFund':
        return 'bg-[hsl(var(--buyer-search))] text-[hsl(var(--buyer-search-foreground))] border-[hsl(var(--buyer-search-border))] border';
      case 'corporate':
        return 'bg-[hsl(var(--buyer-corporate))] text-[hsl(var(--buyer-corporate-foreground))] border-[hsl(var(--buyer-corporate-border))] border';
      case 'individual':
        return 'bg-[hsl(var(--buyer-individual))] text-[hsl(var(--buyer-individual-foreground))] border-[hsl(var(--buyer-individual-border))] border';
      case 'independentSponsor':
        return 'bg-[hsl(var(--buyer-sponsor))] text-[hsl(var(--buyer-sponsor-foreground))] border-[hsl(var(--buyer-sponsor-border))] border';
      default:
        return 'bg-[hsl(var(--buyer-individual))] text-[hsl(var(--buyer-individual-foreground))] border-[hsl(var(--buyer-individual-border))] border';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'Private Equity';
      case 'familyOffice':
        return 'Family Office';
      case 'searchFund':
        return 'Search Fund';
      case 'corporate':
        return 'Strategic';
      case 'individual':
        return 'Individual';
      case 'independentSponsor':
        return 'Independent Sponsor';
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
          bg: 'bg-[hsl(var(--status-signed))]',
          text: 'text-[hsl(var(--status-signed-foreground))]'
        };
      case 'sent':
        return { 
          color: 'bg-[hsl(var(--status-sent-border))]', 
          label: 'Sent',
          bg: 'bg-[hsl(var(--status-sent))]',
          text: 'text-[hsl(var(--status-sent-foreground))]'
        };
      case 'declined':
        return { 
          color: 'bg-[hsl(var(--status-declined-border))]', 
          label: 'Declined',
          bg: 'bg-[hsl(var(--status-declined))]',
          text: 'text-[hsl(var(--status-declined-foreground))]'
        };
      default:
        return { 
          color: 'bg-[hsl(var(--status-pending-border))]', 
          label: 'Pending',
          bg: 'bg-[hsl(var(--status-pending))]',
          text: 'text-[hsl(var(--status-pending-foreground))]'
        };
    }
  };

  // Enhanced Buyer Priority Logic - Simplified and cleaner
  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', color: 'text-emerald-600', dot: 'bg-emerald-500' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', color: 'text-amber-600', dot: 'bg-amber-500' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', color: 'text-emerald-600', dot: 'bg-emerald-500' };
        if (score && score >= 40) return { level: 'Medium', color: 'text-amber-600', dot: 'bg-amber-500' };
        return { level: 'Standard', color: 'text-slate-500', dot: 'bg-slate-400' };
      default:
        return { level: 'Standard', color: 'text-slate-500', dot: 'bg-slate-400' };
    }
  };

  // Task calculation using real task data
  const getTaskInfo = () => {
    const total = deal.total_tasks || 0;
    const completed = deal.completed_tasks || 0;
    const pending = deal.pending_tasks || 0;
    
    // If no tasks exist, show realistic task count
    if (total === 0) {
      return { completed: 0, total: 0, pending: 0, hasAnyTasks: false };
    }
    
    return { completed, total, pending, hasAnyTasks: true };
  };

  // Calculate meaningful data
  const taskInfo = getTaskInfo();
  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);
  const ndaStatus = getStatusIndicator(deal.nda_status);
  const feeStatus = getStatusIndicator(deal.fee_agreement_status);

  // Key information display - prioritize listing title and buyer company
  const listingTitle = deal.listing_title || 'Business Acquisition Opportunity';
  const buyerCompany = deal.buyer_company || deal.contact_company || 'Private Investor';
  const contactName = deal.buyer_name || deal.contact_name || 'Unknown Contact';

  // Revenue context for deal sizing
  const listingRevenue = deal.listing_revenue ? `$${(deal.listing_revenue / 1000000).toFixed(1)}M Revenue` : null;

  // Calculate days in stage
  const daysInStage = deal.deal_stage_entered_at 
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Calculate last contact
  const lastContactDate = deal.followed_up_at || deal.deal_created_at;
  const lastContactText = lastContactDate 
    ? formatDistanceToNow(new Date(lastContactDate), { addSuffix: true })
    : 'No contact';

  // Determine next action based on deal status
  const getNextAction = () => {
    if (deal.nda_status === 'not_sent') return 'Send NDA';
    if (deal.nda_status === 'sent' && deal.fee_agreement_status === 'not_sent') return 'Follow up NDA';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'not_sent') return 'Send Fee Agreement';
    if (deal.fee_agreement_status === 'sent') return 'Follow up Fee Agreement';
    if (deal.fee_agreement_status === 'signed') return 'Schedule Meeting';
    return 'Contact Buyer';
  };

  const nextAction = getNextAction();

  // Quick action handlers
  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement email functionality
    console.log('Email clicked for deal:', deal.deal_id);
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement phone functionality
    console.log('Phone clicked for deal:', deal.deal_id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDealClick(deal);
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative mb-3 cursor-pointer transition-all duration-200 ease-out",
        "bg-card border border-border/40 hover:border-border",
        "hover:shadow-sm hover:-translate-y-px",
        isDragging && "rotate-1 shadow-md scale-[1.01] z-50 border-border",
        buyerPriority.level === 'High' && "ring-1 ring-emerald-200/30"
      )}
      onClick={() => !isDragging && onDealClick(deal)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        {/* Header with priority indicator */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium text-foreground leading-tight mb-1 truncate">
              {listingTitle}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {buyerCompany}
            </p>
          </div>
          <div className={cn("w-2 h-2 rounded-full ml-2 mt-1 flex-shrink-0", buyerPriority.dot)} />
        </div>

        {/* Contact and Type */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground truncate">{contactName}</span>
          </div>
          <Badge className={cn("text-xs px-2 py-0.5 font-medium rounded-md flex-shrink-0", getBuyerTypeColor(deal.buyer_type))}>
            {getBuyerTypeLabel(deal.buyer_type)}
          </Badge>
        </div>

        {/* Revenue */}
        {listingRevenue && (
          <p className="text-sm text-muted-foreground mb-3">{listingRevenue}</p>
        )}

        {/* Document Status - Minimal dots */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", ndaStatus.color)} />
            <span className="text-xs text-muted-foreground">NDA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", feeStatus.color)} />
            <span className="text-xs text-muted-foreground">Fee</span>
          </div>
        </div>

        {/* Tasks */}
        {taskInfo.hasAnyTasks && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">
                {taskInfo.completed}/{taskInfo.total}
              </span>
              <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${taskInfo.total > 0 ? (taskInfo.completed / taskInfo.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom row - Days, Last Contact, Next Action */}
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground border-t border-border/30 pt-3">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span className="truncate">{daysInStage}d</span>
          </div>
          <div className="flex items-center gap-1 justify-center">
            <Clock className="w-3 h-3" />
            <span className="truncate">{lastContactText.replace(' ago', '')}</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <MessageCircle className="w-3 h-3" />
            <span className="truncate">{nextAction}</span>
          </div>
        </div>

        {/* Quick Actions on Hover */}
        {isHovered && !isDragging && (
          <div className="absolute top-3 right-3 flex gap-1 bg-card/95 backdrop-blur-sm rounded-md shadow-sm border border-border/50 p-1">
            <button
              onClick={handleEmailClick}
              className="p-1.5 rounded hover:bg-accent transition-colors duration-150"
              title="Send Email"
            >
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={handlePhoneClick}
              className="p-1.5 rounded hover:bg-accent transition-colors duration-150"
              title="Call"
            >
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={handleEditClick}
              className="p-1.5 rounded hover:bg-accent transition-colors duration-150"
              title="Edit Deal"
            >
              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}