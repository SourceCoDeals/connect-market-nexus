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
  availableHeight?: number;
}

export function DealKanbanColumn({ stage, deals, onDealClick, availableHeight }: DealKanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  // Calculate max height for the column content area
  const maxContentHeight = availableHeight ? availableHeight - 160 : 'calc(100vh - 360px)';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-shrink-0 w-80">
      <div className="flex flex-col border border-border/20 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 rounded-lg">
        {/* Sticky Header */}
        <div className="bg-background/60 rounded-t-lg border-b border-border/30 p-4 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full shadow-sm" 
                style={{ backgroundColor: stage.color }}
              />
              <span className="tracking-tight">{stage.name}</span>
            </div>
            <Badge variant="secondary" className="bg-muted/60 text-muted-foreground font-medium px-2.5 py-1">
              {stage.dealCount}
            </Badge>
          </div>
          
          {stage.dealCount > 0 && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-background/60 rounded-md p-2 border border-border/30">
                <div className="text-muted-foreground font-medium uppercase tracking-wider">Value</div>
                <div className="font-semibold text-foreground mt-1">{formatCurrency(stage.totalValue)}</div>
              </div>
              <div className="bg-background/60 rounded-md p-2 border border-border/30">
                <div className="text-muted-foreground font-medium uppercase tracking-wider">Avg Prob</div>
                <div className="font-semibold text-foreground mt-1">{Math.round(stage.avgProbability)}%</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Scrollable Content Area */}
        <div 
          className="flex-1 p-4 overflow-y-auto space-y-3"
          style={{ 
            maxHeight: typeof maxContentHeight === 'string' ? maxContentHeight : `${maxContentHeight}px`
          }}
        >
          <div ref={setNodeRef} className="space-y-3">
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
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                <div className="opacity-75">No deals in this stage</div>
                <div className="text-xs mt-1 opacity-50">Deals will appear here when moved to this stage</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}