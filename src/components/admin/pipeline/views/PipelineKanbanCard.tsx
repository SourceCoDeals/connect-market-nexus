import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar, 
  DollarSign, 
  User, 
  Building2, 
  Clock,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { formatDistanceToNow } from 'date-fns';

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
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="h-3 w-3" />;
      case 'high': return <Clock className="h-3 w-3" />;
      default: return null;
    }
  };
  
  const getDocumentStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'text-green-600 bg-green-100';
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'declined': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };
  
  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / 
    (1000 * 60 * 60 * 24)
  );
  
  const isOverdue = deal.next_followup_due && new Date(deal.next_followup_due) < new Date();
  
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md border-border/50
        ${isDragging || isDragActive ? 'opacity-50 rotate-2 shadow-lg' : 'hover:border-primary/50'}
        ${isOverdue ? 'border-red-200 bg-red-50/50' : 'bg-background/80'}
        backdrop-blur-sm
      `}
      onClick={() => onDealClick(deal)}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground line-clamp-2 mb-1">
              {deal.deal_title}
            </h4>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{deal.listing_title}</span>
            </div>
          </div>
          
          {/* Priority Badge */}
          {(deal.deal_priority === 'high' || deal.deal_priority === 'urgent') && (
            <Badge className={`${getPriorityColor(deal.deal_priority)} h-5 px-1.5 text-xs`}>
              {getPriorityIcon(deal.deal_priority)}
            </Badge>
          )}
        </div>
        
        {/* Deal Value & Probability */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
            <DollarSign className="h-3 w-3" />
            {formatCurrency(deal.deal_value)}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{deal.deal_probability}% prob</span>
          </div>
        </div>
        
        {/* Contact Info */}
        {deal.contact_name && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-muted">
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
        
        {/* Status Indicators */}
        <div className="flex items-center gap-1 flex-wrap">
          {deal.nda_status === 'signed' && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs bg-green-50 text-green-700 border-green-200">
              NDA ✓
            </Badge>
          )}
          {deal.fee_agreement_status === 'signed' && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs bg-blue-50 text-blue-700 border-blue-200">
              Fee ✓
            </Badge>
          )}
          {deal.pending_tasks > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs bg-orange-50 text-orange-700 border-orange-200">
              {deal.pending_tasks} tasks
            </Badge>
          )}
        </div>
        
        {/* Timeline Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{daysInStage} days in stage</span>
          </div>
          
          {deal.deal_expected_close_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(deal.deal_expected_close_date), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
        
        {/* Overdue Indicator */}
        {isOverdue && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
            <AlertCircle className="h-3 w-3" />
            <span>Follow-up overdue</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}