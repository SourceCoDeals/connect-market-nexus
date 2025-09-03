import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Edit, CheckCircle2, Clock, User } from 'lucide-react';
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
        return 'bg-purple-100/50 text-purple-700';
      case 'familyOffice':
        return 'bg-blue-100/50 text-blue-700';
      case 'searchFund':
        return 'bg-emerald-100/50 text-emerald-700';
      case 'corporate':
        return 'bg-orange-100/50 text-orange-700';
      case 'individual':
        return 'bg-slate-100/50 text-slate-700';
      case 'independentSponsor':
        return 'bg-indigo-100/50 text-indigo-700';
      default:
        return 'bg-slate-100/50 text-slate-600';
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
        return 'Individual';
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'signed':
        return { color: 'bg-emerald-500', label: 'Signed' };
      case 'sent':
        return { color: 'bg-amber-500', label: 'Sent' };
      case 'declined':
        return { color: 'bg-red-500', label: 'Declined' };
      default:
        return { color: 'bg-slate-300', label: 'Pending' };
    }
  };

  // Enhanced Buyer Priority Logic
  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', color: 'text-emerald-600', dot: 'bg-emerald-500' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', color: 'text-amber-600', dot: 'bg-amber-500' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', color: 'text-emerald-600', dot: 'bg-emerald-500' };
        if (score && score >= 40) return { level: 'Medium', color: 'text-amber-600', dot: 'bg-amber-500' };
        return { level: 'Low', color: 'text-slate-500', dot: 'bg-slate-400' };
      default:
        return { level: 'Medium', color: 'text-slate-500', dot: 'bg-slate-400' };
    }
  };

  // Task calculation using real task data
  const getTaskInfo = () => {
    const total = deal.total_tasks || 0;
    const completed = deal.completed_tasks || 0;
    const pending = deal.pending_tasks || 0;
    
    // If no tasks exist, show default structure
    if (total === 0) {
      return { completed: 0, total: 3, pending: 3 };
    }
    
    return { completed, total, pending };
  };

  // Calculate meaningful data
  const taskInfo = getTaskInfo();
  const buyerPriority = getBuyerPriority(deal.buyer_type, deal.buyer_priority_score);
  const ndaStatus = getStatusIndicator(deal.nda_status);
  const feeStatus = getStatusIndicator(deal.fee_agreement_status);

  // Key information display - prioritize listing title and buyer company
  const listingTitle = deal.listing_title || 'Business Acquisition Opportunity';
  const buyerCompany = deal.buyer_company || deal.contact_company || 'Private Investor';
  const contactName = deal.buyer_name || deal.contact_name || 'Unknown Contact';

  // Revenue context for deal sizing
  const listingRevenue = deal.listing_revenue ? `$${(deal.listing_revenue / 1000000).toFixed(1)}M Revenue` : null;

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
        "group relative mb-3 cursor-pointer transition-all duration-300 ease-out",
        "bg-white border border-slate-200/60 hover:border-slate-300/80",
        "hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5",
        isDragging && "rotate-1 shadow-xl shadow-slate-300/30 scale-[1.02] z-50 border-slate-300",
        buyerPriority.level === 'High' && "ring-1 ring-emerald-200/50"
      )}
      onClick={() => !isDragging && onDealClick(deal)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-6">
        {/* Primary Header - Listing + Company */}
        <div className="mb-5">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-slate-900 leading-tight pr-2">
              {listingTitle} • {buyerCompany}
            </h3>
            <div className={cn("flex items-center gap-1.5", buyerPriority.color)}>
              <div className={cn("w-2 h-2 rounded-full", buyerPriority.dot)} />
              <span className="text-xs font-medium">{buyerPriority.level}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>{contactName}</span>
            </div>
            <Badge className={cn("text-xs px-2 py-0.5 font-medium rounded-full", getBuyerTypeColor(deal.buyer_type))}>
              {getBuyerTypeLabel(deal.buyer_type)}
            </Badge>
          </div>
          
          {listingRevenue && (
            <p className="text-sm text-slate-500 mt-1">{listingRevenue}</p>
          )}
        </div>

        {/* Document Status - Subtle Indicators */}
        <div className="mb-5">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", ndaStatus.color)} />
              <span className="text-slate-600">NDA</span>
              <span className="text-slate-900 font-medium">{ndaStatus.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", feeStatus.color)} />
              <span className="text-slate-600">Fee</span>
              <span className="text-slate-900 font-medium">{feeStatus.label}</span>
            </div>
          </div>
        </div>

        {/* Tasks & Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-900 font-medium">
                {taskInfo.completed}/{taskInfo.total}
              </span>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(taskInfo.completed / taskInfo.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions on Hover */}
        {isHovered && !isDragging && (
          <div className="absolute top-4 right-4 flex gap-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200/60 p-1">
            <button
              onClick={handleEmailClick}
              className="p-2 rounded-md hover:bg-slate-100 transition-colors duration-200"
              title="Send Email"
            >
              <Mail className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={handlePhoneClick}
              className="p-2 rounded-md hover:bg-slate-100 transition-colors duration-200"
              title="Call"
            >
              <Phone className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={handleEditClick}
              className="p-2 rounded-md hover:bg-slate-100 transition-colors duration-200"
              title="Edit Deal"
            >
              <Edit className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}