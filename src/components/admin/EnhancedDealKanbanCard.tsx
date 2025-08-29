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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
      case 'low': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
    }
  };

  const getBuyerTypeColor = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'familyOffice': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'searchFund': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'corporate': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'text-green-600 dark:text-green-400';
      case 'sent': return 'text-amber-600 dark:text-amber-400';
      case 'declined': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-400 dark:text-gray-500';
    }
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
        {/* Header with Priority and Buyer Score */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-foreground/90 line-clamp-2 leading-tight">
              {deal.deal_title}
            </h3>
            <div className="flex flex-col gap-1 items-end">
              <Badge 
                className={`text-xs font-medium border ${getPriorityColor(deal.deal_priority)} flex-shrink-0`}
              >
                {deal.deal_priority}
              </Badge>
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

        {/* Buyer Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                {deal.buyer_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
                 deal.contact_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'B'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground/90 truncate">
                {deal.buyer_name || deal.contact_name || 'Unknown Buyer'}
              </p>
              <div className="flex items-center gap-2">
                {(deal.buyer_company || deal.contact_company) && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {deal.buyer_company || deal.contact_company}
                  </p>
                )}
                {deal.buyer_type && (
                  <Badge className={`text-xs px-1.5 py-0.5 ${getBuyerTypeColor(deal.buyer_type)}`}>
                    {deal.buyer_type === 'privateEquity' ? 'PE' : 
                     deal.buyer_type === 'familyOffice' ? 'FO' :
                     deal.buyer_type === 'searchFund' ? 'SF' :
                     deal.buyer_type === 'corporate' ? 'Corp' :
                     deal.buyer_type === 'independentSponsor' ? 'IS' :
                     deal.buyer_type}
                  </Badge>
                )}
              </div>
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

        {/* Deal Value & Probability */}
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Value: </span>
            <span className="font-semibold text-foreground/90">
              {formatCurrency(deal.deal_value)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground/90">
              {deal.deal_probability}%
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-3">
            {/* NDA Status */}
            <div className="flex items-center gap-1">
              <ShieldCheck className={`h-3 w-3 ${getStatusColor(deal.nda_status)}`} />
              <span className="text-xs text-muted-foreground">NDA</span>
            </div>
            
            {/* Fee Agreement Status */}
            <div className="flex items-center gap-1">
              <FileCheck className={`h-3 w-3 ${getStatusColor(deal.fee_agreement_status)}`} />
              <span className="text-xs text-muted-foreground">Fee</span>
            </div>

            {/* Follow-up indicator with overdue status */}
            {deal.followed_up && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-xs text-muted-foreground">F/U</span>
              </div>
            )}
            
            {/* Overdue follow-up warning */}
            {deal.followup_overdue && !deal.followed_up && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-xs text-red-600 dark:text-red-400">Overdue</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* Tasks */}
            {deal.total_tasks > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {deal.completed_tasks}/{deal.total_tasks}
              </span>
            )}
            
            {/* Activities */}
            {deal.activity_count > 0 && (
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {deal.activity_count}
              </span>
            )}
          </div>
        </div>

        {/* Footer with Follow-up Due Date */}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {Math.ceil((Date.now() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))}d in stage
            </span>
          </div>
          
          {/* Follow-up due date indicator */}
          {deal.next_followup_due && (
            <div className={`flex items-center gap-1 ${deal.followup_overdue ? 'text-red-600 dark:text-red-400' : ''}`}>
              <Clock className="h-3 w-3" />
              <span className="text-xs">
                Due {new Date(deal.next_followup_due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
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