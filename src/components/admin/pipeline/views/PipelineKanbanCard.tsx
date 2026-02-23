import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarCheck } from 'lucide-react';
import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';
import { useAdminProfile } from '@/hooks/admin/use-admin-profiles';
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

const TIER_CONFIG: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: 'T1', bg: 'bg-blue-100', text: 'text-blue-800' },
  2: { label: 'T2', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  3: { label: 'T3', bg: 'bg-gray-100', text: 'text-gray-600' },
  4: { label: 'T4', bg: 'bg-gray-100', text: 'text-gray-500' },
};

export function PipelineKanbanCard({ deal, onDealClick, isDragging }: PipelineKanbanCardProps) {
  const queryClient = useQueryClient();
  const {
    attributes, listeners, setNodeRef, transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: `deal:${deal.deal_id}` });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isBeingDragged = isDragging || isSortableDragging;
  const assignedAdmin = useAdminProfile(deal.assigned_to);
  const { data: unreadCounts } = useUnreadMessageCounts();
  const unreadCount = deal.connection_request_id ? (unreadCounts?.byRequest[deal.connection_request_id] || 0) : 0;

  const companyName = deal.listing_real_company_name || deal.listing_title || 'Unnamed Company';
  const contactName = deal.contact_name || deal.buyer_name || 'Unknown';
  const buyerCompany = deal.contact_company || deal.buyer_company;
  const buyerTypeLabel = deal.buyer_type ? (BUYER_TYPE_LABELS[deal.buyer_type] || deal.buyer_type) : null;

  const fmt = (val: number) => {
    if (!val) return '—';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  const daysInStage = (() => {
    const entered = deal.deal_stage_entered_at;
    if (!entered) return '—';
    const d = Math.floor((Date.now() - new Date(entered).getTime()) / 86400000);
    return `${d}d`;
  })();


  const ownerDisplayName = (() => {
    const name = assignedAdmin?.displayName;
    if (!name || name === 'Unassigned') return 'Unassigned';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
    return parts[0];
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

  // Score badge color
  const scoreColor = (() => {
    const s = deal.deal_score;
    if (s == null) return null;
    if (s >= 70) return 'bg-emerald-500';
    if (s >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  })();

  // Tier badge
  const tierConfig = deal.buyer_tier ? TIER_CONFIG[deal.buyer_tier] || TIER_CONFIG[4] : null;

  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      style={{ ...style, fontFamily: 'Montserrat, Inter, sans-serif' }}
      className={cn(
        "group relative mb-3 cursor-pointer rounded-[10px] bg-card border-2 border-border/60 overflow-hidden transition-all duration-200",
        isBeingDragged && "shadow-2xl scale-[1.02] z-50 opacity-95",
        !isBeingDragged && "hover:shadow-[0_4px_16px_rgba(222,199,107,0.2)] hover:-translate-y-px"
      )}
      onClick={handleCardClick}
    >
      {/* ── Header: Company + Score ── */}
      <div className={cn(
        "px-4 pt-3.5 pb-2.5 border-b border-border/30",
        deal.needs_owner_contact ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/30"
      )}>
        <div className="flex items-start justify-between gap-3">
          <h3 className={cn(
            "text-[15px] font-bold leading-snug",
            deal.needs_owner_contact ? "text-red-900 dark:text-red-200" : "text-foreground"
          )}>
            {companyName}
          </h3>
          {deal.deal_score != null && scoreColor && (
            <span className={cn(
              "flex-shrink-0 min-w-[42px] text-center px-2.5 py-1 rounded-md text-sm font-extrabold text-white",
              scoreColor
            )}>
              {deal.deal_score}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-3 space-y-3.5">
        {/* Buyer Section */}
        <div className="pb-3.5 border-b border-border/30 space-y-1">
          <div className="text-sm font-bold text-foreground truncate">
            {buyerCompany || contactName}
          </div>
          {buyerCompany && (
            <div className="text-xs text-muted-foreground truncate">{contactName}</div>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            {buyerTypeLabel && (
              <span className="text-[11px] font-semibold text-muted-foreground">{buyerTypeLabel}</span>
            )}
            {tierConfig && (
              <span className={cn(
                "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                tierConfig.bg, tierConfig.text
              )}>
                {tierConfig.label}
              </span>
            )}
          </div>
        </div>

        {/* Tags Row: Industry + NDA + Fee */}
        <div className="flex flex-wrap gap-1.5">
          {deal.listing_category && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {deal.listing_category}
            </span>
          )}
          {deal.nda_status === 'signed' && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              NDA
            </span>
          )}
          {deal.fee_agreement_status === 'signed' && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Fee
            </span>
          )}
        </div>

      {/* Financials */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">EBITDA</span>
            <span className="text-base font-extrabold text-foreground tabular-nums">
              {fmt(deal.listing_ebitda)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Revenue</span>
            <span className="text-base font-extrabold text-foreground tabular-nums">
              {fmt(deal.listing_revenue)}
            </span>
          </div>
        </div>

        {/* Footer: Owner + Source + Days */}
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <span className="text-[13px] font-bold text-foreground">{ownerDisplayName}</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
            <DealSourceBadge source={deal.deal_source} />
            <span className="text-[11px] text-muted-foreground tabular-nums">{daysInStage}</span>
          </div>
        </div>
      </div>

      {/* ── Compact status dots row ── */}
      <div className="px-4 py-1.5 border-t border-border/30 flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/20">
        <span className="inline-flex items-center gap-1" title={`NDA: ${deal.nda_status || 'none'}`}>
          NDA <span className={cn('inline-block w-1.5 h-1.5 rounded-full', statusDot(deal.nda_status))} />
        </span>
        <span className="inline-flex items-center gap-1" title={`Fee: ${deal.fee_agreement_status || 'none'}`}>
          Fee <span className={cn('inline-block w-1.5 h-1.5 rounded-full', statusDot(deal.fee_agreement_status))} />
        </span>
        <span className="inline-flex items-center gap-1" title={`Memo: ${deal.memo_sent ? 'Sent' : 'No'}`}>
          Memo <span className={cn('inline-block w-1.5 h-1.5 rounded-full', deal.memo_sent ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
        </span>
        <span className="inline-flex items-center gap-1" title={`Data Room: ${deal.has_data_room ? 'Yes' : 'No'}`}>
          DR <span className={cn('inline-block w-1.5 h-1.5 rounded-full', deal.has_data_room ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
        </span>
        <button type="button" onClick={handleMeetingToggle} className="inline-flex items-center gap-1 rounded transition-colors hover:bg-accent p-0.5 -ml-0.5" title={`Meeting: ${deal.meeting_scheduled ? 'Yes' : 'No'}`}>
          Mtg <CalendarCheck className={cn('w-3 h-3', deal.meeting_scheduled ? 'text-emerald-500' : 'text-muted-foreground/30')} />
        </button>
      </div>
    </div>
  );
}
