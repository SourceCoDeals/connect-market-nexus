import { Deal } from '@/hooks/admin/use-deals';
import { cn } from '@/lib/utils';

interface PipelineKanbanCardOverlayProps {
  deal: Deal;
}

export function PipelineKanbanCardOverlay({ deal }: PipelineKanbanCardOverlayProps) {
  const companyName = deal.listing_real_company_name || deal.listing_title || 'Unnamed';
  const buyerCompany = deal.contact_company || deal.buyer_company;

  const scoreColor = (() => {
    const s = deal.deal_score;
    if (s == null) return null;
    if (s >= 70) return 'bg-emerald-500';
    if (s >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  })();

  return (
    <div className="rotate-3 scale-105">
      <div className="bg-card text-card-foreground border-2 border-blue-400 rounded-[10px] shadow-2xl w-72 overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[15px] font-bold truncate">{companyName}</span>
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
        <div className="px-4 py-2.5">
          <div className="text-sm font-bold truncate">{buyerCompany || deal.contact_name || ''}</div>
          <div className="text-xs text-muted-foreground truncate">{buyerCompany ? (deal.contact_name || '') : ''}</div>
        </div>
      </div>
    </div>
  );
}
