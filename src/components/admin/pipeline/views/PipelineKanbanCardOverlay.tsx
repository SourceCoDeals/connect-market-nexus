import React from 'react';
import type { Deal } from '@/hooks/admin/use-deals';

interface PipelineKanbanCardOverlayProps {
  deal: Deal;
}

export function PipelineKanbanCardOverlay({ deal }: PipelineKanbanCardOverlayProps) {
  return (
    <div className="rotate-3 scale-105">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3">
        <div className="text-sm font-medium line-clamp-2">
          {deal.deal_title || deal.listing_title || (deal as any).title || 'Deal'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {deal.contact_company || deal.buyer_company || (deal as any).company || '—'}
        </div>
      </div>
    </div>
  );
}
