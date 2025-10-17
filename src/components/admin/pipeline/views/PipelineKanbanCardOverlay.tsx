import React from 'react';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineKanbanCardOverlayProps {
  deal: Deal;
}

export function PipelineKanbanCardOverlay({ deal }: PipelineKanbanCardOverlayProps) {
  return (
    <div className="rotate-3 scale-105">
      <div className="bg-card text-card-foreground border border-border/40 rounded-2xl shadow-2xl p-5 w-64 sm:w-72 lg:w-80">
        <div className="text-sm font-bold tracking-tight truncate">
          {deal.listing_title || (deal as any).title || 'Deal'}
        </div>
        <div className="text-xs text-muted-foreground/70 truncate mt-1">
          {(deal as any).contact_company || (deal as any).buyer_company || (deal as any).company_name || ''}
        </div>
      </div>
    </div>
  );
}
