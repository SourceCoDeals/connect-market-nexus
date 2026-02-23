import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ExternalLink, BookOpen, FolderOpen } from 'lucide-react';
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
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Row 2: Score + Revenue & EBITDA */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Rev: <span className="font-semibold text-foreground">{formatCurrency(deal.listing_revenue)}</span>
              </span>
              <span className="text-muted-foreground">
                EBITDA: <span className="font-semibold text-foreground">{formatCurrency(deal.listing_ebitda)}</span>
              </span>
            </div>
            {deal.deal_score != null && (
              <DealScoreBadge score={deal.deal_score} size="md" />
            )}
          </div>

          {/* Row 3: Buyer section */}
          <div className="space-y-1.5 pt-1 border-t border-border/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {contactName}
              </span>
              {buyerTypeLabel && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                  {buyerTypeLabel}
                </span>
              )}
            </div>
            {buyerCompany && (
              <div className="text-xs text-muted-foreground truncate">
                {buyerCompany}
              </div>
            )}
            {deal.buyer_website && (
              <div className="flex items-center gap-1 text-xs text-primary/70 truncate">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{deal.buyer_website.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </div>
            )}
          </div>

          {/* Row 4: Deal Owner */}
          <div className="text-xs text-muted-foreground">
            Owner: <span className="font-semibold text-foreground/80">{assignedAdmin?.displayName || 'Unassigned'}</span>
          </div>

          {/* Row 5: NDA/Fee + Memo/DataRoom status + Source + Last Activity */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', getStatusDot(deal.nda_status))} />
                <span>NDA</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', getStatusDot(deal.fee_agreement_status))} />
                <span>Fee</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className={cn('w-3 h-3', deal.memo_sent ? 'text-emerald-500' : 'text-muted-foreground/30')} />
                <span className={deal.memo_sent ? 'text-emerald-600 font-medium' : ''}>Memo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FolderOpen className={cn('w-3 h-3', deal.has_data_room ? 'text-emerald-500' : 'text-muted-foreground/30')} />
                <span className={deal.has_data_room ? 'text-emerald-600 font-medium' : ''}>DR</span>
              </div>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastActivityLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
