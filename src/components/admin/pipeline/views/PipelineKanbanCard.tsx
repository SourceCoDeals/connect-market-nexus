import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';

interface PipelineKanbanCardProps {
  deal: Deal;
  onDealClick: (deal: Deal) => void;
  isDragging?: boolean;
}

export function PipelineKanbanCard({ deal, onDealClick, isDragging }: PipelineKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: `deal:${deal.deal_id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const isBeingDragged = isDragging || isSortableDragging;

  // Helper functions
  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !Number.isNaN(time);
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
        return { label: 'Signed', textColor: 'text-emerald-600' };
      case 'sent':
        return { label: 'Sent', textColor: 'text-amber-600' };
      case 'declined':
        return { label: 'Declined', textColor: 'text-red-600' };
      default:
        return { label: 'Not Sent', textColor: 'text-muted-foreground' };
    }
  };

  const getBuyerPriority = (buyerType?: string, score?: number) => {
    switch (buyerType) {
      case 'privateEquity':
      case 'familyOffice':
      case 'corporate':
        return { level: 'High', dot: 'bg-primary' };
      case 'searchFund':
      case 'independentSponsor':
        return { level: 'Medium', dot: 'bg-accent' };
      case 'individual':
        if (score && score >= 70) return { level: 'High', dot: 'bg-primary' };
        if (score && score >= 40) return { level: 'Medium', dot: 'bg-accent' };
        return { level: 'Standard', dot: 'bg-muted-foreground' };
      default:
        return { level: 'Standard', dot: 'bg-muted-foreground' };
    }
  };

  // Extract deal data
  const actualBuyerType = deal.buyer_type || deal.contact_role;
  
  const getTaskInfo = () => {
    const total = deal.total_tasks || 0;
    const completed = deal.completed_tasks || 0;
    return total > 0 ? { total, completed } : null;
  };

  const taskInfo = getTaskInfo();
  const buyerPriority = getBuyerPriority(actualBuyerType);
  const ndaStatus = getStatusIndicator(deal.nda_status || 'not_sent');
  const feeStatus = getStatusIndicator(deal.fee_agreement_status || 'not_sent');
  
  const assignedAdmin = useAdminProfile(deal.assigned_admin_email || '');

  const listingTitle = deal.listing_title || deal.title || 'Untitled';
  const companyName = deal.contact_company;
  const contactName = deal.contact_name;
  const buyerConnectionCount = deal.buyer_connection_count || 1;

  // Time calculations
  const daysInStage = deal.deal_stage_entered_at 
    ? Math.floor((Date.now() - new Date(deal.deal_stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const stageDurationLabel = daysInStage === 1 ? '1 day' : `${daysInStage} days`;

  // Last contact info
  const getLastContactInfo = () => {
    if (!deal.last_contact_at || !isValidDate(deal.last_contact_at)) {
      return { text: 'No contact', color: 'text-muted-foreground', isOverdue: false };
    }

    const daysSinceContact = Math.floor(
      (new Date().getTime() - new Date(deal.last_contact_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceContact === 0) return { text: 'Today', color: 'text-emerald-600', isOverdue: false };
    if (daysSinceContact === 1) return { text: '1d ago', color: 'text-foreground', isOverdue: false };
    if (daysSinceContact <= 7) return { text: `${daysSinceContact}d ago`, color: 'text-foreground', isOverdue: false };
    if (daysSinceContact <= 14) return { text: `${daysSinceContact}d ago`, color: 'text-amber-600', isOverdue: true };
    return { text: `${daysSinceContact}d ago`, color: 'text-red-600', isOverdue: true };
  };

  const lastContactInfo = getLastContactInfo();

  const handleCardClick = () => {
    if (isBeingDragged) return;
    onDealClick(deal);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group cursor-pointer transition-all duration-200',
        'bg-card hover:bg-accent/5 hover:shadow-md hover:border-border hover:-translate-y-0.5',
        'border-border/50',
        'rounded-lg',
        isBeingDragged && 'opacity-50 shadow-2xl scale-105 ring-2 ring-primary/30'
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Row 1: Title + Priority Dot */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-2 flex-1">
            {listingTitle}
          </h4>
          <div 
            className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', buyerPriority.dot)}
            title={`Priority: ${buyerPriority.level}`}
          />
        </div>
        
        {/* Row 2: Company (Seller) */}
        {companyName && (
          <p className="text-xs font-medium text-foreground">
            {companyName}
          </p>
        )}

        {/* Row 3: Contact → Buyer Company • Buyer Type */}
        <div className="space-y-1">
          {contactName && (
            <p className="text-xs text-muted-foreground">
              {contactName}
              {buyerConnectionCount > 1 && (
                <span className="ml-1 text-muted-foreground/60">
                  +{buyerConnectionCount - 1}
                </span>
              )}
            </p>
          )}
          <p className="text-xs font-medium text-foreground">
            {deal.buyer_company || 'No buyer company'}
            {actualBuyerType && (
              <span className="text-muted-foreground font-normal">
                {' • '}{getBuyerTypeLabel(actualBuyerType)}
              </span>
            )}
          </p>
        </div>

        {/* Row 4: Owner (if applicable) */}
        {assignedAdmin && (
          <p className="text-xs text-muted-foreground">
            Owner: {assignedAdmin.displayName || assignedAdmin.email.split('@')[0]}
          </p>
        )}

        {/* Row 5: NDA & Fee Agreement Status */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            NDA: <span className={cn('font-medium', ndaStatus.textColor)}>{ndaStatus.label}</span>
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-muted-foreground">
            Fee: <span className={cn('font-medium', feeStatus.textColor)}>{feeStatus.label}</span>
          </span>
        </div>

        {/* Row 6: Tasks (if any) */}
        {taskInfo && taskInfo.total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Tasks {taskInfo.completed}/{taskInfo.total}
              </span>
              <span className="text-muted-foreground">
                {Math.round((taskInfo.completed / taskInfo.total) * 100)}%
              </span>
            </div>
            <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary/70 transition-all duration-300"
                style={{ width: `${(taskInfo.completed / taskInfo.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Row 7: Days in Stage • Last Contact */}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/40">
          <span>{stageDurationLabel}</span>
          <span className={lastContactInfo.color}>
            {lastContactInfo.text}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
