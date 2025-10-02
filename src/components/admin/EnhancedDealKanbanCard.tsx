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
        return 'bg-secondary/50 text-secondary-foreground border-secondary';
      case 'familyOffice': 
        return 'bg-accent/50 text-accent-foreground border-accent';
      case 'searchFund': 
        return 'bg-muted text-muted-foreground border-border';
      case 'corporate': 
        return 'bg-secondary/30 text-secondary-foreground border-secondary/60';
      case 'independentSponsor': 
        return 'bg-accent/30 text-accent-foreground border-accent/60';
      case 'individual': 
        return 'bg-muted/70 text-muted-foreground border-border/70';
      default: 
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDocumentStatusStyles = (status: string) => {
    switch (status) {
      case 'signed': 
        return 'bg-secondary/60 text-secondary-foreground border-secondary';
      case 'sent': 
        return 'bg-accent/50 text-accent-foreground border-accent';
      case 'declined': 
        return 'bg-destructive/20 text-destructive-foreground border-destructive/40';
      default: 
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTimeInStageColor = (daysInStage: number) => {
    if (daysInStage <= 3) return 'text-secondary-foreground';
    if (daysInStage <= 7) return 'text-accent-foreground';
    return 'text-foreground';
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
      className={`cursor-pointer transition-all duration-200 border-2 ${
        isDragging 
          ? 'shadow-2xl shadow-black/20 border-[hsl(var(--sourceco-primary))] bg-white scale-[1.02] z-50 opacity-95' 
          : 'bg-white border-border/70 hover:border-[hsl(var(--sourceco-primary))]/50 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-0.5'
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
              {deal.listing_real_company_name?.trim()
                ? `${deal.listing_real_company_name} / ${(deal.listing_title || deal.deal_title || '').trim()}`
                : (deal.listing_title || deal.deal_title || 'Untitled Deal')}
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
