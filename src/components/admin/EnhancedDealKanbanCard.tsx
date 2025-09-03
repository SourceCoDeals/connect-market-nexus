import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Building2, 
  DollarSign, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  FileText,
  Activity,
  ShieldCheck,
  FileCheck,
  Star,
  Target
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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

  const getBuyerPriorityStars = (score?: number) => {
    if (!score) return 0;
    return Math.min(Math.floor(score), 5);
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
        {/* Header with Deal Title and Time in Stage */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-foreground/90 line-clamp-2 leading-tight">
              {deal.deal_title}
            </h3>
            <div className="flex flex-col gap-1 items-end">
              {/* Time in Stage - Prominent */}
              <div className={`text-xs font-bold ${getTimeInStageColor(getDaysInStage())}`}>
                {getDaysInStage()}d
              </div>
              {deal.buyer_priority_score && deal.buyer_priority_score > 0 && (
                <div className="flex items-center gap-0.5">
                  {[...Array(getBuyerPriorityStars(deal.buyer_priority_score))].map((_, i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buyer Information with Prominent Type Badge */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                {deal.buyer_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
                 deal.contact_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'B'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-foreground/90 truncate">
                  {deal.buyer_name || deal.contact_name || 'Unknown Buyer'}
                </p>
                {/* Prominent Buyer Type Badge */}
                {deal.buyer_type && (
                  <Badge className={`text-xs px-2 py-0.5 font-semibold ${getBuyerTypeColor(deal.buyer_type)}`}>
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
              {(deal.buyer_company || deal.contact_company) && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {deal.buyer_company || deal.contact_company}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Listing Information */}
        <div className="bg-accent/30 rounded-md p-2 space-y-1">
          <p className="text-xs font-medium text-foreground/80 truncate">
            {deal.listing_title}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(deal.listing_revenue)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {deal.listing_location}
            </span>
          </div>
        </div>

        {/* Deal Probability - Simplified */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground/90">
              {deal.deal_probability}%
            </span>
          </div>
        </div>

        {/* Prominent Document Status Badges */}
        <div className="flex items-center justify-center gap-2 pt-2">
          {/* NDA Status - Prominent Badge */}
          <Badge className={`text-xs px-2 py-1 font-semibold ${getDocumentStatusColor(deal.nda_status)}`}>
            NDA: {deal.nda_status === 'not_sent' ? 'Not Sent' : 
                   deal.nda_status === 'sent' ? 'Sent' :
                   deal.nda_status === 'signed' ? 'Signed' : 'Declined'}
          </Badge>
          
          {/* Fee Agreement Status - Prominent Badge */}
          <Badge className={`text-xs px-2 py-1 font-semibold ${getDocumentStatusColor(deal.fee_agreement_status)}`}>
            Fee: {deal.fee_agreement_status === 'not_sent' ? 'Not Sent' : 
                   deal.fee_agreement_status === 'sent' ? 'Sent' :
                   deal.fee_agreement_status === 'signed' ? 'Signed' : 'Declined'}
          </Badge>
        </div>

        {/* Tasks and Activities */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border/20">
          {/* Tasks */}
          {deal.total_tasks > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {deal.completed_tasks}/{deal.total_tasks} tasks
            </span>
          )}
          
          {/* Activities */}
          {deal.activity_count > 0 && (
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {deal.activity_count} activities
            </span>
          )}
        </div>

        {/* Footer with Admin and Follow-up Info */}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/20">
          {/* Follow-up due date indicator */}
          {deal.next_followup_due && (
            <div className={`flex items-center gap-1 ${deal.followup_overdue ? 'text-red-600 dark:text-red-400' : ''}`}>
              <Clock className="h-3 w-3" />
              <span className="text-xs">
                Due {new Date(deal.next_followup_due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
          
          {/* Overdue follow-up warning */}
          {deal.followup_overdue && !deal.followed_up && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Overdue</span>
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
      </CardContent>
    </Card>
  );
}