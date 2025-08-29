import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  DollarSign, 
  User, 
  Building, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  MessageSquare,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

interface DealKanbanCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
}

export function DealKanbanCard({ deal, isDragging, onClick }: DealKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: deal.deal_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
      case 'medium': return 'bg-secondary text-secondary-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed': return <CheckCircle className="h-3 w-3 text-success" />;
      case 'sent': return <MessageSquare className="h-3 w-3 text-warning" />;
      case 'declined': return <AlertCircle className="h-3 w-3 text-destructive" />;
      default: return null;
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-pointer transition-all duration-200 border-0 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:scale-105",
        "hover:bg-card/90 group",
        isDragging && 'opacity-50 rotate-3 scale-105 shadow-xl'
      )}
      onClick={onClick}
    >
      <CardContent className="p-5 space-y-4">
        {/* Header with title and priority */}
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold text-sm leading-tight line-clamp-2 flex-1 group-hover:text-primary transition-colors duration-200">
            {deal.deal_title}
          </h4>
          <Badge 
            className={cn(
              "ml-2 shadow-sm border-0 font-medium transition-all duration-200 group-hover:scale-105",
              getPriorityColor(deal.deal_priority)
            )}
          >
            {deal.deal_priority}
          </Badge>
        </div>

        {/* Contact and Company Info */}
        <div className="space-y-1">
          {deal.contact_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{deal.contact_name}</span>
            </div>
          )}
          {deal.contact_company && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building className="h-3 w-3" />
              <span className="truncate">{deal.contact_company}</span>
            </div>
          )}
        </div>

        {/* Deal Value and Probability */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{formatCurrency(deal.deal_value)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {deal.deal_probability}% probability
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">NDA:</span>
            {getStatusIcon(deal.nda_status)}
            <span className="text-xs capitalize">{deal.nda_status.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Fee:</span>
            {getStatusIcon(deal.fee_agreement_status)}
            <span className="text-xs capitalize">{deal.fee_agreement_status.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Tasks and Activity Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {deal.pending_tasks > 0 && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{deal.pending_tasks} tasks</span>
              </div>
            )}
            {deal.activity_count > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{deal.activity_count}</span>
              </div>
            )}
          </div>
          
          {deal.deal_expected_close_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(deal.deal_expected_close_date), 'MMM dd')}</span>
            </div>
          )}
        </div>

        {/* Assigned Admin */}
        {deal.assigned_admin_name && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs">
                {deal.assigned_admin_name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {deal.assigned_admin_name}
            </span>
          </div>
        )}

        {/* Time in stage */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            In stage {Math.ceil((Date.now() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))} days
          </span>
        </div>
      </CardContent>
    </Card>
  );
}