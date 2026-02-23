import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Building2, User, Globe, FileText, Zap, Target, Phone, Star } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';
import { DealScoreBadge } from '@/components/ma-intelligence/DealScoreBadge';

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

  const isValidDate = (value?: string | null) => {
    if (!value) return false;
    return !Number.isNaN(new Date(value).getTime());
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-emerald-500';
      case 'sent': return 'bg-amber-500';
      case 'declined': return 'bg-destructive';
      default: return 'bg-muted-foreground/30';
    }
  };

  const getSourceBadge = () => {
    const source = deal.source || 'manual';
    switch (source) {
      case 'marketplace': return { icon: Globe, label: 'Mkt' };
      case 'remarketing': return { icon: Target, label: 'Rmkt' };
      case 'webflow': return { icon: FileText, label: 'Web' };
      default: return { icon: Zap, label: 'Man' };
    }
  };

  const assignedAdmin = useAdminProfile(deal.assigned_to);
  const listingTitle = deal.listing_title || 'Business Acquisition Opportunity';
  const contactName = deal.contact_name || deal.buyer_name || 'Unknown';
  const sourceBadge = getSourceBadge();
  const SourceIcon = sourceBadge.icon;

  const stageDurationLabel = (() => {
    if (!deal.deal_stage_entered_at || !isValidDate(deal.deal_stage_entered_at)) return '-';
    const diffMs = Math.max(0, Date.now() - new Date(deal.deal_stage_entered_at).getTime());
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  })();

  const handleCardClick = () => {
    if (isBeingDragged) return;
    onDealClick(deal);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative mb-3 cursor-pointer transition-all duration-200",
        "bg-card border border-border rounded-xl shadow-sm",
        isBeingDragged && "shadow-2xl shadow-black/10 scale-[1.02] z-50 border-primary/30 opacity-95"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-3.5 space-y-2.5">
        {/* Row 1: Title + Score + Flags */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground leading-tight truncate">
              {listingTitle}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {deal.is_priority_target && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 border border-amber-300 text-[9px] font-semibold text-amber-800">
                <Star className="w-2.5 h-2.5" />
              </span>
            )}
            {deal.needs_owner_contact && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-100 border border-red-300 text-[9px] font-semibold text-red-800 animate-pulse">
                <Phone className="w-2.5 h-2.5" />
              </span>
            )}
            {deal.deal_score != null && (
              <DealScoreBadge score={deal.deal_score} size="sm" />
            )}
          </div>
        </div>

        {/* Row 2: Key People - Deal Owner (left) | Buyer (right) */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 min-w-0 truncate">
            <User className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            <span className="text-muted-foreground/70">Owner:</span>
            <span className="font-medium text-foreground/90 truncate">
              {assignedAdmin?.displayName || 'Unassigned'}
            </span>
          </div>
          <div className="flex items-center gap-1 min-w-0 truncate text-right">
            <Building2 className="w-3 h-3 text-primary/50 flex-shrink-0" />
            <span className="font-medium text-foreground/90 truncate">
              {deal.contact_company || contactName}
            </span>
          </div>
        </div>

        {/* Row 2b: Buyer contact name if company shown above */}
        {deal.contact_company && (
          <div className="flex items-center gap-1 text-xs">
            <User className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
            <span className="text-muted-foreground truncate">{contactName}</span>
          </div>
        )}

        {/* Row 3: Status strip - NDA + Fee dots */}
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot(deal.nda_status))} />
            <span className="text-muted-foreground">NDA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot(deal.fee_agreement_status))} />
            <span className="text-muted-foreground">Fee</span>
          </div>
        </div>

        {/* Row 4: Source + Stage duration */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/10">
          <span className="inline-flex items-center gap-1">
            <SourceIcon className="w-2.5 h-2.5" />
            {sourceBadge.label}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {stageDurationLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
