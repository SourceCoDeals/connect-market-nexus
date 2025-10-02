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
        return 'bg-[hsl(var(--buyer-pe))] text-[hsl(var(--buyer-pe-foreground))] border-[hsl(var(--buyer-pe-border))]';
      case 'familyOffice': 
        return 'bg-[hsl(var(--buyer-family))] text-[hsl(var(--buyer-family-foreground))] border-[hsl(var(--buyer-family-border))]';
      case 'searchFund': 
        return 'bg-[hsl(var(--buyer-search))] text-[hsl(var(--buyer-search-foreground))] border-[hsl(var(--buyer-search-border))]';
      case 'corporate': 
        return 'bg-[hsl(var(--buyer-corporate))] text-[hsl(var(--buyer-corporate-foreground))] border-[hsl(var(--buyer-corporate-border))]';
      case 'independentSponsor': 
        return 'bg-[hsl(var(--buyer-sponsor))] text-[hsl(var(--buyer-sponsor-foreground))] border-[hsl(var(--buyer-sponsor-border))]';
      case 'individual': 
        return 'bg-[hsl(var(--buyer-individual))] text-[hsl(var(--buyer-individual-foreground))] border-[hsl(var(--buyer-individual-border))]';
      default: 
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getDocumentStatusStyles = (status: string) => {
    switch (status) {
      case 'signed': 
        return 'bg-[hsl(var(--status-signed))] text-[hsl(var(--status-signed-foreground))] border-[hsl(var(--status-signed-border))]';
      case 'sent': 
        return 'bg-[hsl(var(--status-sent))] text-[hsl(var(--status-sent-foreground))] border-[hsl(var(--status-sent-border))]';
      case 'declined': 
        return 'bg-[hsl(var(--status-declined))] text-[hsl(var(--status-declined-foreground))] border-[hsl(var(--status-declined-border))]';
      default: 
        return 'bg-[hsl(var(--status-pending))] text-[hsl(var(--status-pending-foreground))] border-[hsl(var(--status-pending-border))]';
    }
  };

  const getTimeInStageColor = (daysInStage: number) => {
    if (daysInStage <= 3) return 'text-[hsl(var(--status-signed-border))]';
    if (daysInStage <= 7) return 'text-[hsl(var(--status-sent-border))]';
    return 'text-[hsl(var(--status-declined-border))]';
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
      className={`cursor-pointer transition-all duration-300 ease-out group ${
        isDragging 
          ? 'shadow-lg shadow-black/10 border-[hsl(var(--sourceco-primary))] bg-white/95 backdrop-blur-sm scale-[1.02] z-50' 
          : 'bg-white/95 backdrop-blur-sm border-border/40 hover:border-border hover:bg-white hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5'
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