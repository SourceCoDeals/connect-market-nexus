
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Deal } from '@/hooks/admin/use-deals';

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
    isDragging: isDragActive,
  } = useDraggable({
    id: deal.deal_id,
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragActive ? 1000 : 'auto',
  } : undefined;
  
  const getBuyerTypeColor = (buyerType?: string) => {
    switch (buyerType?.toLowerCase()) {
      case 'private_equity':
      case 'pe':
        return 'bg-green-500 text-white';
      case 'strategic':
        return 'bg-purple-500 text-white';
      case 'individual':
        return 'bg-yellow-600 text-white';
      case 'search_fund':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType?.toLowerCase()) {
      case 'private_equity':
      case 'pe':
        return 'PE';
      case 'strategic':
        return 'Strategic';
      case 'individual':
        return 'Individual';
      case 'search_fund':
        return 'Search Fund';
      default:
        return 'Other';
    }
  };

  const getStatusColor = (status: string, type: 'nda' | 'fee') => {
    const baseColor = type === 'nda' ? 'blue' : 'purple';
    switch (status) {
      case 'signed':
        return `bg-green-500 text-white`;
      case 'sent':
        return `bg-${baseColor}-500 text-white`;
      case 'not_sent':
      default:
        return 'bg-gray-300 text-gray-600';
    }
  };

  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / 
    (1000 * 60 * 60 * 24)
  );

  const isOverdue = deal.next_followup_due && new Date(deal.next_followup_due) < new Date();
  const isStale = daysInStage > 14;
  
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        cursor-pointer transition-all duration-200 select-none border-border/50 hover:border-border
        ${isDragging || isDragActive 
          ? 'opacity-80 shadow-lg scale-[1.02] rotate-1 z-50 border-primary/20' 
          : 'hover:shadow-sm'
        }
        ${isOverdue ? 'border-red-200 bg-red-50/30' : 'bg-card'}
      `}
      onClick={() => !isDragActive && onDealClick(deal)}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header: Deal Title + Buyer Type */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground text-sm leading-tight mb-1 line-clamp-2">
              {deal.deal_title}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {deal.listing_title}
            </p>
          </div>
          
          {/* Buyer Type Badge */}
          <Badge 
            className={`text-xs px-2 py-0.5 font-medium ${getBuyerTypeColor(deal.buyer_type)}`}
            variant="secondary"
          >
            {getBuyerTypeLabel(deal.buyer_type)}
          </Badge>
        </div>
        
        {/* Contact Info */}
        {deal.contact_name && (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs bg-muted-foreground/10 text-muted-foreground">
                {deal.contact_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {deal.contact_name}
              </p>
              {deal.contact_company && (
                <p className="text-xs text-muted-foreground truncate">
                  {deal.contact_company}
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Document Status - Prominent */}
        <div className="flex items-center gap-2">
          <Badge 
            className={`text-xs px-2 py-1 font-medium rounded-md ${getStatusColor(deal.nda_status, 'nda')}`}
            variant="outline"
          >
            NDA {deal.nda_status === 'signed' ? '✓' : deal.nda_status === 'sent' ? '→' : '○'}
          </Badge>
          <Badge 
            className={`text-xs px-2 py-1 font-medium rounded-md ${getStatusColor(deal.fee_agreement_status, 'fee')}`}
            variant="outline"
          >
            Fee {deal.fee_agreement_status === 'signed' ? '✓' : deal.fee_agreement_status === 'sent' ? '→' : '○'}
          </Badge>
        </div>
        
        {/* Time in Stage + Tasks */}
        <div className="flex items-center justify-between pt-1">
          <div className={`text-xs font-medium ${isStale ? 'text-orange-600' : 'text-muted-foreground'}`}>
            {daysInStage}d in stage
          </div>
          
          {deal.pending_tasks > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-xs">
              {deal.pending_tasks} tasks
            </Badge>
          )}
        </div>
        
        {/* Overdue Warning */}
        {isOverdue && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1 -mx-1">
            <div className="w-1 h-1 rounded-full bg-red-500" />
            <span>Overdue follow-up</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
