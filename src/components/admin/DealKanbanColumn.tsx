import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Deal, DealStage } from '@/hooks/admin/use-deals';
import { EnhancedDealKanbanCard } from './EnhancedDealKanbanCard';

interface DealKanbanColumnProps {
  stage: DealStage & {
    dealCount: number;
    totalValue: number;
    avgProbability: number;
  };
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
}

export function DealKanbanColumn({ stage, deals, onDealClick }: DealKanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-shrink-0 w-72">
      <div className="h-full flex flex-col bg-background/80 border border-border/20 rounded-lg">
        {/* Minimal Header */}
        <div className="p-3 border-b border-border/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-sm font-medium text-foreground">{stage.name}</span>
            </div>
            <span className="text-xs text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded">
              {stage.dealCount}
            </span>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={setNodeRef}
            className="h-full overflow-y-auto p-2 space-y-2"
            style={{ maxHeight: 'calc(100vh - 108px)' }}
          >
            <SortableContext 
              items={deals.map(deal => deal.deal_id)}
              strategy={verticalListSortingStrategy}
            >
              {deals.map((deal) => (
                <EnhancedDealKanbanCard
                  key={deal.deal_id}
                  deal={deal}
                  onClick={() => onDealClick?.(deal)}
                />
              ))}
            </SortableContext>
            
            {deals.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/60 text-xs">
                <div>No deals</div>
                <div className="mt-1 opacity-50">Drag deals here</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}