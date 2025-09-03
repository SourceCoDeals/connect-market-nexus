import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Mail, Phone, Edit } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';

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

  // Helper functions for colors and labels
  const getBuyerTypeColor = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'bg-buyer-pe text-buyer-pe-foreground border-buyer-pe-border';
      case 'familyOffice':
        return 'bg-buyer-family text-buyer-family-foreground border-buyer-family-border';
      case 'searchFund':
        return 'bg-buyer-search text-buyer-search-foreground border-buyer-search-border';
      case 'corporate':
        return 'bg-buyer-corporate text-buyer-corporate-foreground border-buyer-corporate-border';
      case 'individual':
        return 'bg-buyer-individual text-buyer-individual-foreground border-buyer-individual-border';
      case 'independentSponsor':
        return 'bg-buyer-sponsor text-buyer-sponsor-foreground border-buyer-sponsor-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'PE';
      case 'familyOffice':
        return 'Family Office';
      case 'searchFund':
        return 'Search Fund';
      case 'corporate':
        return 'Corporate';
      case 'individual':
        return 'Individual';
      case 'independentSponsor':
        return 'Ind. Sponsor';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-status-signed text-status-signed-foreground border-status-signed-border';
      case 'sent':
        return 'bg-status-sent text-status-sent-foreground border-status-sent-border';
      case 'declined':
        return 'bg-status-declined text-status-declined-foreground border-status-declined-border';
      default:
        return 'bg-status-pending text-status-pending-foreground border-status-pending-border';
    }
  };

  // Phase 3: Enhanced Buyer Priority Logic
  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
        return { level: 'High', color: 'bg-status-signed text-status-signed-foreground border-status-signed-border' };
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', color: 'bg-status-signed text-status-signed-foreground border-status-signed-border' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', color: 'bg-status-sent text-status-sent-foreground border-status-sent-border' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', color: 'bg-status-signed text-status-signed-foreground border-status-signed-border' };
        if (score && score >= 40) return { level: 'Medium', color: 'bg-status-sent text-status-sent-foreground border-status-sent-border' };
        return { level: 'Low', color: 'bg-status-pending text-status-pending-foreground border-status-pending-border' };
      default:
        return { level: 'Low', color: 'bg-status-pending text-status-pending-foreground border-status-pending-border' };
    }
  };

  // Phase 2: Deal Momentum Indicators
  const getDaysSinceLastContact = () => {
    if (deal.followed_up_at) {
      return Math.floor((new Date().getTime() - new Date(deal.followed_up_at).getTime()) / (1000 * 60 * 60 * 24));
    }
    return Math.floor((new Date().getTime() - new Date(deal.deal_created_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getNextAction = () => {
    if (deal.nda_status === 'not_sent') return 'Send NDA';
    if (deal.nda_status === 'sent') return 'Follow up on NDA';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'not_sent') return 'Send Fee Agreement';
    if (deal.fee_agreement_status === 'sent') return 'Follow up on Fee Agreement';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed') return 'Schedule DD call';
    return 'Follow up';
  };

  // Calculate days in stage
  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysSinceLastContact = getDaysSinceLastContact();
  const nextAction = getNextAction();
  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);

  // Phase 1: Fix company name priority - buyer_company first, then contact_company, avoid listing_title
  const companyName = deal.buyer_company || deal.contact_company || 'Unknown Company';
  const contactName = deal.buyer_name || deal.contact_name || 'Unknown Contact';

  // Determine priority and urgency indicators
  const isOverdue = deal.followup_overdue;
  const isStale = daysInStage > 14;
  const isUrgent = daysSinceLastContact > 7;

  // Phase 4: Quick action handlers
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
        "group relative mb-3 cursor-pointer transition-all duration-300 hover:shadow-md border-l-4 bg-card",
        isDragging && "rotate-1 shadow-lg scale-[1.02]",
        isOverdue && "border-l-destructive bg-destructive/5",
        isStale && "border-l-warning bg-warning/5", 
        buyerPriority.level === 'High' && "border-l-status-signed bg-status-signed/5",
        !isOverdue && !isStale && buyerPriority.level !== 'High' && "border-l-muted-foreground/20"
      )}
      onClick={() => !isDragging && onDealClick(deal)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Phase 1: Primary Info - Company Name and Contact */}
        <div className="space-y-2">
          <div>
            <h3 className="font-semibold text-base leading-tight text-foreground tracking-tight">
              {companyName}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {contactName}
            </p>
          </div>

          {/* Buyer Type and Priority */}
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={cn("text-xs font-semibold px-3 py-1 rounded-full", getBuyerTypeColor(deal.buyer_type))}
            >
              {getBuyerTypeLabel(deal.buyer_type)}
            </Badge>
            <Badge 
              variant="outline" 
              className={cn("text-xs px-2 py-1 rounded-full font-medium", buyerPriority.color)}
            >
              {buyerPriority.level}
            </Badge>
          </div>
        </div>

        {/* Phase 1: Time in Stage - Prominent Display */}
        <div className={cn(
          "bg-muted/40 rounded-lg p-3 text-center border transition-colors",
          isStale && "bg-warning/10 border-warning/30",
          isOverdue && "bg-destructive/10 border-destructive/30"
        )}>
          <div className="text-2xl font-bold text-foreground mb-0.5">{daysInStage}</div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">days in stage</div>
        </div>

        {/* Phase 1: Document Status - NDA/Fee Agreement */}
        <div className="flex gap-2">
          <Badge 
            variant="outline" 
            className={cn("flex-1 justify-center text-xs py-1.5 font-semibold rounded-md", getStatusColor(deal.nda_status))}
          >
            NDA
          </Badge>
          <Badge 
            variant="outline" 
            className={cn("flex-1 justify-center text-xs py-1.5 font-semibold rounded-md", getStatusColor(deal.fee_agreement_status))}
          >
            Fee
          </Badge>
        </div>

        {/* Phase 2: Deal Momentum Indicators */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Last Contact:</span>
            <span className={cn(
              "font-medium",
              isUrgent ? "text-warning" : "text-foreground"
            )}>
              {daysSinceLastContact} days ago
            </span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Next Action: </span>
            <span className="font-medium text-foreground">{nextAction}</span>
          </div>
        </div>

        {/* Phase 3: Task Indicator */}
        {deal.pending_tasks > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground bg-muted/20 rounded-md py-1.5 px-2">
            <CheckCircle className="h-3 w-3" />
            <span className="font-medium">{deal.pending_tasks} tasks</span>
          </div>
        )}

        {/* Phase 4: Interactive Quick Actions on Hover */}
        {isHovered && !isDragging && (
          <div className="absolute top-2 right-2 flex gap-1 bg-background/90 backdrop-blur-sm rounded-md border shadow-sm p-1">
            <button
              onClick={handleEmailClick}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Send Email"
            >
              <Mail className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
            <button
              onClick={handlePhoneClick}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Call"
            >
              <Phone className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
            <button
              onClick={handleEditClick}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Edit Deal"
            >
              <Edit className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}

        {/* Urgency Indicator */}
        {isOverdue && (
          <div className="absolute -top-1 -right-1">
            <div className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full shadow-sm animate-pulse font-medium">
              Overdue
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}