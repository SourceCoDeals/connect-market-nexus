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

  // Premium Apple/Stripe-style design helpers with camelCase support
  const getBuyerTypeColor = (buyerType?: string) => {
    if (!buyerType) return 'bg-slate-50 text-slate-600 border-slate-200/50';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 'bg-gradient-to-r from-purple-50 to-purple-100/80 text-purple-800 border-purple-200/70 shadow-sm';
      case 'familyoffice':
        return 'bg-gradient-to-r from-blue-50 to-blue-100/80 text-blue-800 border-blue-200/70 shadow-sm';
      case 'searchfund':
        return 'bg-gradient-to-r from-emerald-50 to-emerald-100/80 text-emerald-800 border-emerald-200/70 shadow-sm';
      case 'corporate':
        return 'bg-gradient-to-r from-orange-50 to-orange-100/80 text-orange-800 border-orange-200/70 shadow-sm';
      case 'individual':
        return 'bg-gradient-to-r from-slate-50 to-slate-100/80 text-slate-700 border-slate-200/70 shadow-sm';
      case 'independentsponsor':
        return 'bg-gradient-to-r from-indigo-50 to-indigo-100/80 text-indigo-800 border-indigo-200/70 shadow-sm';
      default:
        return 'bg-gradient-to-r from-slate-50 to-slate-100/80 text-slate-700 border-slate-200/70 shadow-sm';
    }
  };

  const getBuyerTypeLabel = (buyerType?: string) => {
    if (!buyerType) return 'Individual';
    
    const type = buyerType.toLowerCase().replace(/[^a-z]/g, '');
    switch (type) {
      case 'privateequity':
        return 'PE';
      case 'familyoffice':
        return 'Family Office';
      case 'searchfund':
        return 'Search Fund';
      case 'corporate':
        return 'Corporate';
      case 'individual':
        return 'Individual';
      case 'independentsponsor':
        return 'Ind. Sponsor';
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

  // Calculate real days in stage
  const daysInStage = (() => {
    if (deal.deal_stage_entered_at) {
      const actualDays = Math.floor((new Date().getTime() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, actualDays);
    }
    
    // If no stage entry date, use deal creation date as fallback
    if (deal.deal_created_at) {
      const daysSinceCreation = Math.floor((new Date().getTime() - new Date(deal.deal_created_at).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, daysSinceCreation);
    }
    
    return 1; // Fallback to 1 day if no dates available
  })();
  
  const daysInStageText = `${daysInStage}d in ${deal.stage_name}`;

  // Enhanced last contact logic with real context
  const getLastContactInfo = () => {
    const lastContactDate = deal.last_contact_at || deal.followed_up_at;
    
    if (!lastContactDate) {
      return {
        text: 'No contact yet',
        isOverdue: daysInStage > 3,
        context: 'contact_needed'
      };
    }
    
    const daysSinceContact = Math.floor((new Date().getTime() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      text: formatDistanceToNow(new Date(lastContactDate), { addSuffix: true }),
      isOverdue: daysSinceContact > 7,
      context: 'contacted'
    };
  };

  const lastContactInfo = getLastContactInfo();

  // Smart next action based on document status and contact history
  const getNextAction = () => {
    if (deal.nda_status === 'not_sent') return 'Send NDA';
    if (deal.nda_status === 'sent' && deal.fee_agreement_status === 'not_sent') return 'Follow up NDA';
    if (deal.nda_status === 'signed' && deal.fee_agreement_status === 'not_sent') return 'Send Fee Agreement';
    if (deal.fee_agreement_status === 'sent') return 'Follow up Fee Agreement';
    if (deal.fee_agreement_status === 'signed') return 'Schedule Meeting';
    if (lastContactInfo.isOverdue) return 'Follow up';
    return 'Continue engagement';
  };

  const nextAction = getNextAction();

  // Last activity tracking
  const getLastActivity = () => {
    if (deal.last_contact_at) {
      return `Contact: ${formatDistanceToNow(new Date(deal.last_contact_at), { addSuffix: true })}`;
    }
    if (deal.followed_up_at) {
      return `Follow-up: ${formatDistanceToNow(new Date(deal.followed_up_at), { addSuffix: true })}`;
    }
    return `Created: ${formatDistanceToNow(new Date(deal.deal_created_at), { addSuffix: true })}`;
  };

  const lastActivity = getLastActivity();

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
        "group relative mb-3 cursor-pointer transition-all duration-300 ease-out",
        "bg-white/95 backdrop-blur-sm border border-border/60 rounded-xl shadow-sm",
        "hover:shadow-lg hover:shadow-black/5 hover:border-border hover:-translate-y-1",
        "hover:bg-white/98 hover:backdrop-blur-md",
        isDragging && "rotate-1 shadow-xl shadow-black/10 scale-[1.02] z-50 border-primary/30 bg-white",
        buyerPriority.level === 'High' && "ring-1 ring-emerald-200/50 shadow-emerald-100/20",
        buyerPriority.level === 'Medium' && "ring-1 ring-amber-200/50 shadow-amber-100/20"
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

        {/* Next Action & Last Activity */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            <span className="text-muted-foreground">Next:</span>
            <span className="font-medium text-primary">{nextAction}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground truncate">{lastActivity}</span>
          </div>
        </div>

        {/* Bottom metadata row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/5">
          <span className="font-medium text-foreground/80">
            {daysInStageText}
          </span>
          <span className={cn(
            'truncate font-medium',
            lastContactInfo.isOverdue && 'text-amber-600',
            lastContactInfo.context === 'contact_needed' && 'text-slate-500'
          )}>
            {lastContactInfo.text}
          </span>
        </div>

        {/* Premium Quick Actions on Hover */}
        {isHovered && !isDragging && (
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
            <button
              onClick={handleEmailClick}
              disabled={logContact.isPending}
              className="h-8 w-8 p-0 bg-white/98 backdrop-blur-md border border-border/40 rounded-lg shadow-md hover:shadow-lg hover:shadow-black/10 flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-primary/5"
              title="Send Email"
            >
              <Mail className="h-3.5 w-3.5 text-foreground/70 hover:text-primary" />
            </button>
            <button
              onClick={handlePhoneClick}
              disabled={logContact.isPending}
              className="h-8 w-8 p-0 bg-white/98 backdrop-blur-md border border-border/40 rounded-lg shadow-md hover:shadow-lg hover:shadow-black/10 flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-primary/5"
              title="Log Call"
            >
              <Phone className="h-3.5 w-3.5 text-foreground/70 hover:text-primary" />
            </button>
            <button
              onClick={handleEditClick}
              className="h-8 w-8 p-0 bg-white/98 backdrop-blur-md border border-border/40 rounded-lg shadow-md hover:shadow-lg hover:shadow-black/10 flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-primary/5"
              title="View Details"
            >
              <Edit className="h-3.5 w-3.5 text-foreground/70 hover:text-primary" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}