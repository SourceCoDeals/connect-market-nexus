import React from 'react';
import { Deal } from '@/hooks/admin/use-deals';

interface PipelineKanbanCardOverlayProps {
  deal: Deal;
}

export function PipelineKanbanCardOverlay({ deal }: PipelineKanbanCardOverlayProps) {
  return (
    <div className="rotate-2 scale-105">
      <div className="bg-card/60 backdrop-blur-sm text-card-foreground border-0 rounded-xl shadow-2xl p-4 w-64 sm:w-72 lg:w-80">
        <div className="text-[13px] font-semibold truncate">
          {deal.listing_title || (deal as any).title || 'Deal'}
        </div>
        <div className="text-[11px] text-muted-foreground/60 truncate mt-1">
          {(deal as any).contact_company || (deal as any).buyer_company || (deal as any).company_name || ''}
        </div>
      </div>
    </div>
  );
}
