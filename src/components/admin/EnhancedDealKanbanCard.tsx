import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Deal } from '@/hooks/admin/use-deals';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';
import { User } from 'lucide-react';

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

  const assignedAdmin = useAdminProfile(deal.assigned_to);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getBuyerTypeStyles = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': 
        return 'bg-[rgb(221,214,254)] text-[rgb(88,28,135)] border-[rgb(168,85,247)]';
      case 'familyOffice': 
        return 'bg-[rgb(191,219,254)] text-[rgb(30,64,175)] border-[rgb(59,130,246)]';
      case 'searchFund': 
        return 'bg-[rgb(187,247,208)] text-[rgb(22,101,52)] border-[rgb(34,197,94)]';
      case 'corporate': 
        return 'bg-[rgb(254,215,170)] text-[rgb(154,52,18)] border-[rgb(251,146,60)]';
      case 'independentSponsor': 
        return 'bg-[rgb(199,210,254)] text-[rgb(55,48,163)] border-[rgb(129,140,248)]';
      case 'individual': 
        return 'bg-[rgb(229,231,235)] text-[rgb(55,65,81)] border-[rgb(156,163,175)]';
      default: 
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDocumentStatusStyles = (status: string) => {
    switch (status) {
      case 'signed': 
        return 'bg-[rgb(134,239,172)] text-[rgb(5,46,22)] border-[rgb(34,197,94)]';
      case 'sent': 
        return 'bg-[rgb(253,224,71)] text-[rgb(69,26,3)] border-[rgb(234,179,8)]';
      case 'declined': 
        return 'bg-[rgb(252,165,165)] text-[rgb(69,10,10)] border-[rgb(239,68,68)]';
      default: 
        return 'bg-[rgb(226,232,240)] text-[rgb(51,65,85)] border-[rgb(148,163,184)]';
    }
  };

  const getTimeInStageColor = (daysInStage: number) => {
    if (daysInStage <= 3) return 'text-success';
    if (daysInStage <= 7) return 'text-warning';
    return 'text-destructive';
  };

  const getDaysInStage = () => {
    return Math.ceil((Date.now() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity': return 'PE';
      case 'familyOffice': return 'FO';
      case 'searchFund': return 'SF';
      case 'corporate': return 'Corp';
      case 'independentSponsor': return 'IS';
      case 'individual': return 'IND';
      default: return buyerType || 'Unknown';
    }
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
      <CardContent className="p-6 space-y-4">
        {/* Primary Info: Company Name + Buyer Type Badge (Most Prominent) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-foreground truncate leading-tight">
              {deal.buyer_company || deal.contact_company || deal.buyer_name || deal.contact_name || 'Unknown Company'}
            </h3>
            <p className="text-sm text-muted-foreground truncate mt-1">
              {deal.contact_name || deal.buyer_name}
            </p>
          </div>
          
          {/* Buyer Type Badge - Very Prominent for Probability Assessment */}
          {deal.buyer_type && (
            <Badge className={`text-sm px-3 py-1.5 font-bold border-2 ${getBuyerTypeStyles(deal.buyer_type)}`}>
              {getBuyerTypeLabel(deal.buyer_type)}
            </Badge>
          )}
        </div>

        {/* Secondary Info: Time in Stage */}
        <div className="flex justify-center">
          <div className={`text-lg font-bold ${getTimeInStageColor(getDaysInStage())}`}>
            {getDaysInStage()} days in stage
          </div>
        </div>

        {/* Document Status - Clean, Prominent Row */}
        <div className="flex items-center justify-center gap-3">
          <Badge className={`text-sm px-3 py-1.5 font-medium border ${getDocumentStatusStyles(deal.nda_status)}`}>
            NDA
          </Badge>
          <Badge className={`text-sm px-3 py-1.5 font-medium border ${getDocumentStatusStyles(deal.fee_agreement_status)}`}>
            Fee Agreement
          </Badge>
        </div>

        {/* Deal Owner */}
        {assignedAdmin && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-3">
            <User className="h-4 w-4" />
            <span className="truncate">{assignedAdmin.displayName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}