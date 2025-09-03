import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';

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

  // Calculate days in stage
  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Determine priority and urgency indicators
  const isOverdue = deal.followup_overdue;
  const isStale = daysInStage > 14;
  const isHotDeal = deal.buyer_priority_score && deal.buyer_priority_score >= 80;

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative mb-3 cursor-pointer transition-all duration-200 hover:shadow-md border-l-4",
        isDragging && "rotate-2 shadow-lg scale-105",
        isOverdue && "border-l-destructive bg-destructive/5",
        isStale && "border-l-warning bg-warning/5",
        isHotDeal && "border-l-status-signed bg-status-signed/5",
        !isOverdue && !isStale && !isHotDeal && "border-l-border"
      )}
      onClick={() => !isDragging && onDealClick(deal)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with buyer type and priority indicators */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Badge 
              variant="outline" 
              className={cn("text-xs font-medium", getBuyerTypeColor(deal.buyer_type))}
            >
              {getBuyerTypeLabel(deal.buyer_type)}
            </Badge>
            {isHotDeal && (
              <Badge variant="outline" className="text-xs bg-status-signed/20 text-status-signed-foreground border-status-signed-border">
                Hot
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {deal.deal_probability}%
          </div>
        </div>

        {/* Deal Title */}
        <div>
          <h4 className="font-medium text-sm leading-tight">{deal.deal_title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{deal.listing_title}</p>
        </div>

        {/* Buyer Information */}
        <div className="flex items-center space-x-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-muted">
              {deal.buyer_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UN'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{deal.buyer_name || 'Unknown Buyer'}</p>
            <p className="text-xs text-muted-foreground truncate">{deal.buyer_company}</p>
          </div>
        </div>

        {/* Document Status - Prominent Display */}
        <div className="flex space-x-2">
          <Badge 
            variant="outline" 
            className={cn("text-xs px-2 py-1 font-medium", getStatusColor(deal.nda_status))}
          >
            NDA
          </Badge>
          <Badge 
            variant="outline" 
            className={cn("text-xs px-2 py-1 font-medium", getStatusColor(deal.fee_agreement_status))}
          >
            Fee Agreement
          </Badge>
        </div>

        {/* Time in Stage & Key Metrics */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{daysInStage}</span> days in stage
          </div>
          {deal.pending_tasks > 0 && (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              <span>{deal.pending_tasks} tasks</span>
            </div>
          )}
        </div>

        {/* Urgency Indicators */}
        {isOverdue && (
          <div className="absolute top-2 right-2">
            <Badge variant="destructive" className="text-xs animate-pulse">
              Overdue
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}