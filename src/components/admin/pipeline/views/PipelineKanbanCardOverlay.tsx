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
      <div className="rounded-[10px] shadow-2xl w-72 overflow-hidden" style={{ border: '2px solid #DEC76B', fontFamily: 'Montserrat, Inter, sans-serif' }}>
        <div className="px-4 py-3" style={{ backgroundColor: '#FCF9F0', borderBottom: '1px solid #E5DDD0' }}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-[15px] font-bold truncate" style={{ color: '#0E101A' }}>{companyName}</span>
            {deal.deal_score != null && scoreColor && (
              <span className={cn(
                "flex-shrink-0 min-w-[42px] text-center px-2.5 py-1 rounded-md text-sm font-extrabold",
              )} style={deal.deal_score >= 70 ? { backgroundColor: '#DEC76B', color: '#0E101A' } : { backgroundColor: '#0E101A', color: '#FFFFFF' }}>
                {deal.deal_score}
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-2.5" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="text-sm font-bold truncate" style={{ color: '#0E101A' }}>{buyerCompany || deal.contact_name || ''}</div>
          <div className="text-xs truncate" style={{ color: '#5A5A5A' }}>{buyerCompany ? (deal.contact_name || '') : ''}</div>
        </div>
      </div>
    </div>
  );
}
