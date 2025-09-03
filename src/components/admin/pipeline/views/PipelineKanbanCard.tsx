
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
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: value >= 100000 ? 'compact' : 'standard',
    }).format(value);
  };
  
  const getPriorityDotColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };
  
  const getBuyerPriorityStars = (score: number) => {
    if (score >= 80) return 5;
    if (score >= 60) return 4;
    if (score >= 40) return 3;
    if (score >= 20) return 2;
    return 1;
  };
  
  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  
  const isOverdue = deal.next_followup_due && new Date(deal.next_followup_due) < new Date();
  const stars = getBuyerPriorityStars(deal.buyer_priority_score || 0);
  
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
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground text-sm leading-tight mb-1 line-clamp-2">
              {deal.deal_title}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {deal.listing_title}
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Priority Dot */}
            <div className={`w-2 h-2 rounded-full ${getPriorityDotColor(deal.deal_priority)}`} />
            
            {/* Buyer Priority Stars */}
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-1 rounded-full ${
                    i < stars ? 'bg-amber-400' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Contact Info */}
        {deal.contact_name && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-muted-foreground/10 text-muted-foreground">
                {deal.contact_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
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
        
        {/* Deal Value & Probability */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-lg font-semibold text-foreground">
            {formatCurrency(deal.deal_value)}
          </div>
          <div className="text-sm text-muted-foreground">
            {deal.deal_probability}% likelihood
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            {deal.nda_status === 'signed' && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="NDA Signed" />
            )}
            {deal.fee_agreement_status === 'signed' && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Fee Agreement Signed" />
            )}
            {deal.pending_tasks > 0 && (
              <Badge variant="secondary" className="h-5 px-2 text-xs">
                {deal.pending_tasks} tasks
              </Badge>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            {daysInStage}d in stage
          </div>
        </div>
        
        {/* Overdue Warning */}
        {isOverdue && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded-md px-2 py-1 -mx-1">
            <div className="w-1 h-1 rounded-full bg-red-500" />
            <span>Overdue follow-up</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
