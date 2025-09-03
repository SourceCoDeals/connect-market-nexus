import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Edit, Clock, AlertCircle } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';

interface PipelineKanbanCardProps {
  deal: Deal;
  onDealClick: (deal: Deal) => void;
  isDragging?: boolean;
}

export function PipelineKanbanCard({ deal, onDealClick, isDragging }: PipelineKanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: deal.deal_id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  // Helper functions for colors and labels
  const getBuyerTypeColor = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'familyOffice':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'searchFund':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'corporate':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'individual':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'independentSponsor':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'PE Fund';
      case 'familyOffice':
        return 'Family Office';
      case 'searchFund':
        return 'Search Fund';
      case 'corporate':
        return 'Strategic';
      case 'individual':
        return 'Individual';
      case 'independentSponsor':
        return 'Ind. Sponsor';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'sent':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Enhanced Buyer Priority Logic
  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
        return { level: 'High', color: 'bg-emerald-100 text-emerald-800' };
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', color: 'bg-emerald-100 text-emerald-800' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', color: 'bg-emerald-100 text-emerald-800' };
        if (score && score >= 40) return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
        return { level: 'Low', color: 'bg-gray-100 text-gray-600' };
      default:
        return { level: 'Low', color: 'bg-gray-100 text-gray-600' };
    }
  };

  // Deal Momentum Indicators
  const getDaysSinceLastContact = () => {
    if (deal.followed_up_at) {
      return Math.floor((new Date().getTime() - new Date(deal.followed_up_at).getTime()) / (1000 * 60 * 60 * 24));
    }
    return Math.floor((new Date().getTime() - new Date(deal.deal_created_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getNextAction = () => {
    if (deal.nda_status === 'not_sent') return 'Send NDA';
    if (deal.nda_status === 'sent') return 'Follow up on NDA';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'not_sent') return 'Send Fee Agreement';
    if (deal.fee_agreement_status === 'sent') return 'Follow up on Fee Agreement';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'signed') return 'Schedule DD call';
    return 'Follow up';
  };

  // Calculate meaningful data
  const daysInStage = Math.floor(
    (new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysSinceLastContact = getDaysSinceLastContact();
  const nextAction = getNextAction();
  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);

  // Key information display - prioritize listing title and buyer company
  const listingTitle = deal.listing_title || 'Unknown Listing';
  const buyerCompany = deal.buyer_company || deal.contact_company || 'Unknown Company';
  const contactName = deal.buyer_name || deal.contact_name || 'Unknown Contact';

  // Revenue context for deal sizing
  const listingRevenue = deal.listing_revenue ? `$${(deal.listing_revenue / 1000000).toFixed(1)}M` : null;
  const listingEbitda = deal.listing_ebitda ? `$${(deal.listing_ebitda / 1000000).toFixed(1)}M` : null;

  // Urgency indicators
  const isOverdue = deal.followup_overdue;
  const isStale = daysInStage > 14;
  const isUrgent = daysSinceLastContact > 7;

  // Quick action handlers
  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement email functionality
    console.log('Email clicked for deal:', deal.deal_id);
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement phone functionality
    console.log('Phone clicked for deal:', deal.deal_id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDealClick(deal);
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative mb-3 cursor-pointer transition-all duration-200 hover:shadow-lg border border-gray-200 bg-white",
        isDragging && "rotate-1 shadow-xl scale-[1.02] z-50",
        isOverdue && "border-red-200 bg-red-50",
        isUrgent && !isOverdue && "border-yellow-200 bg-yellow-50",
        buyerPriority.level === 'High' && !isOverdue && !isUrgent && "border-emerald-200 bg-emerald-50"
      )}
      onClick={() => !isDragging && onDealClick(deal)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-5">
        {/* Primary Information - Listing Title (Most Important) */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 leading-tight mb-1">
            {listingTitle}
          </h2>
          {(listingRevenue || listingEbitda) && (
            <div className="text-sm text-gray-600 flex gap-3">
              {listingRevenue && <span>Rev: {listingRevenue}</span>}
              {listingEbitda && <span>EBITDA: {listingEbitda}</span>}
            </div>
          )}
        </div>

        {/* Buyer Information */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{buyerCompany}</p>
              <p className="text-sm text-gray-600 truncate">{contactName}</p>
            </div>
            <Badge className={cn("ml-2 text-xs font-medium px-2 py-1 rounded-full shrink-0", buyerPriority.color)}>
              {buyerPriority.level}
            </Badge>
          </div>
          
          <Badge variant="outline" className={cn("text-xs font-medium px-2 py-1 rounded-full", getBuyerTypeColor(deal.buyer_type))}>
            {getBuyerTypeLabel(deal.buyer_type)}
          </Badge>
        </div>

        {/* Document Status - Clean, Minimal */}
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(
              "text-center py-2 px-3 rounded-lg text-xs font-medium border",
              getStatusColor(deal.nda_status)
            )}>
              <div>NDA</div>
              <div className="text-xs opacity-75 mt-0.5 capitalize">
                {deal.nda_status === 'not_sent' ? 'Pending' : deal.nda_status}
              </div>
            </div>
            <div className={cn(
              "text-center py-2 px-3 rounded-lg text-xs font-medium border",
              getStatusColor(deal.fee_agreement_status)
            )}>
              <div>Fee Agreement</div>
              <div className="text-xs opacity-75 mt-0.5 capitalize">
                {deal.fee_agreement_status === 'not_sent' ? 'Pending' : deal.fee_agreement_status}
              </div>
            </div>
          </div>
        </div>

        {/* Deal Momentum - Key Metrics */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last Contact
            </span>
            <span className={cn(
              "font-medium",
              isUrgent ? "text-red-600" : "text-gray-900"
            )}>
              {daysSinceLastContact}d ago
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Next Action</span>
            <span className="font-medium text-gray-900 text-right flex-1 ml-2 truncate">
              {nextAction}
            </span>
          </div>
        </div>

        {/* Days in Stage - Bottom, Subtle */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Days in Stage</div>
            <div className={cn(
              "text-lg font-semibold mt-0.5",
              isStale ? "text-yellow-600" : "text-gray-900"
            )}>{daysInStage}</div>
          </div>
        </div>

        {/* Quick Actions on Hover */}
        {isHovered && !isDragging && (
          <div className="absolute top-3 right-3 flex gap-1 bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-lg p-1">
            <button
              onClick={handleEmailClick}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              title="Send Email"
            >
              <Mail className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={handlePhoneClick}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              title="Call"
            >
              <Phone className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={handleEditClick}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              title="Edit Deal"
            >
              <Edit className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        )}

        {/* Urgency Indicator */}
        {isOverdue && (
          <div className="absolute -top-2 -right-2">
            <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}