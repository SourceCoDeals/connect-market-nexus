import { Deal } from '@/hooks/admin/use-deals';

interface PipelineKanbanCardOverlayProps {
  deal: Deal;
}

export function PipelineKanbanCardOverlay({ deal }: PipelineKanbanCardOverlayProps) {
  return (
    <div className="rotate-3 scale-105">
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm p-4 w-64 sm:w-72 lg:w-80">
        <div className="text-sm font-medium truncate">
          {deal.listing_title || deal.title || 'Deal'}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {deal.contact_company || deal.buyer_company || ''}
        </div>
      </div>
    </div>
  );
}
