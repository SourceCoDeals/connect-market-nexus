import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Edit, CheckSquare, Clock, Building2, Calendar, FileCheck, FileX } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { useLogDealContact } from '@/hooks/admin/use-deal-contact';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PipelineKanbanCardProps {
  deal: Deal;
  onDealClick: (deal: Deal) => void;
  isDragging?: boolean;
}

export function PipelineKanbanCard({ deal, onDealClick, isDragging }: PipelineKanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const logContact = useLogDealContact();
  
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

  // Premium semantic design system colors
  const getBuyerTypeColor = (buyerType?: string) => {
    const type = buyerType?.toLowerCase();
    switch (type) {
      case 'privateequity':
      case 'private equity':
        return 'bg-purple-50/80 text-purple-700 border-purple-200/50';
      case 'familyoffice':
      case 'family office':
        return 'bg-blue-50/80 text-blue-700 border-blue-200/50';
      case 'searchfund':
      case 'search fund':
        return 'bg-emerald-50/80 text-emerald-700 border-emerald-200/50';
      case 'corporate':
        return 'bg-orange-50/80 text-orange-700 border-orange-200/50';
      case 'individual':
        return 'bg-slate-50/80 text-slate-700 border-slate-200/50';
      case 'independentsponsor':
      case 'independent sponsor':
        return 'bg-indigo-50/80 text-indigo-700 border-indigo-200/50';
      default:
        return 'bg-slate-50/80 text-slate-700 border-slate-200/50';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    const type = buyerType?.toLowerCase();
    switch (type) {
      case 'privateequity':
      case 'private equity':
        return 'PE';
      case 'familyoffice':
      case 'family office':
        return 'Family Office';
      case 'searchfund':
      case 'search fund':
        return 'Search Fund';
      case 'corporate':
        return 'Corporate';
      case 'individual':
        return 'Individual';
      case 'independentsponsor':
      case 'independent sponsor':
        return 'Ind. Sponsor';
      default:
        return 'Unknown';
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

  // Calculate real days in stage with proper context
  const daysInStage = deal.deal_stage_entered_at 
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  
  const stageTimeText = `${daysInStage}d in ${deal.stage_name || 'Unknown Stage'}`;

  // Calculate last contact - use real contact tracking data
  const lastContactDate = deal.last_contact_at || deal.followed_up_at;
  const lastContactText = lastContactDate 
    ? formatDistanceToNow(new Date(lastContactDate), { addSuffix: true })
    : 'No contact yet';

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

  // Quick action handlers with real contact logging
  const handleEmailClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
        contactType: 'email',
        details: { recipient: deal.contact_email || deal.buyer_email }
      });
    } catch (error) {
      console.error('Failed to log email contact:', error);
    }
  };

  const handlePhoneClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logContact.mutateAsync({
        dealId: deal.deal_id,
        contactType: 'phone',
        details: { phone: deal.contact_phone }
      });
    } catch (error) {
      console.error('Failed to log phone contact:', error);
    }
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

        {/* Document Status - Clean, readable format */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', 
              deal.nda_status === 'signed' ? 'bg-emerald-500' :
              deal.nda_status === 'sent' ? 'bg-amber-500' : 'bg-slate-300'
            )} />
            <span className="text-muted-foreground">NDA:</span>
            <span className={cn('font-medium',
              deal.nda_status === 'signed' ? 'text-emerald-600' :
              deal.nda_status === 'sent' ? 'text-amber-600' : 'text-slate-500'
            )}>
              {ndaStatus.label}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full',
              deal.fee_agreement_status === 'signed' ? 'bg-emerald-500' :
              deal.fee_agreement_status === 'sent' ? 'bg-amber-500' : 'bg-slate-300'
            )} />
            <span className="text-muted-foreground">Fee:</span>
            <span className={cn('font-medium',
              deal.fee_agreement_status === 'signed' ? 'text-emerald-600' :
              deal.fee_agreement_status === 'sent' ? 'text-amber-600' : 'text-slate-500'
            )}>
              {feeStatus.label}
            </span>
          </div>
        </div>

        {/* Task Progress - Always visible */}
        <div className="flex items-center gap-1.5 text-xs">
          <CheckSquare className={cn(
            'h-3 w-3',
            deal.pending_tasks > 0 ? 'text-amber-500' : 'text-emerald-500'
          )} />
          <span className={cn('font-medium',
            deal.pending_tasks > 0 ? 'text-amber-600' : 'text-emerald-600'
          )}>
            {deal.total_tasks === 0 ? '0 tasks' : 
             deal.pending_tasks === 0 ? `${deal.total_tasks} tasks completed` : 
             `${deal.pending_tasks}/${deal.total_tasks} tasks pending`}
          </span>
        </div>

        {/* Next Action & Time Context */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{stageTimeText}</span>
            <span className="text-muted-foreground">{lastContactText}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-2 py-1 bg-primary/5 border border-primary/10 rounded text-xs font-medium text-primary">
              Next: {nextAction}
            </div>
          </div>
        </div>

        {/* Quick Actions on Hover - Premium floating design */}
        {isHovered && !isDragging && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out">
            <button
              onClick={handleEmailClick}
              disabled={logContact.isPending}
              className="h-8 w-8 p-0 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm hover:shadow-md hover:bg-white flex items-center justify-center transition-all duration-200"
              title="Send Email"
            >
              <Mail className="h-3.5 w-3.5 text-gray-600" />
            </button>
            <button
              onClick={handlePhoneClick}
              disabled={logContact.isPending}
              className="h-8 w-8 p-0 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm hover:shadow-md hover:bg-white flex items-center justify-center transition-all duration-200"
              title="Log Call"
            >
              <Phone className="h-3.5 w-3.5 text-gray-600" />
            </button>
            <button
              onClick={handleEditClick}
              className="h-8 w-8 p-0 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm hover:shadow-md hover:bg-white flex items-center justify-center transition-all duration-200"
              title="View Details"
            >
              <Edit className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}