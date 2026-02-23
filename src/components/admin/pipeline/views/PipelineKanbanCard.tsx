import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ExternalLink, CalendarCheck } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';
import { DealScoreBadge } from '@/components/ma-intelligence/DealScoreBadge';
import { BuyerTierBadge, BuyerScoreBadge } from '@/components/admin/BuyerQualityBadges';
import { DealSourceBadge } from '@/components/remarketing/DealSourceBadge';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUnreadMessageCounts } from '@/hooks/use-connection-messages';

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
  const queryClient = useQueryClient();
  const {
    attributes, listeners, setNodeRef, transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: `deal:${deal.deal_id}` });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isBeingDragged = isDragging || isSortableDragging;
  const isPriority = deal.is_priority_target;
  const needsOwnerContact = deal.needs_owner_contact;
  const assignedAdmin = useAdminProfile(deal.assigned_to);
  const { data: unreadCounts } = useUnreadMessageCounts();
  const unreadCount = deal.connection_request_id ? (unreadCounts?.byRequest[deal.connection_request_id] || 0) : 0;
  const companyName = deal.listing_real_company_name || deal.listing_title || 'Unnamed Company';
  const contactName = deal.contact_name || deal.buyer_name || 'Unknown';
  const buyerCompany = deal.contact_company || deal.buyer_company;
  const buyerTypeLabel = deal.buyer_type ? (BUYER_TYPE_LABELS[deal.buyer_type] || deal.buyer_type) : null;
  const buyerWebsite = deal.buyer_website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  const fmt = (val: number) => {
    if (!val) return '—';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  const lastActivity = (() => {
    const date = deal.last_activity_at || deal.deal_updated_at;
    if (!date) return '—';
    const ms = Math.max(0, Date.now() - new Date(date).getTime());
    const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), d = Math.floor(ms / 86400000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  })();

  const handleCardClick = () => { if (!isBeingDragged) onDealClick(deal); };

  const handleMeetingToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !deal.meeting_scheduled;
    const { error } = await supabase.from('deals').update({ meeting_scheduled: next }).eq('id', deal.deal_id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success(next ? 'Meeting scheduled' : 'Meeting unscheduled');
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  const statusDot = (status: string) => {
    if (status === 'signed') return 'bg-emerald-500';
    if (status === 'sent') return 'bg-amber-500';
    if (status === 'declined') return 'bg-destructive';
    return 'bg-muted-foreground/30';
  };

  const active = (on?: boolean) => on ? 'text-emerald-500' : 'text-muted-foreground/30';

  return (
    <Card
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={cn(
        "group relative mb-2.5 cursor-pointer transition-all duration-200 rounded-xl shadow-sm",
        isPriority
          ? "bg-amber-50 border-2 border-amber-400 dark:bg-amber-950/30 dark:border-amber-600"
          : "bg-card border border-border",
        isBeingDragged && "shadow-2xl shadow-black/10 scale-[1.02] z-50 opacity-95"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        {/* Header: Company + Score + Financials */}
        <div className={cn(
          "px-3 pt-2.5 pb-2",
          needsOwnerContact && "bg-red-50 dark:bg-red-950/40 rounded-t-xl"
        )}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn(
              "text-sm font-semibold leading-snug truncate",
              needsOwnerContact ? "text-red-900 dark:text-red-200" : "text-foreground"
            )}>
              {companyName}
            </h3>
            {deal.deal_score != null && <DealScoreBadge score={deal.deal_score} size="sm" />}
          </div>
          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
            <span>Rev: <span className="font-semibold text-foreground">{fmt(deal.listing_revenue)}</span></span>
            <span>EBITDA: <span className="font-semibold text-foreground">{fmt(deal.listing_ebitda)}</span></span>
          </div>
        </div>

        {/* Buyer block — company/firm prominent, individual smaller */}
        <div className="px-3 py-1.5 border-t border-border/30 space-y-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-sm font-bold text-foreground truncate">{buyerCompany || contactName}</span>
            <div className="flex items-center gap-1">
              <BuyerTierBadge tier={deal.buyer_tier} />
              <BuyerScoreBadge score={deal.buyer_quality_score} size="lg" />
              {buyerTypeLabel && (
                <span className="flex-shrink-0 px-1.5 py-px rounded bg-primary/10 text-primary text-[11px] font-semibold leading-tight">
                  {buyerTypeLabel}
                </span>
              )}
            </div>
          </div>
          {buyerCompany && (
            <div className="text-[11px] text-muted-foreground truncate">{contactName}</div>
          )}
          {buyerWebsite && (
            <div className="flex items-center gap-1 text-[11px] text-primary/70 truncate">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{buyerWebsite}</span>
            </div>
          )}
        </div>

        {/* Labeled status grid */}
        <div className="px-3 py-1.5 border-t border-border/30">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              NDA <span className={cn('inline-block w-1.5 h-1.5 rounded-full', statusDot(deal.nda_status))} />
              <span className="font-medium text-foreground/80">{deal.nda_status === 'signed' ? 'Signed' : deal.nda_status === 'sent' ? 'Sent' : deal.nda_status === 'declined' ? 'Declined' : '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              Fee <span className={cn('inline-block w-1.5 h-1.5 rounded-full', statusDot(deal.fee_agreement_status))} />
              <span className="font-medium text-foreground/80">{deal.fee_agreement_status === 'signed' ? 'Signed' : deal.fee_agreement_status === 'sent' ? 'Sent' : deal.fee_agreement_status === 'declined' ? 'Declined' : '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              Memo <span className={cn('inline-block w-1.5 h-1.5 rounded-full', deal.memo_sent ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
              <span className="font-medium text-foreground/80">{deal.memo_sent ? 'Sent' : '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              DR <span className={cn('inline-block w-1.5 h-1.5 rounded-full', deal.has_data_room ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
              <span className="font-medium text-foreground/80">{deal.has_data_room ? 'Yes' : '—'}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleMeetingToggle}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground rounded p-0.5 -ml-0.5 transition-colors hover:bg-accent"
          >
            Mtg <CalendarCheck className={cn('w-3 h-3', active(deal.meeting_scheduled))} />
            <span className="font-medium text-foreground/80">{deal.meeting_scheduled ? 'Yes' : '—'}</span>
          </button>
        </div>

        {/* Footer: Owner + Last Activity + Unread */}
        <div className="px-3 py-1.5 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              Owner: <span className="font-medium text-foreground/80">{assignedAdmin?.displayName || 'Unassigned'}</span>
            </span>
            <DealSourceBadge source={deal.deal_source} />
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
              <Clock className="w-3 h-3" />
              {lastActivity}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
