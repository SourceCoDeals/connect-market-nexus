import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
        "group relative mb-3 cursor-pointer transition-all duration-200 hover:shadow-sm border-l-4 bg-card",
        isDragging && "rotate-1 shadow-lg scale-[1.02]",
        isOverdue && "border-l-destructive bg-destructive/5",
        isStale && "border-l-warning bg-warning/5", 
        isHotDeal && "border-l-status-signed bg-status-signed/5",
        !isOverdue && !isStale && !isHotDeal && "border-l-muted-foreground/20"
      )}
      onClick={() => !isDragging && onDealClick(deal)}
    >
      <CardContent className="p-5 space-y-4">
        {/* Phase 2: Visual Hierarchy - Primary Info */}
        <div className="space-y-3">
          {/* Company Name - Primary Focus */}
          <div>
            <h3 className="font-semibold text-lg leading-tight text-foreground tracking-tight">
              {deal.buyer_company || deal.listing_title || 'Unknown Company'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              {deal.buyer_name || 'Unknown Contact'}
            </p>
          </div>

          {/* Buyer Type Badge - Prominent for Quick Assessment */}
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={cn("text-sm font-semibold px-4 py-1.5 rounded-full", getBuyerTypeColor(deal.buyer_type))}
            >
              {getBuyerTypeLabel(deal.buyer_type)}
            </Badge>
            {isHotDeal && (
              <Badge variant="outline" className="text-xs px-3 py-1 bg-status-signed/20 text-status-signed-foreground border-status-signed-border rounded-full font-medium">
                🔥 Hot
              </Badge>
            )}
          </div>
        </div>

        {/* Phase 2: Secondary Info - Time in Stage (Large & Prominent) */}
        <div className={cn(
          "bg-muted/40 rounded-xl p-4 text-center border",
          isStale && "bg-warning/10 border-warning/30",
          isOverdue && "bg-destructive/10 border-destructive/30"
        )}>
          <div className="text-3xl font-bold text-foreground mb-1">{daysInStage}</div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">days in stage</div>
        </div>

        {/* Phase 2: Status Row - Essential Document Status */}
        <div className="flex gap-3">
          <Badge 
            variant="outline" 
            className={cn("flex-1 justify-center text-xs py-2 font-semibold rounded-lg", getStatusColor(deal.nda_status))}
          >
            NDA
          </Badge>
          <Badge 
            variant="outline" 
            className={cn("flex-1 justify-center text-xs py-2 font-semibold rounded-lg", getStatusColor(deal.fee_agreement_status))}
          >
            Fee
          </Badge>
        </div>

        {/* Phase 3: Minimal Task Indicator */}
        {deal.pending_tasks > 0 && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg py-2 px-3">
            <CheckCircle className="h-3.5 w-3.5" />
            <span className="font-medium">{deal.pending_tasks} tasks</span>
          </div>
        )}

        {/* Phase 3: Clean Urgency Indicator */}
        {isOverdue && (
          <div className="absolute -top-1 -right-1">
            <div className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full shadow-sm animate-pulse font-medium">
              Overdue
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}