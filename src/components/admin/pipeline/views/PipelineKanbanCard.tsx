import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Globe, Zap, Target, FileText, ExternalLink } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';
import { DealScoreBadge } from '@/components/ma-intelligence/DealScoreBadge';


interface PipelineKanbanCardProps {
  deal: Deal;
  onDealClick: (deal: Deal) => void;
  isDragging?: boolean;
}

const BUYER_TYPE_LABELS: Record<string, string> = {
  privateEquity: 'PE Firm',
  corporate: 'Corporate',
  familyOffice: 'Family Office',
  searchFund: 'Search Fund',
  individual: 'Individual',
  independentSponsor: 'Ind. Sponsor',
  advisor: 'Advisor',
  businessOwner: 'Biz Owner',
};

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
  const isPriority = deal.is_priority_target;
  const needsOwnerContact = deal.needs_owner_contact;

  const assignedAdmin = useAdminProfile(deal.assigned_to);

  const companyName = deal.listing_real_company_name || deal.listing_title || 'Unnamed Company';
  const contactName = deal.contact_name || deal.buyer_name || 'Unknown';
  const buyerCompany = deal.contact_company || deal.buyer_company;
  const buyerTypeLabel = deal.buyer_type ? (BUYER_TYPE_LABELS[deal.buyer_type] || deal.buyer_type) : null;

  const formatCurrency = (val: number) => {
    if (!val) return '—';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
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

  const lastActivityLabel = (() => {
    const date = deal.last_activity_at || deal.deal_updated_at;
    if (!date) return '—';
    const diffMs = Math.max(0, Date.now() - new Date(date).getTime());
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  })();

  const sourceBadge = getSourceBadge();
  const SourceIcon = sourceBadge.icon;

  const handleCardClick = () => {
    if (isBeingDragged) return;
    onDealClick(deal);
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'signed': return 'bg-emerald-500';
      case 'sent': return 'bg-amber-500';
      case 'declined': return 'bg-destructive';
      default: return 'bg-muted-foreground/30';
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative mb-3 cursor-pointer transition-all duration-200 rounded-xl shadow-sm",
        isPriority
          ? "bg-amber-50 border-2 border-amber-400 dark:bg-amber-950/30 dark:border-amber-600"
          : "bg-card border border-border",
        isBeingDragged && "shadow-2xl shadow-black/10 scale-[1.02] z-50 opacity-95"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        {/* Row 1: Company Name — red background if needs_owner_contact */}
        <div
          className={cn(
            "px-3.5 py-2 rounded-t-xl flex items-center justify-between gap-2",
            needsOwnerContact
              ? "bg-red-100 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800"
              : "border-b border-border/50"
          )}
        >
          <h3
            className={cn(
              "text-sm font-semibold leading-tight truncate",
              needsOwnerContact ? "text-red-900 dark:text-red-200" : "text-foreground"
            )}
          >
            {companyName}
          </h3>
          {deal.deal_score != null && (
            <DealScoreBadge score={deal.deal_score} size="sm" />
          )}
        </div>

        <div className="px-3.5 py-2.5 space-y-2">
          {/* Row 2: Revenue & EBITDA */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Rev: <span className="font-medium text-foreground">{formatCurrency(deal.listing_revenue)}</span>
            </span>
            <span className="text-muted-foreground">
              EBITDA: <span className="font-medium text-foreground">{formatCurrency(deal.listing_ebitda)}</span>
            </span>
          </div>

          {/* Row 3: Buyer info */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground truncate">
                {contactName}
              </span>
              {buyerTypeLabel && (
                <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                  {buyerTypeLabel}
                </span>
              )}
            </div>
            {buyerCompany && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                <span className="truncate">{buyerCompany}</span>
                {deal.buyer_website && (
                  <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                )}
              </div>
            )}
          </div>

          {/* Row 4: Deal Owner */}
          <div className="text-[11px] text-muted-foreground">
            Owner: <span className="font-medium text-foreground/80">{assignedAdmin?.displayName || 'Unassigned'}</span>
          </div>

          {/* Row 5: NDA/Fee status dots + Source + Last Activity */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot(deal.nda_status))} />
                <span>NDA</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot(deal.fee_agreement_status))} />
                <span>Fee</span>
              </div>
              <span className="inline-flex items-center gap-0.5">
                <SourceIcon className="w-2.5 h-2.5" />
                {sourceBadge.label}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {lastActivityLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
