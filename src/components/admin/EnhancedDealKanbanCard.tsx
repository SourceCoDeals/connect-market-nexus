import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  AlertTriangle,
  User,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';

interface EnhancedDealKanbanCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
}

export function EnhancedDealKanbanCard({ deal, isDragging, onClick }: EnhancedDealKanbanCardProps) {
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

  const getBuyerTypeColor = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': return 'bg-primary text-primary-foreground border-primary/20';
      case 'familyOffice': return 'bg-blue-500 text-white border-blue-200';
      case 'searchFund': return 'bg-indigo-500 text-white border-indigo-200';
      case 'corporate': return 'bg-green-500 text-white border-green-200';
      case 'independentSponsor': return 'bg-orange-500 text-white border-orange-200';
      case 'individual': return 'bg-gray-500 text-white border-gray-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDocumentStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-green-500 text-white border-green-300';
      case 'sent': return 'bg-amber-500 text-white border-amber-300';
      case 'declined': return 'bg-red-500 text-white border-red-300';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTimeInStageColor = (daysInStage: number) => {
    if (daysInStage <= 3) return 'text-green-600 dark:text-green-400';
    if (daysInStage <= 7) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getDaysInStage = () => {
    return Math.ceil((Date.now() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 ${
        isDragging 
          ? 'shadow-xl border-primary/60 bg-background/95 backdrop-blur-sm scale-105' 
          : 'border-border/20 hover:border-primary/40 hover:bg-accent/30'
      }`}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with Company and Time in Stage */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground line-clamp-1 leading-tight">
              {deal.buyer_company || deal.contact_company || deal.buyer_name || deal.contact_name || 'Unknown Company'}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {deal.contact_name || deal.buyer_name}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {/* Time in Stage - Prominent */}
            <div className={`text-sm font-bold ${getTimeInStageColor(getDaysInStage())}`}>
              {getDaysInStage()}d
            </div>
            {/* Buyer Type Badge */}
            {deal.buyer_type && (
              <Badge className={`text-xs px-1.5 py-0.5 font-semibold ${getBuyerTypeColor(deal.buyer_type)}`}>
                {deal.buyer_type === 'privateEquity' ? 'PE' : 
                 deal.buyer_type === 'familyOffice' ? 'FO' :
                 deal.buyer_type === 'searchFund' ? 'SF' :
                 deal.buyer_type === 'corporate' ? 'Corp' :
                 deal.buyer_type === 'independentSponsor' ? 'IS' :
                 deal.buyer_type === 'individual' ? 'IND' :
                 deal.buyer_type}
              </Badge>
            )}
          </div>
        </div>

        {/* Document Status - Prominent and Clean */}
        <div className="flex items-center justify-center gap-2">
          <Badge className={`text-xs px-2 py-1 font-medium ${getDocumentStatusColor(deal.nda_status)}`}>
            NDA
          </Badge>
          <Badge className={`text-xs px-2 py-1 font-medium ${getDocumentStatusColor(deal.fee_agreement_status)}`}>
            Fee
          </Badge>
        </div>

        {/* Tasks and Activities - Clean Row */}
        {(deal.total_tasks > 0 || deal.activity_count > 0) && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            {deal.total_tasks > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {deal.completed_tasks}/{deal.total_tasks}
              </span>
            )}
            {deal.activity_count > 0 && (
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {deal.activity_count}
              </span>
            )}
          </div>
        )}

        {/* Footer - Follow-up and Admin */}
        {(deal.next_followup_due || deal.followup_overdue || deal.assigned_admin_name) && (
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border/20">
            {/* Follow-up due date indicator */}
            {deal.next_followup_due && (
              <div className={`flex items-center gap-1 ${deal.followup_overdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(deal.next_followup_due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
            
            {/* Overdue follow-up warning */}
            {deal.followup_overdue && !deal.followed_up && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400 font-medium">Overdue</span>
              </div>
            )}
            
            {deal.assigned_admin_name && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[80px]">
                  {deal.assigned_admin_name.split(' ')[0]}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}