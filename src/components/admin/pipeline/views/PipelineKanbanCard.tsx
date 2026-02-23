import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ExternalLink, BookOpen, FolderOpen, CalendarCheck } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';
import { DealScoreBadge } from '@/components/ma-intelligence/DealScoreBadge';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
        {/* Header: Company name */}
        <div className={cn(
          "px-3 py-1.5 rounded-t-xl flex items-center gap-2",
          needsOwnerContact
            ? "bg-red-100 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800"
            : "border-b border-border/40"
        )}>
          <h3 className={cn(
            "text-[13px] font-semibold leading-snug truncate flex-1",
            needsOwnerContact ? "text-red-900 dark:text-red-200" : "text-foreground"
          )}>
            {companyName}
          </h3>
        </div>

        <div className="px-3 py-2 space-y-2">
          {/* Financials + Score */}
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Rev: <span className="font-semibold text-foreground">{fmt(deal.listing_revenue)}</span></span>
              <span>EBITDA: <span className="font-semibold text-foreground">{fmt(deal.listing_ebitda)}</span></span>
            </div>
            {deal.deal_score != null && <DealScoreBadge score={deal.deal_score} size="sm" />}
          </div>

          {/* Buyer */}
          <div className="pt-1.5 border-t border-border/30 space-y-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[13px] font-semibold text-foreground truncate">{contactName}</span>
              {buyerTypeLabel && (
                <span className="flex-shrink-0 px-1.5 py-px rounded bg-primary/10 text-primary text-[10px] font-semibold leading-tight">
                  {buyerTypeLabel}
                </span>
              )}
            </div>
            {buyerCompany && (
              <div className="text-[11px] text-muted-foreground truncate">{buyerCompany}</div>
            )}
            {buyerWebsite && (
              <div className="flex items-center gap-1 text-[11px] text-primary/70 truncate">
                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{buyerWebsite}</span>
              </div>
            )}
          </div>

          {/* Owner */}
          <div className="text-[11px] text-muted-foreground">
            Owner: <span className="font-medium text-foreground/80">{assignedAdmin?.displayName || 'Unassigned'}</span>
          </div>

          {/* Status strip */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', statusDot(deal.nda_status))} />NDA
              </span>
              <span className="inline-flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', statusDot(deal.fee_agreement_status))} />Fee
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className={cn('w-2.5 h-2.5', active(deal.memo_sent))} />Memo
              </span>
              <span className="inline-flex items-center gap-1">
                <FolderOpen className={cn('w-2.5 h-2.5', active(deal.has_data_room))} />DR
              </span>
              <button
                type="button"
                onClick={handleMeetingToggle}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-0.5 -mx-0.5 transition-colors hover:bg-accent',
                  deal.meeting_scheduled && 'font-medium'
                )}
                title={deal.meeting_scheduled ? 'Meeting scheduled — click to unmark' : 'Click to mark meeting scheduled'}
              >
                <CalendarCheck className={cn('w-2.5 h-2.5', active(deal.meeting_scheduled))} />Mtg
              </button>
            </div>
            <span className="inline-flex items-center gap-0.5 text-muted-foreground/70">
              <Clock className="w-2.5 h-2.5" />
              {lastActivity}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
