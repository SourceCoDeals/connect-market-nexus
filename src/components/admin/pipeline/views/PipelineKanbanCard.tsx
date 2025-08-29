import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { GripVertical, Phone, Mail } from 'lucide-react';

interface PipelineKanbanCardProps {
  deal: Deal;
  onClick: () => void;
  isSelected: boolean;
}

export const PipelineKanbanCard: React.FC<PipelineKanbanCardProps> = ({
  deal,
  onClick,
  isSelected
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.deal_id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-warning text-warning-foreground';
      case 'medium': return 'bg-info text-info-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 cursor-pointer transition-all duration-200 hover:shadow-md border-border/50",
        isDragging && "opacity-50 rotate-2",
        isSelected && "ring-2 ring-primary border-primary/50"
      )}
      onClick={onClick}
      {...attributes}
    >
      {/* Drag Handle */}
      <div 
        className="flex items-center gap-2 mb-3"
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{deal.deal_title}</h4>
          {deal.listing_id && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {deal.listing_title}
            </p>
          )}
        </div>
        <Badge variant="outline" className={cn("text-xs", getPriorityColor(deal.deal_priority))}>
          {deal.deal_priority}
        </Badge>
      </div>

      {/* Contact Info */}
      <div className="flex items-center gap-2 mb-3">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">
            {(deal.contact_name || deal.buyer_name)?.split(' ').map(n => n[0]).join('') || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{deal.contact_name || deal.buyer_name}</p>
          {(deal.contact_company || deal.buyer_company) && (
            <p className="text-xs text-muted-foreground truncate">
              {deal.contact_company || deal.buyer_company}
            </p>
          )}
        </div>
      </div>

      {/* Deal Value */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{formatCurrency(deal.deal_value || 0)}</span>
        <span className="text-xs text-muted-foreground">{deal.deal_probability || 0}%</span>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex gap-1">
          {deal.nda_status === 'signed' && (
            <Badge variant="secondary" className="text-xs px-1 py-0">NDA</Badge>
          )}
          {deal.fee_agreement_status === 'signed' && (
            <Badge variant="secondary" className="text-xs px-1 py-0">Fee</Badge>
          )}
        </div>
        
        <div className="text-muted-foreground">
          {new Date(deal.deal_created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Next Follow-up */}
      {deal.next_followup_due && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Follow-up: {new Date(deal.next_followup_due).toLocaleDateString()}
          </p>
        </div>
      )}
    </Card>
  );
};