import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Edit, CheckSquare, Clock, Building2, Calendar, ArrowRight } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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

  // Helper functions for colors and labels - Premium design system
  const getBuyerTypeColor = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'familyOffice':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'searchFund':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'corporate':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'individual':
        return 'bg-gray-50 text-gray-600 border-gray-200';
      case 'independentSponsor':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    switch (buyerType) {
      case 'privateEquity':
        return 'Private Equity';
      case 'familyOffice':
        return 'Family Office';
      case 'searchFund':
        return 'Search Fund';
      case 'corporate':
        return 'Strategic';
      case 'individual':
        return 'Individual';
      case 'independentSponsor':
        return 'Independent Sponsor';
      default:
        return 'Individual';
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'signed':
        return { 
          color: 'bg-emerald-500', 
          label: 'Signed',
          textColor: 'text-emerald-700'
        };
      case 'sent':
        return { 
          color: 'bg-amber-500', 
          label: 'Sent',
          textColor: 'text-amber-700'
        };
      case 'declined':
        return { 
          color: 'bg-red-500', 
          label: 'Declined',
          textColor: 'text-red-700'
        };
      default:
        return { 
          color: 'bg-gray-400', 
          label: 'Not Sent',
          textColor: 'text-gray-600'
        };
    }
  };

  // Enhanced Buyer Priority Logic - Clean priority system
  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', dot: 'bg-emerald-500' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', dot: 'bg-amber-500' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', dot: 'bg-emerald-500' };
        if (score && score >= 40) return { level: 'Medium', dot: 'bg-amber-500' };
        return { level: 'Standard', dot: 'bg-gray-400' };
      default:
        return { level: 'Standard', dot: 'bg-gray-400' };
    }
  };

  // Fix buyer type detection - use actual buyer_type from profiles
  const actualBuyerType = deal.buyer_type;

  // Task calculation using real task data
  const getTaskInfo = () => {
    const total = deal.total_tasks || 0;
    const completed = deal.completed_tasks || 0;
    const pending = deal.pending_tasks || 0;
    
    // If no tasks exist, show realistic task count
    if (total === 0) {
      return { completed: 0, total: 0, pending: 0, hasAnyTasks: false };
    }
    
    return { completed, total, pending, hasAnyTasks: true };
  };

  // Calculate meaningful data
  const taskInfo = getTaskInfo();
  const buyerPriority = getBuyerPriority(actualBuyerType, deal.buyer_priority_score);
  const ndaStatus = getStatusIndicator(deal.nda_status);
  const feeStatus = getStatusIndicator(deal.fee_agreement_status);

  // Key information display - Clean data extraction
  const listingTitle = deal.listing_title || 'Business Acquisition Opportunity';
  
  // Company name hierarchy - prioritize buyer company, fallback to contact company
  const companyName = deal.contact_company || deal.buyer_company || 'Private Investor';
  const contactName = deal.contact_name || deal.buyer_name || 'Unknown Contact';

  // Revenue formatting
  const listingRevenue = deal.listing_revenue 
    ? `$${(deal.listing_revenue / 1000000).toFixed(1)}M Revenue` 
    : null;

  // Calculate days in stage with proper context
  const daysInStage = deal.deal_stage_entered_at 
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  // Calculate last contact - use real data
  const lastContactDate = deal.followed_up_at || deal.deal_created_at;
  const lastContactText = lastContactDate 
    ? formatDistanceToNow(new Date(lastContactDate), { addSuffix: false })
    : 'No contact';

  // Determine next action based on deal status
  const getNextAction = () => {
    if (deal.nda_status === 'not_sent') return 'Send NDA';
    if (deal.nda_status === 'sent' && deal.fee_agreement_status === 'not_sent') return 'Follow up NDA';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'not_sent') return 'Send Fee Agreement';
    if (deal.fee_agreement_status === 'sent') return 'Follow up Fee Agreement';
    if (deal.fee_agreement_status === 'signed') return 'Schedule Meeting';
    return 'Contact Buyer';
  };

  const nextAction = getNextAction();

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
        "group relative mb-3 cursor-pointer transition-all duration-200 ease-out",
        "bg-white border border-gray-200 rounded-xl shadow-sm",
        "hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5",
        isDragging && "rotate-1 shadow-lg scale-[1.02] z-50 border-blue-300",
        buyerPriority.level === 'High' && "ring-1 ring-emerald-100"
      )}
      onClick={() => !isDragging && onDealClick(deal)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with priority indicator and clean typography */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-sm font-medium text-gray-900 leading-tight truncate">
              {listingTitle}
            </h3>
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 truncate">{companyName}</span>
              <Badge className={cn("text-xs px-1.5 py-0.5 font-medium border rounded-md", getBuyerTypeColor(actualBuyerType))}>
                {getBuyerTypeLabel(actualBuyerType)}
              </Badge>
            </div>
          </div>
          <div className={cn("w-2 h-2 rounded-full ml-3 mt-0.5 flex-shrink-0", buyerPriority.dot)} />
        </div>

        {/* Contact person */}
        <div className="text-xs text-gray-600">
          Contact: {contactName}
        </div>

        {/* Revenue - when available */}
        {listingRevenue && (
          <div className="text-xs text-gray-500 font-medium">{listingRevenue}</div>
        )}

        {/* Document Status - Clear indicators with labels */}
        <div className="flex items-center gap-4 py-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", ndaStatus.color)} />
            <span className={cn("text-xs font-medium", ndaStatus.textColor)}>
              NDA: {ndaStatus.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", feeStatus.color)} />
            <span className={cn("text-xs font-medium", feeStatus.textColor)}>
              Fee: {feeStatus.label}
            </span>
          </div>
        </div>

        {/* Tasks - Always show */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Tasks</span>
          </div>
          <div className="text-xs font-medium text-gray-700">
            {taskInfo.total > 0 ? `${taskInfo.completed}/${taskInfo.total}` : '0 tasks'}
          </div>
        </div>

        {/* Bottom metadata - Clean, contextual */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{daysInStage} days in stage</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Last: {lastContactText}</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />
            <span className="truncate max-w-16">{nextAction}</span>
          </div>
        </div>

        {/* Quick Actions on Hover - Clean floating actions */}
        {isHovered && !isDragging && (
          <div className="absolute top-3 right-3 flex gap-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-1">
            <button
              onClick={handleEmailClick}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-150"
              title="Send Email"
            >
              <Mail className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <button
              onClick={handlePhoneClick}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-150"
              title="Call"
            >
              <Phone className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <button
              onClick={handleEditClick}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-150"
              title="Edit Deal"
            >
              <Edit className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}